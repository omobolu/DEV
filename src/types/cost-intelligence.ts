/**
 * IDVIZE Platform Cost Intelligence Types
 * Module 5: IAM Cost, Capacity, Value, and Vendor Impact Intelligence
 */

export type IAMTower = 'iga' | 'am' | 'pam' | 'ciam' | 'shared'

export interface Vendor {
  id: string
  name: string
  type: 'platform' | 'application' | 'implementation_partner' | 'staff_augmentation'
  contactName?: string
  contactEmail?: string
  website?: string
  notes?: string
}

export interface Contract {
  id: string
  vendorId: string
  vendorName: string
  type: 'license' | 'support' | 'implementation' | 'staff_augmentation' | 'training' | 'consulting'
  title: string
  startDate: string
  endDate: string
  annualValue: number
  totalValue: number
  iamTower?: IAMTower
  platform?: string
  status: 'active' | 'expiring' | 'expired' | 'pending'
  renewalDate?: string
  notes?: string
}

export interface PeopleCost {
  id: string
  role: 'architect' | 'engineer' | 'analyst' | 'project_manager' | 'manager' | 'developer'
  title: string
  annualSalary: number
  iamTower?: IAMTower
  isContractor: boolean
  vendorId?: string
  startDate: string
  endDate?: string
}

export interface VendorImpact {
  vendorId: string
  vendorName: string
  vendorType: string
  totalCost: number
  contractCount: number
  applicationCount: number
  integrationComplexity: 'low' | 'medium' | 'high'
  dependencyLevel: 'low' | 'medium' | 'high' | 'critical'
  replaceabilityScore: number // 0-100
  riskFactors: string[]
  optimizationOpportunities: string[]
}

export interface PartnerImpact {
  partnerId: string
  partnerName: string
  totalCost: number
  projectCount: number
  efficiency: 'low' | 'medium' | 'high'
  qualityScore: number // 0-100
  areasOfExpertise: string[]
  recommendations: string[]
}

export interface StaffAugmentationImpact {
  providerId: string
  providerName: string
  totalCost: number
  headcount: number
  roles: string[]
  dependencyLevel: 'low' | 'medium' | 'high'
  replaceabilityScore: number // 0-100
  recommendations: string[]
}

export interface CostBreakdown {
  totalCost: number
  peopleCost: number
  contractCost: number
  byIAMTower: Record<IAMTower, number>
  byPlatform: Record<string, number>
  byVendorType: Record<string, number>
}

export interface CostAnalysisOutput {
  totalCost: number
  costBreakdown: CostBreakdown
  vendorAnalysis: VendorImpact[]
  partnerAnalysis: PartnerImpact[]
  staffAugmentationAnalysis: StaffAugmentationImpact[]
  optimizationRecommendations: string[]
  riskAssessment: string
}

export interface CostSummaryStats {
  totalAnnualCost: number
  peopleCostPercentage: number
  contractCostPercentage: number
  topVendorByCost: string
  contractsExpiringIn90Days: number
  optimizationPotential: number
}
