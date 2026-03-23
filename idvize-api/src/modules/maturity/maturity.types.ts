/**
 * IAM Program Maturity — Core Type Definitions
 *
 * Scoring model:
 *   Evidence → Normalized Indicators → Weighted Domain Score → Overall Score
 *
 * Maturity levels (numeric bands):
 *   0–20  = Initial      (ad-hoc, no formal process)
 *   21–40 = Developing   (recognized need, early implementation)
 *   41–60 = Defined      (documented, consistently applied)
 *   61–80 = Managed      (measured, controlled, predictable)
 *   81–100 = Optimized   (continuously improved, automated)
 */

export type MaturityLevel = 'Initial' | 'Developing' | 'Defined' | 'Managed' | 'Optimized';

export type EvidenceSource =
  | 'document_module'
  | 'cost_module'
  | 'audit_logs'
  | 'approval_workflows'
  | 'scim_provisioning'
  | 'application_cmdb'
  | 'entra_adapter'
  | 'sailpoint_adapter'
  | 'cyberark_adapter'
  | 'okta_adapter'
  | 'integration_status'
  | 'security_policies'
  | 'build_module'
  | 'mock_placeholder';   // used when no live source exists yet

export type EvidenceQuality = 'live' | 'mock' | 'estimated' | 'missing';

// ── Evidence ─────────────────────────────────────────────────────────────────

/** Raw evidence item collected from a source system */
export interface MaturityEvidence {
  evidenceId:   string;
  indicatorId:  string;
  domainId:     string;
  source:       EvidenceSource;
  quality:      EvidenceQuality;
  collectedAt:  string;
  rawValue:     unknown;           // the raw datum from the source
  description:  string;           // human-readable description
  metadata?:    Record<string, unknown>;
}

// ── Indicators ───────────────────────────────────────────────────────────────

/** Normalized indicator: 0–100 score with confidence */
export interface MaturityIndicator {
  indicatorId:   string;
  domainId:      string;
  name:          string;
  description:   string;
  weight:        number;          // 0–1, sum of indicator weights in domain = 1.0
  score:         number;          // 0–100, calculated from evidence
  confidence:    number;          // 0–1; low confidence = uncertain evidence
  evidenceItems: MaturityEvidence[];
  rationale:     string;          // how the score was derived
  sources:       EvidenceSource[];
}

// ── Domains ──────────────────────────────────────────────────────────────────

/** Definition of a maturity domain (static configuration) */
export interface MaturityDomainDefinition {
  domainId:       string;
  name:           string;
  description:    string;
  weight:         number;         // domain weight in overall score (0–1 scale, relative)
  indicatorDefs:  IndicatorDefinition[];
}

export interface IndicatorDefinition {
  indicatorId:  string;
  name:         string;
  description:  string;
  weight:       number;
  sources:      EvidenceSource[];
  // Function signature for evidence → score normalization (handled in NormalizationService)
}

/** Calculated domain result within an assessment run */
export interface MaturityDomainScore {
  domainId:     string;
  name:         string;
  weight:       number;
  score:        number;           // 0–100 weighted average of indicators
  level:        MaturityLevel;
  confidence:   number;           // 0–1
  indicators:   MaturityIndicator[];
  topGaps:      string[];         // top 3 lowest-scoring indicator names
  trend?:       'improving' | 'declining' | 'stable' | 'no_data';
}

// ── Assessment Run ────────────────────────────────────────────────────────────

export interface MaturityScore {
  overall:     number;
  level:       MaturityLevel;
  confidence:  number;
  domains:     MaturityDomainScore[];
}

export interface MaturityRecommendation {
  domainId:    string;
  domainName:  string;
  priority:    'critical' | 'high' | 'medium' | 'low';
  title:       string;
  description: string;
  effort:      'quick_win' | 'medium_term' | 'strategic';
  impact:      number;            // estimated score lift 0–100
}

export interface MaturityExplanation {
  domainId:    string;
  narrative:   string;            // AI-generated explanation
  keyFactors:  string[];          // bullet points
  limitations: string[];          // low-confidence areas
}

export interface MaturityAssessmentRun {
  runId:           string;
  triggeredBy:     string;
  triggeredAt:     string;
  completedAt:     string;
  score:           MaturityScore;
  recommendations: MaturityRecommendation[];
  explanations:    MaturityExplanation[];
  aiNarrative?:    string;        // top-level AI summary
  evidenceCount:   number;
  lowConfidenceCount: number;
}

// ── API response shapes ───────────────────────────────────────────────────────

export interface MaturitySummaryResponse {
  runId:           string;
  overall:         number;
  level:           MaturityLevel;
  confidence:      number;
  triggeredAt:     string;
  domains:         { domainId: string; name: string; score: number; level: MaturityLevel; confidence: number; trend?: string }[];
  topRecommendations: MaturityRecommendation[];
  aiNarrative?:    string;
}
