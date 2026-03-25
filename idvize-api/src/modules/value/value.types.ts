// ─── Module 10: Business Value & Risk Intelligence ───────────────────────────

export type ControlKey = 'sso' | 'mfa' | 'pam' | 'jml' | 'scim' | 'accessReview';

// ── Risk assumptions (fully configurable) ─────────────────────────────────────

export interface RiskAssumptions {
  version: string;
  sources: string[];

  // Annual probability a security incident affects an app (0–1)
  incidentProbability: {
    critical: number;
    high:     number;
    medium:   number;
    low:      number;
  };

  // Financial impact per incident by tier ($)
  incidentImpact: {
    critical: number;
    high:     number;
    medium:   number;
    low:      number;
  };

  // Risk reduction factor per control (0–1, applied multiplicatively)
  controlReduction: Record<ControlKey, number>;

  // Estimated annual cost per deployed instance of each control ($)
  controlCostPerApp: Record<ControlKey, number>;

  // Log-scale user-population sensitivity (neutral at userScaleBase users)
  userScaleFactor: number;
  userScaleBase:   number;
}

// ── Per-application value profile ─────────────────────────────────────────────

export interface AppValueProfile {
  appId:      string;
  appName:    string;
  riskTier:   string;
  department: string;
  dataClassification: string;
  userPopulation: number;

  // Exposure ($)
  baseAnnualExposure:         number; // no controls
  currentAnnualExposure:      number; // with current controls
  valueProtected:             number; // base − current
  reductionPct:               number; // 0–100 %
  gapExposure:                number; // removable by closing gaps
  potentialAdditionalValue:   number; // value if all gaps closed
  potentialFullProtection:    number; // value at 100 % coverage

  // Controls
  implementedControls: ControlKey[];
  gapControls:         ControlKey[];

  // Cost & ROI
  estimatedControlCost: number;
  roi:                  number; // %
}

// ── Per-control portfolio value ────────────────────────────────────────────────

export interface ControlValueProfile {
  controlKey:      ControlKey;
  controlName:     string;
  pillar:          string;
  reductionFactor: number;

  appsImplemented: number;
  appsWithGap:     number;
  totalApps:       number;
  coveragePct:     number;

  totalValueProtected:        number;
  potentialAdditionalValue:   number;
  totalGapExposure:           number;
  estimatedAnnualCost:        number;
  controlROI:                 number;
  insight:                    string;
}

// ── Portfolio-level summary ────────────────────────────────────────────────────

export interface TierValueSummary {
  tier:            string;
  apps:            number;
  baseExposure:    number;
  currentExposure: number;
  valueProtected:  number;
  gapExposure:     number;
  reductionPct:    number;
}

export interface PortfolioSummary {
  totalApps:          number;
  appsWithAnyControl: number;
  coveragePct:        number;

  totalBaseExposure:              number;
  totalCurrentExposure:           number;
  totalValueProtected:            number;
  totalGapExposure:               number;
  totalPotentialAdditionalValue:  number;
  totalEstimatedControlCost:      number;
  portfolioROI:                   number;

  byTier:           TierValueSummary[];
  topRiskApps:      AppValueProfile[];
  topValueControls: ControlValueProfile[];

  insight:      string;
  keyFindings:  string[];
}

// ── Simulation ────────────────────────────────────────────────────────────────

export type SimulationChange =
  | { type: 'add-control'; control: ControlKey; applyToTier: string }
  | { type: 'add-control'; control: ControlKey; applyToAppIds: string[] }
  | { type: 'close-all-gaps'; tier: string };

export interface SimulationInput {
  scenarioName: string;
  changes:      SimulationChange[];
}

export interface SimulationResult {
  scenarioName: string;
  baseline: {
    exposure:       number;
    valueProtected: number;
    portfolioROI:   number;
    coveragePct:    number;
  };
  simulated: {
    exposure:       number;
    valueProtected: number;
    portfolioROI:   number;
    coveragePct:    number;
  };
  delta: {
    exposureReduction:     number;
    exposureReductionPct:  number;
    additionalValue:       number;
    roiImprovement:        number;
    additionalAppsCovered: number;
  };
  affectedApps: Array<{ appId: string; appName: string; saving: number }>;
  narrative: string;
}
