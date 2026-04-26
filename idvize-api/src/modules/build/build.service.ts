import { v4 as uuidv4 } from 'uuid';
import { BuildJob, StartBuildRequest, BuildState, BuildMode } from './build.types';
import { ControlName } from '../control/control.types';
import { buildRepository } from './build.repository';
import { buildStateMachine } from './state-machine/build.state-machine';
import { gapToBuildEngine } from './engines/gap-to-build.engine';
import { buildArtifactGenerator } from './engines/build-artifact.generator';
import { applicationRepository } from '../application/application.repository';

export class BuildService {

  /**
   * Start a new build job from a detected gap.
   * Initializes the job in DETECTED state and auto-advances to CLASSIFIED.
   */
  startBuild(tenantId: string, request: StartBuildRequest): BuildJob {
    const app = applicationRepository.findById(tenantId, request.appId);
    const appName = app?.name ?? request.appId;

    // Resolve build spec from the gap
    const spec = gapToBuildEngine.resolve(request.controlGap as ControlName, app ?? {
      appId: request.appId,
      name: appName,
      appType: 'unknown',
      riskTier: 'medium',
      dataClassification: 'internal',
      userPopulation: 0,
      tags: [],
    } as any);

    const now = new Date().toISOString();
    const job: BuildJob = {
      buildId: `BUILD-${uuidv4().split('-')[0].toUpperCase()}`,
      appId: request.appId,
      appName,
      buildType: request.buildType ?? spec.buildType,
      platform: request.platform ?? spec.platform,
      mode: request.mode ?? 'guided',
      state: 'DETECTED',
      controlGap: request.controlGap,
      priority: spec.priority,
      assignedTo: request.assignedTo,
      requiredInputs: spec.requiredInputs,
      collectedData: {},
      artifacts: [],
      stakeholders: app ? [{
        name: app.owner,
        email: app.ownerEmail,
        role: 'app_owner',
        notified: false,
      }] : [],
      stateHistory: [{
        from: 'DETECTED',
        to: 'DETECTED',
        timestamp: now,
        actor: 'system',
        reason: 'Build job created by IDVIZE gap detection',
      }],
      notes: `Auto-created from gap: ${request.controlGap}`,
      createdAt: now,
      updatedAt: now,
      estimatedHours: spec.estimatedHours,
    };

    buildRepository.save(tenantId, job);

    // Auto-advance to CLASSIFIED
    return this.transition(tenantId, job.buildId, 'CLASSIFIED', 'system', 'Auto-classified by gap-to-build engine');
  }

  /**
   * Advance a build job to the next logical state.
   */
  advance(tenantId: string, buildId: string, actor = 'system'): BuildJob {
    const job = buildRepository.findById(tenantId, buildId);
    if (!job) throw new Error(`Build job ${buildId} not found`);

    const nextState = buildStateMachine.getNextState(job);
    if (!nextState) throw new Error(`Build job ${buildId} is in terminal state: ${job.state}`);

    return this.transition(tenantId, buildId, nextState, actor);
  }

  /**
   * Explicitly transition a build job to a target state.
   */
  transition(tenantId: string, buildId: string, targetState: BuildState, actor: string, reason?: string): BuildJob {
    const job = buildRepository.findById(tenantId, buildId);
    if (!job) throw new Error(`Build job ${buildId} not found`);

    const updated = buildStateMachine.transition(job, targetState, actor, reason);

    // When data is collected, generate artifacts
    if (targetState === 'DATA_COLLECTED' && Object.keys(updated.collectedData).length > 0) {
      const artifacts = buildArtifactGenerator.generate(updated);
      updated.artifacts = artifacts;
    }

    // When moving to BUILD_IN_PROGRESS, generate artifacts if not already done
    if (targetState === 'BUILD_IN_PROGRESS' && updated.artifacts.length === 0) {
      updated.artifacts = buildArtifactGenerator.generate(updated);
    }

    return buildRepository.save(tenantId, updated);
  }

  /**
   * Collect technical data for a build job (updates required inputs).
   */
  collectData(tenantId: string, buildId: string, data: Record<string, string | boolean>, actor = 'user'): BuildJob {
    const job = buildRepository.findById(tenantId, buildId);
    if (!job) throw new Error(`Build job ${buildId} not found`);

    // Merge new data into collectedData
    const updatedCollectedData = { ...job.collectedData, ...data };

    // Update requiredInputs collected status
    const updatedInputs = job.requiredInputs.map(input => ({
      ...input,
      collected: updatedCollectedData[input.key] !== undefined,
      value: updatedCollectedData[input.key] !== undefined
        ? String(updatedCollectedData[input.key])
        : input.value,
    }));

    const allRequiredCollected = updatedInputs
      .filter(i => i.required)
      .every(i => i.collected);

    const updated: BuildJob = {
      ...job,
      collectedData: updatedCollectedData,
      requiredInputs: updatedInputs,
      updatedAt: new Date().toISOString(),
    };

    buildRepository.save(tenantId, updated);

    // Auto-advance to DATA_COLLECTED if all required data is in
    if (allRequiredCollected && job.state === 'MEETING_SCHEDULED') {
      return this.transition(tenantId, buildId, 'DATA_COLLECTED', actor, 'All required data collected');
    }

    return updated;
  }

  /**
   * Generate (or regenerate) artifacts for a build job.
   */
  generateArtifacts(tenantId: string, buildId: string): BuildJob {
    const job = buildRepository.findById(tenantId, buildId);
    if (!job) throw new Error(`Build job ${buildId} not found`);

    const artifacts = buildArtifactGenerator.generate(job);
    const updated = { ...job, artifacts, updatedAt: new Date().toISOString() };
    return buildRepository.save(tenantId, updated);
  }

  getBuild(tenantId: string, buildId: string): BuildJob | undefined {
    return buildRepository.findById(tenantId, buildId);
  }

  listBuilds(tenantId: string, filters?: { state?: string; platform?: string; appId?: string }) {
    return buildRepository.findAll(tenantId, filters).map(j => buildRepository.toSummary(j));
  }

  getFullBuild(tenantId: string, buildId: string): BuildJob | undefined {
    return buildRepository.findById(tenantId, buildId);
  }

  /**
   * Run a full automated build for an app gap (automated mode).
   * Advances through all states, generating artifacts along the way.
   */
  async runAutomated(tenantId: string, request: StartBuildRequest): Promise<BuildJob> {
    request.mode = 'automated';
    let job = this.startBuild(tenantId, request);

    // Auto-advance until terminal or DATA_COLLECTED (where we need data first)
    const maxSteps = 20;
    let steps = 0;

    while (!buildStateMachine.isTerminal(job.state) && job.state !== 'DATA_COLLECTED' && steps < maxSteps) {
      try {
        job = this.advance(tenantId, job.buildId, 'ai-agent');
        steps++;
      } catch {
        break;
      }
    }

    // In automated mode: generate artifacts then advance to TESTING
    if (job.state === 'DATA_COLLECTED') {
      job = this.transition(tenantId, job.buildId, 'BUILD_IN_PROGRESS', 'ai-agent', 'Automated build starting');
    }
    if (job.state === 'BUILD_IN_PROGRESS') {
      job = this.generateArtifacts(tenantId, job.buildId);
      job = this.transition(tenantId, job.buildId, 'TESTING', 'ai-agent', 'Automated build artifacts generated');
    }

    return job;
  }
}

export const buildService = new BuildService();
