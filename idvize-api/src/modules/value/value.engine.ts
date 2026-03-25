/**
 * Value Engine — Module 10: Business Value & Risk Intelligence
 *
 * Deterministic risk-exposure model using probability × impact with
 * multiplicative control reduction. Every formula is explicit and auditable.
 *
 * Core formula:
 *   baseExposure    = P(incident | tier) × Impact(tier) × userMultiplier
 *   residualFactor  = Π (1 − reductionFactor[ctrl])  for each control present
 *   currentExposure = baseExposure × residualFactor
 *   valueProtected  = baseExposure − currentExposure
 */

import { Application, IamPosture } from '../application/application.types';
import {
  RiskAssumptions, AppValueProfile, ControlValueProfile, ControlKey,
  PortfolioSummary, TierValueSummary, SimulationInput, SimulationResult,
} from './value.types';
import { DEFAULT_ASSUMPTIONS } from './value.assumptions';

// ── Static lookup tables ──────────────────────────────────────────────────────

export const CONTROL_NAMES: Record<ControlKey, string> = {
  sso:          'Single Sign-On (SSO)',
  mfa:          'Multi-Factor Authentication',
  pam:          'Privileged Access Management',
  jml:          'Joiner-Mover-Leaver Automation',
  scim:         'SCIM Provisioning',
  accessReview: 'Access Certifications',
};

export const CONTROL_PILLARS: Record<ControlKey, string> = {
  sso:          'AM',
  mfa:          'AM',
  pam:          'PAM',
  jml:          'IGA',
  scim:         'IGA',
  accessReview: 'IGA',
};

const ALL_CONTROLS: ControlKey[] = ['sso', 'mfa', 'pam', 'jml', 'scim', 'accessReview'];

// ── Private helpers ───────────────────────────────────────────────────────────

function getImplementedControls(posture: IamPosture | undefined): ControlKey[] {
  if (!posture) return [];
  const c: ControlKey[] = [];
  if (posture.ssoEnabled)                c.push('sso');
  if (posture.mfaEnforced)               c.push('mfa');
  if (posture.privilegedAccountsVaulted) c.push('pam');
  if (posture.jmlAutomated)              c.push('jml');
  if (posture.scimEnabled)               c.push('scim');
  if (posture.certificationsConfigured)  c.push('accessReview');
  return c;
}

/**
 * Log₁₀ user-population multiplier. Neutral at userScaleBase.
 * Modest scaling avoids customer-portal apps dominating the entire portfolio.
 */
function userMultiplier(pop: number, a: RiskAssumptions): number {
  return 1 + Math.log10(Math.max(pop, 1) / a.userScaleBase) * a.userScaleFactor;
}

/**
 * Multiplicative residual factor after applying a set of controls.
 * Each control removes a percentage of the *remaining* risk, not the base.
 */
function residualFactor(controls: ControlKey[], a: RiskAssumptions): number {
  return controls.reduce(
    (f, ctrl) => f * (1 - (a.controlReduction[ctrl] ?? 0)),
    1.0
  );
}

function fmt$(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n)}`;
}

// ── Core computation functions ────────────────────────────────────────────────

/**
 * Compute the value profile for a single application.
 */
export function computeAppValue(
  app: Application,
  a: RiskAssumptions = DEFAULT_ASSUMPTIONS
): AppValueProfile {
  const tier   = app.riskTier;
  const prob   = (a.incidentProbability as Record<string, number>)[tier] ?? 0.05;
  const impact = (a.incidentImpact      as Record<string, number>)[tier] ?? 100_000;
  const uMult  = userMultiplier(app.userPopulation, a);

  const base = prob * impact * uMult;

  const implemented = getImplementedControls(app.iamPosture);
  const gaps        = ALL_CONTROLS.filter(c => !implemented.includes(c));

  const currentFactor = residualFactor(implemented, a);
  const current       = base * currentFactor;
  const protected_    = base - current;
  const reductionPct  = base > 0 ? Math.round((protected_ / base) * 100) : 0;

  const fullFactor    = residualFactor(ALL_CONTROLS, a);
  const fullCovered   = base * fullFactor;
  const potentialFull = base - fullCovered;
  const potentialAdd  = potentialFull - protected_;
  const gapExposure   = current - fullCovered;

  const controlCost = implemented.reduce(
    (s, ctrl) => s + (a.controlCostPerApp[ctrl] ?? 0), 0
  );

  const roi = controlCost > 0
    ? Math.round(((protected_ - controlCost) / controlCost) * 100)
    : protected_ > 0 ? 999 : 0;

  return {
    appId:      app.appId,
    appName:    app.name,
    riskTier:   app.riskTier,
    department: app.department,
    dataClassification: app.dataClassification,
    userPopulation: app.userPopulation,

    baseAnnualExposure:        Math.round(base),
    currentAnnualExposure:     Math.round(current),
    valueProtected:            Math.round(protected_),
    reductionPct,
    gapExposure:               Math.round(gapExposure),
    potentialAdditionalValue:  Math.round(potentialAdd),
    potentialFullProtection:   Math.round(potentialFull),

    implementedControls:  implemented,
    gapControls:          gaps,
    estimatedControlCost: Math.round(controlCost),
    roi,
  };
}

/**
 * Compute value profiles for the full application portfolio.
 */
export function computePortfolioValue(
  apps: Application[],
  a: RiskAssumptions = DEFAULT_ASSUMPTIONS
): AppValueProfile[] {
  return apps.map(app => computeAppValue(app, a));
}

/**
 * Aggregate per-control value metrics across the portfolio using
 * marginal contribution analysis — each control's value = the risk
 * reduction it personally contributes within each app's control set.
 */
export function computeControlValues(
  profiles: AppValueProfile[],
  a: RiskAssumptions = DEFAULT_ASSUMPTIONS
): ControlValueProfile[] {
  return ALL_CONTROLS.map(ctrl => {
    const implemented = profiles.filter(p => p.implementedControls.includes(ctrl));
    const gapApps     = profiles.filter(p => p.gapControls.includes(ctrl));
    const total       = profiles.length;

    let totalValueProtected      = 0;
    let totalPotentialAdditional = 0;

    for (const p of profiles) {
      if (p.implementedControls.includes(ctrl)) {
        // Marginal contribution: exposure WITH ctrl − exposure WITHOUT ctrl
        const without       = p.implementedControls.filter(c => c !== ctrl);
        const withFactor    = residualFactor(p.implementedControls, a);
        const withoutFactor = residualFactor(without, a);
        totalValueProtected += p.baseAnnualExposure * (withoutFactor - withFactor);
      }
      if (p.gapControls.includes(ctrl)) {
        // Adding this control to apps where it's missing
        totalPotentialAdditional +=
          p.currentAnnualExposure * (a.controlReduction[ctrl] ?? 0);
      }
    }

    const totalGapExposure   = gapApps.reduce(
      (s, p) => s + p.currentAnnualExposure * (a.controlReduction[ctrl] ?? 0), 0
    );
    const estimatedCost      = (a.controlCostPerApp[ctrl] ?? 0) * implemented.length;
    const controlROI         = estimatedCost > 0
      ? Math.round(((totalValueProtected - estimatedCost) / estimatedCost) * 100)
      : 0;
    const coveragePct        = total > 0
      ? Math.round((implemented.length / total) * 100)
      : 0;

    return {
      controlKey:      ctrl,
      controlName:     CONTROL_NAMES[ctrl],
      pillar:          CONTROL_PILLARS[ctrl],
      reductionFactor: a.controlReduction[ctrl],
      appsImplemented: implemented.length,
      appsWithGap:     gapApps.length,
      totalApps:       total,
      coveragePct,
      totalValueProtected:        Math.round(totalValueProtected),
      potentialAdditionalValue:   Math.round(totalPotentialAdditional),
      totalGapExposure:           Math.round(totalGapExposure),
      estimatedAnnualCost:        Math.round(estimatedCost),
      controlROI,
      insight: buildControlInsight(ctrl, implemented.length, gapApps.length, totalValueProtected, totalPotentialAdditional),
    };
  });
}

/**
 * Build the portfolio-level summary.
 */
export function buildPortfolioSummary(
  profiles: AppValueProfile[],
  controlValues: ControlValueProfile[],
  _a: RiskAssumptions = DEFAULT_ASSUMPTIONS
): PortfolioSummary {
  const total       = profiles.length;
  const withCtrls   = profiles.filter(p => p.implementedControls.length > 0).length;
  const covPct      = total > 0 ? Math.round((withCtrls / total) * 100) : 0;

  const sumBase     = profiles.reduce((s, p) => s + p.baseAnnualExposure,         0);
  const sumCurrent  = profiles.reduce((s, p) => s + p.currentAnnualExposure,      0);
  const sumProt     = profiles.reduce((s, p) => s + p.valueProtected,             0);
  const sumGap      = profiles.reduce((s, p) => s + p.gapExposure,                0);
  const sumPotAdd   = profiles.reduce((s, p) => s + p.potentialAdditionalValue,   0);
  const sumCost     = profiles.reduce((s, p) => s + p.estimatedControlCost,       0);

  const roi = sumCost > 0
    ? Math.round(((sumProt - sumCost) / sumCost) * 100)
    : 0;

  const tiers = ['critical', 'high', 'medium', 'low'];
  const byTier: TierValueSummary[] = tiers.map(tier => {
    const tp = profiles.filter(p => p.riskTier === tier);
    const b  = tp.reduce((s, p) => s + p.baseAnnualExposure,    0);
    const c  = tp.reduce((s, p) => s + p.currentAnnualExposure, 0);
    const pr = tp.reduce((s, p) => s + p.valueProtected,        0);
    const g  = tp.reduce((s, p) => s + p.gapExposure,           0);
    return {
      tier, apps: tp.length,
      baseExposure:    Math.round(b),
      currentExposure: Math.round(c),
      valueProtected:  Math.round(pr),
      gapExposure:     Math.round(g),
      reductionPct:    b > 0 ? Math.round((pr / b) * 100) : 0,
    };
  });

  const topRiskApps      = [...profiles].sort((a, b) => b.currentAnnualExposure - a.currentAnnualExposure).slice(0, 5);
  const topValueControls = [...controlValues].sort((a, b) => b.totalValueProtected - a.totalValueProtected);

  return {
    totalApps:          total,
    appsWithAnyControl: withCtrls,
    coveragePct:        covPct,
    totalBaseExposure:             Math.round(sumBase),
    totalCurrentExposure:          Math.round(sumCurrent),
    totalValueProtected:           Math.round(sumProt),
    totalGapExposure:              Math.round(sumGap),
    totalPotentialAdditionalValue: Math.round(sumPotAdd),
    totalEstimatedControlCost:     Math.round(sumCost),
    portfolioROI:                  roi,
    byTier,
    topRiskApps,
    topValueControls,
    insight:     buildPortfolioInsight(sumBase, sumCurrent, sumProt, sumGap, roi, covPct, profiles),
    keyFindings: buildKeyFindings(profiles, controlValues, byTier),
  };
}

/**
 * Simulate a scenario and return delta vs baseline.
 */
export function simulateScenario(
  apps: Application[],
  input: SimulationInput,
  a: RiskAssumptions = DEFAULT_ASSUMPTIONS
): SimulationResult {
  // ── Baseline ──
  const baselines     = computePortfolioValue(apps, a);
  const baseExposure  = baselines.reduce((s, p) => s + p.currentAnnualExposure, 0);
  const baseProt      = baselines.reduce((s, p) => s + p.valueProtected,        0);
  const baseCost      = baselines.reduce((s, p) => s + p.estimatedControlCost,  0);
  const baseROI       = baseCost > 0 ? Math.round(((baseProt - baseCost) / baseCost) * 100) : 0;
  const baseWith      = baselines.filter(p => p.implementedControls.length > 0).length;
  const baseCovPct    = apps.length > 0 ? Math.round((baseWith / apps.length) * 100) : 0;

  // ── Apply scenario changes to a posture copy ──
  const modified: Application[] = apps.map(app => {
    if (!app.iamPosture) return app;
    const p = { ...app.iamPosture };

    for (const change of input.changes) {
      let applies = false;
      if (change.type === 'add-control') {
        if ('applyToTier'   in change) applies = change.applyToTier   === app.riskTier;
        if ('applyToAppIds' in change) applies = (change.applyToAppIds as string[]).includes(app.appId);
        if (applies) applyControl(p, change.control);
      } else if (change.type === 'close-all-gaps') {
        if (change.tier === app.riskTier || change.tier === 'all') {
          ALL_CONTROLS.forEach(ctrl => applyControl(p, ctrl));
        }
      }
    }
    return { ...app, iamPosture: p };
  });

  // ── Simulated ──
  const simulated     = computePortfolioValue(modified, a);
  const simExposure   = simulated.reduce((s, p) => s + p.currentAnnualExposure, 0);
  const simProt       = simulated.reduce((s, p) => s + p.valueProtected,        0);
  const simCost       = simulated.reduce((s, p) => s + p.estimatedControlCost,  0);
  const simROI        = simCost > 0 ? Math.round(((simProt - simCost) / simCost) * 100) : 0;
  const simWith       = simulated.filter(p => p.implementedControls.length > 0).length;
  const simCovPct     = modified.length > 0 ? Math.round((simWith / modified.length) * 100) : 0;

  // ── Affected apps ──
  const affectedApps = simulated
    .filter((sp, i) => sp.currentAnnualExposure < baselines[i].currentAnnualExposure)
    .map(sp => {
      const bl = baselines.find(b => b.appId === sp.appId)!;
      return { appId: sp.appId, appName: sp.appName, saving: Math.round(bl.currentAnnualExposure - sp.currentAnnualExposure) };
    })
    .sort((a, b) => b.saving - a.saving);

  const exposureReduction    = Math.round(baseExposure - simExposure);
  const exposureReductionPct = baseExposure > 0 ? Math.round((exposureReduction / baseExposure) * 100) : 0;

  return {
    scenarioName: input.scenarioName,
    baseline:  { exposure: Math.round(baseExposure), valueProtected: Math.round(baseProt), portfolioROI: baseROI, coveragePct: baseCovPct },
    simulated: { exposure: Math.round(simExposure),  valueProtected: Math.round(simProt),  portfolioROI: simROI,  coveragePct: simCovPct  },
    delta: {
      exposureReduction,
      exposureReductionPct,
      additionalValue:       Math.round(simProt   - baseProt),
      roiImprovement:        simROI - baseROI,
      additionalAppsCovered: simWith - baseWith,
    },
    affectedApps,
    narrative: buildSimNarrative(input.scenarioName, affectedApps.length, exposureReduction, exposureReductionPct, simROI - baseROI),
  };
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function applyControl(p: IamPosture, ctrl: ControlKey): void {
  switch (ctrl) {
    case 'sso':          p.ssoEnabled               = true; break;
    case 'mfa':          p.mfaEnforced               = true; break;
    case 'pam':          p.privilegedAccountsVaulted = true; break;
    case 'jml':          p.jmlAutomated              = true; break;
    case 'scim':         p.scimEnabled               = true; break;
    case 'accessReview': p.certificationsConfigured  = true; break;
  }
}

// ── Narrative builders ────────────────────────────────────────────────────────

function buildControlInsight(ctrl: ControlKey, impl: number, gaps: number, value: number, potential: number): string {
  const name = CONTROL_NAMES[ctrl];
  const total = impl + gaps;
  if (impl === 0)  return `${name} is not deployed on any application. Closing this gap across ${total} apps could protect ${fmt$(value + potential)}/year.`;
  if (gaps === 0)  return `${name} has full portfolio coverage (${total} apps), protecting ${fmt$(value)}/year.`;
  const gapPct = total > 0 ? Math.round((gaps / total) * 100) : 0;
  return `${name} protects ${fmt$(value)}/year across ${impl} apps. Extending to ${gaps} remaining apps (${gapPct}% gap) would add ${fmt$(potential)}/year in risk reduction.`;
}

function buildPortfolioInsight(
  base: number, _current: number, prot: number, gap: number,
  roi: number, covPct: number, profiles: AppValueProfile[]
): string {
  const reductionPct = base > 0 ? Math.round((prot / base) * 100) : 0;
  const uncritical   = profiles.filter(p => p.riskTier === 'critical' && p.implementedControls.length === 0).length;

  let s = `IAM controls have reduced annual portfolio risk exposure by ${reductionPct}%, protecting ${fmt$(prot)} in value against a ${fmt$(base)} base exposure. `;
  if (roi > 0) s += `The estimated portfolio ROI is ${roi}% — controls are delivering ${(roi / 100).toFixed(1)}× return on investment. `;
  if (uncritical > 0) s += `${uncritical} critical application${uncritical > 1 ? 's remain' : ' remains'} completely unprotected — these represent the highest-priority remediation targets. `;
  if (gap > 0) s += `Closing the remaining ${covPct < 100 ? 'control gaps' : 'gaps'} would eliminate a further ${fmt$(gap)}/year in residual exposure.`;
  return s.trim();
}

function buildKeyFindings(
  profiles: AppValueProfile[],
  controls: ControlValueProfile[],
  byTier: TierValueSummary[]
): string[] {
  const findings: string[] = [];

  const critTier = byTier.find(t => t.tier === 'critical');
  if (critTier && critTier.gapExposure > 0)
    findings.push(`Critical-tier gap exposure is ${fmt$(critTier.gapExposure)}/year — the single highest-priority investment area`);

  const mfa = controls.find(c => c.controlKey === 'mfa');
  if (mfa && mfa.appsWithGap > 0)
    findings.push(`MFA is absent on ${mfa.appsWithGap} apps — closing this gap alone saves ${fmt$(mfa.potentialAdditionalValue)}/year`);

  const pam = controls.find(c => c.controlKey === 'pam');
  if (pam && pam.coveragePct < 50)
    findings.push(`PAM coverage is only ${pam.coveragePct}% despite being the highest single-control risk reducer (55% reduction factor)`);

  const zeroCtrls = profiles.filter(p => p.implementedControls.length === 0);
  if (zeroCtrls.length > 0) {
    const exp = zeroCtrls.reduce((s, p) => s + p.baseAnnualExposure, 0);
    findings.push(`${zeroCtrls.length} apps have zero IAM controls — fully exposed to ${fmt$(exp)}/year in risk`);
  }

  const topROI = [...profiles].filter(p => p.roi > 0 && p.roi < 999).sort((a, b) => b.roi - a.roi)[0];
  if (topROI)
    findings.push(`Highest ROI app: ${topROI.appName} at ${topROI.roi}% return on IAM investment`);

  return findings.slice(0, 5);
}

function buildSimNarrative(name: string, n: number, saving: number, pct: number, roiDelta: number): string {
  if (n === 0) return `Scenario "${name}" has no effect — the targeted controls are already fully deployed on the selected applications.`;
  let s = `Applying "${name}" to ${n} application${n > 1 ? 's' : ''} would reduce annual exposure by ${fmt$(saving)} (${pct}% reduction). `;
  if (roiDelta > 0) s += `Portfolio ROI would improve by ${roiDelta} percentage points. `;
  s += `Figures are deterministic estimates based on published control-effectiveness research.`;
  return s;
}
