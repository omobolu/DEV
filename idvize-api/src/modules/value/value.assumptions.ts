import { RiskAssumptions } from './value.types';

/**
 * Default risk assumptions for Module 10: Business Value & Risk Intelligence.
 *
 * All values are based on published industry research. Every assumption is
 * explicitly documented so results can be challenged and recalibrated.
 *
 * Sources:
 *   IBM Cost of a Data Breach Report 2024     — global avg $4.88M, US avg $9.36M
 *   Verizon DBIR 2024                         — 80 %+ of breaches involve identity
 *   CISA MFA Guidance 2024                    — MFA prevents 99 % of automated attacks
 *   Gartner IAM ROI Framework 2023            — PAM delivers 200–400 % ROI
 *   NIST SP 800-207 Zero Trust Architecture   — MFA + PAM + JML as baseline controls
 *   Ponemon Institute PAM Study 2023          — PAM reduces insider threat by 55 %
 *
 * Monetary values: USD. Probabilities: annual (0–1).
 * Reduction factors: multiplicative. 0.50 means "removes 50 % of remaining risk",
 * not 50 percentage points — combining MFA (0.50) + PAM (0.55) reduces to
 * (1-0.50)×(1-0.55) = 0.225 of baseline, i.e. a 77.5 % overall reduction.
 */
export const DEFAULT_ASSUMPTIONS: RiskAssumptions = {
  version: '1.0.0',
  sources: [
    'IBM Cost of a Data Breach Report 2024',
    'Verizon DBIR 2024',
    'CISA MFA Guidance 2024',
    'Gartner IAM ROI Framework 2023',
    'NIST SP 800-207 Zero Trust Architecture',
    'Ponemon Institute PAM Study 2023',
  ],

  // ── Annual incident probability (uncovered application) ──────────────────
  // Critical: highly targeted, stores regulated/financial data, large user base
  // Low: internal tooling, low data value, limited external exposure
  incidentProbability: {
    critical: 0.35,  // 35 %
    high:     0.20,  // 20 %
    medium:   0.10,  // 10 %
    low:      0.04,  //  4 %
  },

  // ── Financial impact per incident ($) ────────────────────────────────────
  // Derived from IBM 2024 + scaled by application criticality tier.
  // Represents total incident cost: detection, response, legal, regulatory,
  // reputational damage, and business disruption — not enterprise-wide breach.
  incidentImpact: {
    critical:  4_800_000,   // $4.8 M — enterprise-critical system
    high:      1_350_000,   // $1.35 M — significant business system
    medium:      420_000,   // $420 K — internal contained breach
    low:          95_000,   // $95 K — minor incident
  },

  // ── Control risk-reduction factors ────────────────────────────────────────
  // Applied multiplicatively to the remaining risk after all preceding controls.
  // Basis: published studies on each control's measured effectiveness.
  controlReduction: {
    sso:          0.20,  // Eliminates credential sprawl, reduces phishing surface
    mfa:          0.50,  // CISA: prevents 99 % automated; modelled conservatively at 50 %
    pam:          0.55,  // Ponemon: 55 % insider-threat and lateral-movement reduction
    jml:          0.20,  // Removes orphaned accounts from attack surface
    scim:         0.15,  // Closes over-provisioning and provisioning-gap risk
    accessReview: 0.22,  // Excess-privilege remediation, SoD enforcement
  },

  // ── Annual cost per app per deployed control ($) ──────────────────────────
  // Blended estimate: licensing prorated per app + integration + operational effort.
  // Used for ROI calculation only — not a procurement benchmark.
  controlCostPerApp: {
    sso:            2_500,  // SSO connector + IdP licensing allocation
    mfa:            3_200,  // MFA enforcement policy + licensing
    pam:           18_000,  // Session recording, vaulting, rotation operations
    jml:            4_500,  // JML workflow automation + connector
    scim:           3_800,  // SCIM provisioner + connector maintenance
    accessReview:   2_800,  // Annual certification campaign per application
  },

  // ── User-population sensitivity ───────────────────────────────────────────
  // Log₁₀ scale: multiplier is neutral at userScaleBase users.
  //   100 users  → 1.00× (neutral)
  //   1 000 users → 1.15×
  //   10 000 users → 1.30×
  //   50 000 users → 1.42×
  userScaleFactor: 0.15,
  userScaleBase:   100,
};
