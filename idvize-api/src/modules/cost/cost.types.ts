// ─── Module 5: IAM Cost, Capacity, and Vendor Intelligence ───────────────────
// Full type definitions for vendors, contracts, people, cost analysis

// ── Vendor Types ──────────────────────────────────────────────────────────────

export type VendorType =
  | 'application'       // Enterprise app vendors (SAP, Salesforce, etc.)
  | 'iam_platform'      // IAM tools (SailPoint, Entra, CyberArk, Okta)
  | 'implementation_partner'  // SIs, consultancies
  | 'staff_augmentation';     // Contractors, offshore, MSPs

export type SupportedStandard = 'SAML' | 'OIDC' | 'SCIM' | 'REST' | 'LDAP' | 'RADIUS' | 'NONE';

export type IntegrationComplexity = 'native' | 'standard' | 'custom' | 'manual' | 'unknown';
// native  = plug-and-play gallery app
// standard = documented API/SCIM/SAML
// custom  = scripted connector or heavy config
// manual  = spreadsheet / helpdesk driven

export type VendorRiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface Vendor {
  vendorId: string;
  name: string;
  type: VendorType;
  category?: string;              // e.g. 'CRM', 'ERP', 'ITSM', 'PAM', 'IGA'
  supportedStandards: SupportedStandard[];
  integrationComplexity: IntegrationComplexity;
  apiMaturity: 1 | 2 | 3 | 4 | 5;  // 1=none, 5=full REST with webhooks
  documentationQuality: 1 | 2 | 3 | 4 | 5;
  marketPresence: 'dominant' | 'major' | 'niche' | 'legacy';
  website?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── Contract Types ────────────────────────────────────────────────────────────

export type ServiceType =
  | 'software_license'
  | 'saas_subscription'
  | 'support_maintenance'
  | 'professional_services'
  | 'managed_service'
  | 'staff_augmentation'
  | 'training'
  | 'infrastructure';

export type ContractStatus = 'active' | 'expired' | 'pending_renewal' | 'terminated';

export interface Contract {
  contractId: string;
  vendorId: string;
  vendorName: string;               // Denormalized for query convenience
  serviceType: ServiceType;
  description: string;
  annualCost: number;               // USD
  totalContractValue?: number;
  currency: string;
  startDate: string;
  endDate: string;
  autoRenew: boolean;
  status: ContractStatus;
  owner: string;                    // Internal contract owner
  tags: string[];
  linkedAppIds?: string[];          // Applications this contract covers
  linkedPlatforms?: string[];       // IAM platforms this covers
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ── People Cost Types ─────────────────────────────────────────────────────────

export type EmploymentType = 'fte' | 'contractor' | 'offshore' | 'managed_service';
export type IamRole =
  | 'iam_architect'
  | 'iam_engineer'
  | 'iga_specialist'
  | 'pam_specialist'
  | 'am_specialist'
  | 'ciam_specialist'
  | 'iam_analyst'
  | 'iam_manager'
  | 'iam_director'
  | 'security_analyst'
  | 'helpdesk';

export interface PersonCost {
  personId: string;
  name: string;
  role: IamRole;
  employmentType: EmploymentType;
  vendorId?: string;              // If contractor/offshore, link to vendor
  annualCost: number;             // Fully loaded cost (salary + benefits + overhead)
  fteEquivalent: number;          // 1.0 = full time, 0.5 = half time
  primaryPlatforms: string[];     // ['SailPoint', 'Entra', etc.]
  hoursPerWeek: number;
  utilization: number;            // 0–100%
  createdAt: string;
}

// ── Vendor Impact Analysis ────────────────────────────────────────────────────

export interface VendorImpact {
  vendorId: string;
  vendorName: string;
  vendorType: VendorType;

  // Cost
  totalAnnualCost: number;
  contractCount: number;
  costTrend?: 'increasing' | 'stable' | 'decreasing';

  // Dependency
  numberOfAppsSupported: number;  // Apps from this vendor in the inventory
  numberOfPlatformsCovered: number; // IAM platforms this vendor enables/replaces
  dependencyScore: number;        // 0–100 (100 = can't function without them)
  switchingComplexity: 'low' | 'medium' | 'high' | 'very_high';
  switchingCostEstimate?: number;

  // Integration
  averageIntegrationComplexity: IntegrationComplexity;
  standardsSupported: SupportedStandard[];
  customBuildRequired: boolean;
  integrationScore: number;       // 0–100 (100 = fully standardized, easy)

  // Efficiency
  costPerApp: number;             // totalCost / numberOfApps
  ticketsPerApp?: number;
  onboardingSpeedDays?: number;
  efficiencyScore: number;        // 0–100 (100 = highest efficiency)

  // Risk
  riskLevel: VendorRiskLevel;
  riskScore: number;              // 0–100
  riskFactors: string[];

  // Recommendations
  recommendations: VendorRecommendation[];

  evaluatedAt: string;
}

export interface VendorRecommendation {
  type: 'consolidate' | 'replace' | 'renegotiate' | 'standardize' | 'reduce_dependency' | 'invest';
  priority: 'immediate' | 'high' | 'medium' | 'low';
  description: string;
  estimatedSaving?: number;
  confidence: number;   // 0–100
  rationale: string;
  assumptions: string[];
}

// ── Implementation Partner ────────────────────────────────────────────────────

export interface PartnerAnalysis {
  vendorId: string;
  partnerName: string;
  totalAnnualCost: number;
  integrationsDelivered: number;
  avgTimeToDeliverDays: number;
  reworkRate: number;             // 0–100% (% of deliverables needing rework)
  costPerIntegration: number;
  dependencyScore: number;        // How reliant the org is on this partner
  internalCapabilityGap: number;  // 0–100 (100 = org can't do this without them)
  efficiencyScore: number;
  riskScore: number;
  recommendations: VendorRecommendation[];
}

// ── Staff Augmentation ────────────────────────────────────────────────────────

export interface StaffAugAnalysis {
  vendorId?: string;
  category: 'contractor' | 'offshore' | 'managed_service';
  headcount: number;
  totalAnnualCost: number;
  fteEquivalent: number;
  avgCostPerPerson: number;
  fteCostComparison: number;      // FTE equivalent annual cost
  costPremium: number;            // % premium over FTE (can be negative = cheaper)
  workloadHandled: number;        // % of total IAM workload
  replaceabilityScore: number;    // 0–100 (100 = easily replaceable)
  relianceRisk: 'critical' | 'high' | 'medium' | 'low';
  recommendations: VendorRecommendation[];
}

// ── Cost Summary ──────────────────────────────────────────────────────────────

export interface CostBreakdown {
  people: {
    fte: number;
    contractors: number;
    offshore: number;
    managedService: number;
    total: number;
  };
  technology: {
    iamPlatforms: number;
    applicationVendors: number;    // costs attributable to IAM work per app vendor
    infrastructure: number;
    total: number;
  };
  partners: {
    implementationPartners: number;
    total: number;
  };
  total: number;
}

export interface CostSummary {
  totalAnnualCost: number;
  breakdown: CostBreakdown;
  costPerApp: number;
  costPerIdentity: number;
  costPerTicket?: number;
  headcount: {
    totalFte: number;
    contractors: number;
    offshore: number;
    managedService: number;
  };
  contractCount: number;
  vendorCount: number;
  topCostDrivers: CostDriver[];
  generatedAt: string;
}

export interface CostDriver {
  category: string;
  name: string;
  annualCost: number;
  percentOfTotal: number;
  trend?: 'increasing' | 'stable' | 'decreasing';
}

// ── Optimization ──────────────────────────────────────────────────────────────

export interface OptimizationOpportunity {
  opportunityId: string;
  type: 'vendor_consolidation' | 'vendor_replacement' | 'standardize_integration' |
        'reduce_partner_dependency' | 'contractor_to_fte' | 'renegotiate_contract' |
        'eliminate_redundancy' | 'automate_process';
  title: string;
  description: string;
  estimatedAnnualSaving: number;
  implementationCost?: number;
  netBenefit?: number;
  paybackMonths?: number;
  priority: 'immediate' | 'high' | 'medium' | 'low';
  effort: 'low' | 'medium' | 'high';
  confidence: number;       // 0–100
  rationale: string;
  assumptions: string[];
  affectedVendors?: string[];
  affectedApps?: string[];
}

export interface OptimizationReport {
  totalPotentialSaving: number;
  opportunities: OptimizationOpportunity[];
  quickWins: OptimizationOpportunity[];   // High saving, low effort
  strategicMoves: OptimizationOpportunity[];
  generatedAt: string;
}

// ── Agent Output ──────────────────────────────────────────────────────────────

export interface CostIntelligenceReport {
  reportId: string;
  summary: CostSummary;
  vendorAnalysis: VendorImpact[];
  partnerAnalysis: PartnerAnalysis[];
  staffAugAnalysis: StaffAugAnalysis[];
  optimizationReport: OptimizationReport;
  riskAssessment: {
    overallRisk: VendorRiskLevel;
    topRisks: { risk: string; severity: VendorRiskLevel; mitigation: string }[];
  };
  generatedAt: string;
  generatedBy: 'cost-intelligence-agent';
}
