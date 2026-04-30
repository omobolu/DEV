import { Router, Request, Response } from 'express';
import { buildService } from './build.service';
import { StartBuildRequest, BuildState } from './build.types';
import { buildStateMachine } from './state-machine/build.state-machine';
import { requireAuth } from '../../middleware/requireAuth';
import { tenantContext } from '../../middleware/tenantContext';
import { requirePermission } from '../../middleware/requirePermission';

const router = Router();

router.use(requireAuth, tenantContext);

// POST /build/start — start a new build job
router.post('/start', requirePermission('build.execute.guided'), async (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { appId, controlGap, buildType, platform, mode, assignedTo, automated } = req.body as StartBuildRequest & { automated?: boolean };

  if (!appId || !controlGap) {
    res.status(400).json({ success: false, error: '"appId" and "controlGap" are required', timestamp: new Date().toISOString() });
    return;
  }

  if (automated) {
    const job = await buildService.runAutomated(tenantId, { appId, controlGap, buildType, platform, mode: 'automated', assignedTo });
    res.status(201).json({ success: true, data: job, timestamp: new Date().toISOString() });
    return;
  }

  const job = buildService.startBuild(tenantId, { appId, controlGap, buildType, platform, mode, assignedTo });
  res.status(201).json({ success: true, data: job, timestamp: new Date().toISOString() });
});

// GET /build — list all build jobs (summary)
router.get('/', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { state, platform, appId } = req.query as { state?: string; platform?: string; appId?: string };
  const jobs = buildService.listBuilds(tenantId, { state, platform, appId });
  res.json({ success: true, data: { total: jobs.length, jobs }, timestamp: new Date().toISOString() });
});

// GET /build/:id — get full build job details
router.get('/:id', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const job = buildService.getFullBuild(tenantId, req.params.id as string);
  if (!job) {
    res.status(404).json({ success: false, error: 'Build job not found', timestamp: new Date().toISOString() });
    return;
  }
  res.json({ success: true, data: job, timestamp: new Date().toISOString() });
});

// POST /build/:id/advance — advance to next logical state
router.post('/:id/advance', requirePermission('build.execute.guided'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { actor } = req.body as { actor?: string };
  const job = buildService.advance(tenantId, req.params.id as string, actor ?? 'user');
  res.json({ success: true, data: job, timestamp: new Date().toISOString() });
});

// POST /build/:id/transition — explicit state transition
router.post('/:id/transition', requirePermission('build.execute.guided'), (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { targetState, actor, reason } = req.body as { targetState: BuildState; actor?: string; reason?: string };
  if (!targetState) {
    res.status(400).json({ success: false, error: '"targetState" is required', timestamp: new Date().toISOString() });
    return;
  }
  const job = buildService.transition(tenantId, req.params.id as string, targetState, actor ?? 'user', reason);
  res.json({ success: true, data: job, timestamp: new Date().toISOString() });
});

// POST /build/:id/data — submit collected technical data
router.post('/:id/data', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const { data, actor } = req.body as { data: Record<string, string | boolean>; actor?: string };
  if (!data || typeof data !== 'object') {
    res.status(400).json({ success: false, error: '"data" object is required', timestamp: new Date().toISOString() });
    return;
  }
  const job = buildService.collectData(tenantId, req.params.id as string, data, actor ?? 'user');
  res.json({ success: true, data: job, timestamp: new Date().toISOString() });
});

// POST /build/:id/artifacts — (re)generate build artifacts
router.post('/:id/artifacts', (req: Request, res: Response) => {
  const tenantId = req.tenantId!;
  const job = buildService.generateArtifacts(tenantId, req.params.id as string);
  res.json({ success: true, data: { artifacts: job.artifacts, total: job.artifacts.length }, timestamp: new Date().toISOString() });
});

// GET /build/states/allowed — allowed state transitions reference
router.get('/states/allowed', (req: Request, res: Response) => {
  const { from } = req.query as { from?: BuildState };
  if (from) {
    const allowed = buildStateMachine.getAllowedTransitions(from);
    res.json({ success: true, data: { from, allowed }, timestamp: new Date().toISOString() });
    return;
  }
  const states: BuildState[] = ['DETECTED', 'CLASSIFIED', 'ASSIGNED', 'READY_TO_BUILD', 'OUTREACH_SENT',
    'MEETING_SCHEDULED', 'DATA_COLLECTED', 'BUILD_IN_PROGRESS', 'TESTING', 'COMPLETED', 'FAILED', 'CANCELLED'];
  const map = Object.fromEntries(states.map(s => [s, buildStateMachine.getAllowedTransitions(s)]));
  res.json({ success: true, data: map, timestamp: new Date().toISOString() });
});

export default router;
