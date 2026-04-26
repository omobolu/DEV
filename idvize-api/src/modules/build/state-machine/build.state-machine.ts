import { BuildState, BuildJob, StateTransition } from '../build.types';

/**
 * Build Execution State Machine
 *
 * DETECTED → CLASSIFIED → ASSIGNED → READY_TO_BUILD →
 * OUTREACH_SENT → MEETING_SCHEDULED → DATA_COLLECTED →
 * BUILD_IN_PROGRESS → TESTING → COMPLETED
 *
 * Terminal states: COMPLETED, FAILED, CANCELLED
 */

type AllowedTransitions = Partial<Record<BuildState, BuildState[]>>;

const ALLOWED_TRANSITIONS: AllowedTransitions = {
  DETECTED: ['CLASSIFIED', 'CANCELLED'],
  CLASSIFIED: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['READY_TO_BUILD', 'CANCELLED'],
  READY_TO_BUILD: ['OUTREACH_SENT', 'BUILD_IN_PROGRESS', 'CANCELLED'],
  OUTREACH_SENT: ['MEETING_SCHEDULED', 'DATA_COLLECTED', 'FAILED', 'CANCELLED'],
  MEETING_SCHEDULED: ['DATA_COLLECTED', 'OUTREACH_SENT', 'FAILED', 'CANCELLED'],
  DATA_COLLECTED: ['BUILD_IN_PROGRESS', 'CANCELLED'],
  BUILD_IN_PROGRESS: ['TESTING', 'FAILED', 'CANCELLED'],
  TESTING: ['COMPLETED', 'BUILD_IN_PROGRESS', 'FAILED'],
  // Terminal states — no transitions out
  COMPLETED: [],
  FAILED: ['DETECTED'], // Allow re-queuing
  CANCELLED: ['DETECTED'],
};

const TERMINAL_STATES: BuildState[] = ['COMPLETED', 'FAILED', 'CANCELLED'];

const STATE_LABELS: Record<BuildState, string> = {
  DETECTED: 'Gap Detected',
  CLASSIFIED: 'Classified',
  ASSIGNED: 'Assigned to Engineer',
  READY_TO_BUILD: 'Ready to Build',
  OUTREACH_SENT: 'Outreach Sent to App Team',
  MEETING_SCHEDULED: 'Meeting Scheduled',
  DATA_COLLECTED: 'Technical Data Collected',
  BUILD_IN_PROGRESS: 'Build In Progress',
  TESTING: 'Testing',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled',
};

export class BuildStateMachine {

  /**
   * Attempt a state transition on a build job.
   * Returns the updated job or throws if the transition is invalid.
   */
  transition(job: BuildJob, targetState: BuildState, actor: string, reason?: string): BuildJob {
    if (!this.canTransition(job.state, targetState)) {
      throw new Error(
        `Invalid transition: ${job.state} → ${targetState}. ` +
        `Allowed from ${job.state}: [${(ALLOWED_TRANSITIONS[job.state] ?? []).join(', ')}]`
      );
    }

    const transition: StateTransition = {
      from: job.state,
      to: targetState,
      timestamp: new Date().toISOString(),
      actor,
      reason,
    };

    const updated: BuildJob = {
      ...job,
      state: targetState,
      updatedAt: new Date().toISOString(),
      stateHistory: [...job.stateHistory, transition],
      completedAt: targetState === 'COMPLETED' ? new Date().toISOString() : job.completedAt,
    };

    return updated;
  }

  canTransition(from: BuildState, to: BuildState): boolean {
    const allowed = ALLOWED_TRANSITIONS[from] ?? [];
    return allowed.includes(to);
  }

  isTerminal(state: BuildState): boolean {
    return TERMINAL_STATES.includes(state);
  }

  getLabel(state: BuildState): string {
    return STATE_LABELS[state] ?? state;
  }

  getAllowedTransitions(from: BuildState): BuildState[] {
    return ALLOWED_TRANSITIONS[from] ?? [];
  }

  /**
   * Auto-advance: determine the next logical state based on job context.
   * Used by the automated build mode.
   */
  getNextState(job: BuildJob): BuildState | null {
    if (this.isTerminal(job.state)) return null;

    // In automated mode, skip outreach/meeting steps if data is already available
    if (job.mode === 'automated') {
      const autoMap: Partial<Record<BuildState, BuildState>> = {
        DETECTED: 'CLASSIFIED',
        CLASSIFIED: 'ASSIGNED',
        ASSIGNED: 'READY_TO_BUILD',
        READY_TO_BUILD: hasRequiredData(job) ? 'BUILD_IN_PROGRESS' : 'OUTREACH_SENT',
        OUTREACH_SENT: 'DATA_COLLECTED',
        DATA_COLLECTED: 'BUILD_IN_PROGRESS',
        BUILD_IN_PROGRESS: 'TESTING',
        TESTING: 'COMPLETED',
      };
      return autoMap[job.state] ?? null;
    }

    // Guided/advisory: always go through full workflow
    const guidedMap: Partial<Record<BuildState, BuildState>> = {
      DETECTED: 'CLASSIFIED',
      CLASSIFIED: 'ASSIGNED',
      ASSIGNED: 'READY_TO_BUILD',
      READY_TO_BUILD: 'OUTREACH_SENT',
      OUTREACH_SENT: 'MEETING_SCHEDULED',
      MEETING_SCHEDULED: 'DATA_COLLECTED',
      DATA_COLLECTED: 'BUILD_IN_PROGRESS',
      BUILD_IN_PROGRESS: 'TESTING',
      TESTING: 'COMPLETED',
    };
    return guidedMap[job.state] ?? null;
  }
}

function hasRequiredData(job: BuildJob): boolean {
  const requiredKeys = job.requiredInputs.filter(i => i.required).map(i => i.key);
  return requiredKeys.every(k => job.collectedData[k] !== undefined && job.collectedData[k] !== '');
}

export const buildStateMachine = new BuildStateMachine();
