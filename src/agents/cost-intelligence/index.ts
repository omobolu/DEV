/**
 * IDVIZE Cost Intelligence Agent
 * Ingests contracts and staffing costs, analyzes vendor/partner/staff augmentation impact
 */

import type { BaseAgent, AgentConfig, AgentOutput, AgentHealthStatus } from '../../types/agent'
import { createAgentOutput } from '../../types/agent'
import type { PlatformEvent } from '../../types/events'
import type {
  CostAnalysisOutput,
  CostBreakdown,
  VendorImpact,
  PartnerImpact,
  StaffAugmentationImpact,
  Contract,
  PeopleCost,
  IAMTower,
} from '../../types/cost-intelligence'

const AGENT_CONFIG: AgentConfig = {
  id: 'agent-cost-intelligence',
  domain: 'cost-intelligence',
  name: 'Cost Intelligence Agent',
  description: 'Ingests contracts and staffing costs, analyzes platform/vendor/partner/staff augmentation cost impact, identifies optimization opportunities',
  enabled: true,
  capabilities: [
    {
      name: 'analyze-costs',
      description: 'Analyze IAM cost data for optimization',
      inputEventTypes: ['COST_INPUT_RECEIVED', 'AGENT_TASK_COMPLETED'],
      outputEventTypes: ['AGENT_TASK_COMPLETED'],
    },
  ],
  maxRetries: 2,
  timeoutMs: 20000,
}

export class CostIntelligenceAgent implements BaseAgent {
  readonly config = AGENT_CONFIG
  private processedCount = 0
  private errorCount = 0
  private lastProcessedAt?: string
  private totalProcessingTimeMs = 0

  async initialize(): Promise<void> {}

  canHandle(eventType: string): boolean {
    return this.config.capabilities.some(c => c.inputEventTypes.includes(eventType))
  }

  async process(event: PlatformEvent): Promise<AgentOutput<CostAnalysisOutput>> {
    const startTime = Date.now()

    try {
      const contracts = event.payload.contracts as Contract[] ?? []
      const peopleCosts = event.payload.peopleCosts as PeopleCost[] ?? []

      const costBreakdown = this.calculateCostBreakdown(contracts, peopleCosts)
      const vendorAnalysis = this.analyzeVendors(contracts)
      const partnerAnalysis = this.analyzePartners(contracts)
      const staffAugmentationAnalysis = this.analyzeStaffAugmentation(peopleCosts, contracts)
      const optimizationRecommendations = this.generateOptimizations(costBreakdown, vendorAnalysis, partnerAnalysis)
      const riskAssessment = this.assessRisk(vendorAnalysis, staffAugmentationAnalysis)

      const result: CostAnalysisOutput = {
        totalCost: costBreakdown.totalCost,
        costBreakdown,
        vendorAnalysis,
        partnerAnalysis,
        staffAugmentationAnalysis,
        optimizationRecommendations,
        riskAssessment,
      }

      const processingTimeMs = Date.now() - startTime
      this.processedCount++
      this.lastProcessedAt = new Date().toISOString()
      this.totalProcessingTimeMs += processingTimeMs

      return createAgentOutput<CostAnalysisOutput>(
        this.config.id,
        this.config.domain,
        result,
        {
          confidence: contracts.length > 0 && peopleCosts.length > 0 ? 'high' : 'low',
          assumptions: [
            'Cost analysis based on provided contract and people data',
            'Optimization recommendations use heuristic scoring',
          ],
          warnings: contracts.length === 0 ? ['No contract data provided — analysis may be incomplete'] : [],
          recommendedNextStep: 'Review cost analysis and optimization recommendations with management',
          approvalRequired: false,
          processingTimeMs,
          correlationId: event.correlationId,
        },
      )
    } catch (error) {
      this.errorCount++
      throw error
    }
  }

  getHealth(): AgentHealthStatus {
    return {
      agentId: this.config.id,
      status: this.errorCount > this.processedCount * 0.5 ? 'degraded' : 'healthy',
      lastProcessedAt: this.lastProcessedAt,
      totalProcessed: this.processedCount,
      totalErrors: this.errorCount,
      averageProcessingTimeMs: this.processedCount > 0 ? this.totalProcessingTimeMs / this.processedCount : 0,
    }
  }

  private calculateCostBreakdown(contracts: Contract[], peopleCosts: PeopleCost[]): CostBreakdown {
    const peopleCostTotal = peopleCosts.reduce((sum, p) => sum + p.annualSalary, 0)
    const contractCostTotal = contracts.filter(c => c.status === 'active').reduce((sum, c) => sum + c.annualValue, 0)

    const byIAMTower: Record<IAMTower, number> = { iga: 0, am: 0, pam: 0, ciam: 0, shared: 0 }
    for (const c of contracts) {
      if (c.iamTower && c.status === 'active') {
        byIAMTower[c.iamTower] += c.annualValue
      }
    }
    for (const p of peopleCosts) {
      if (p.iamTower) {
        byIAMTower[p.iamTower] += p.annualSalary
      }
    }

    const byPlatform: Record<string, number> = {}
    for (const c of contracts) {
      if (c.platform && c.status === 'active') {
        byPlatform[c.platform] = (byPlatform[c.platform] ?? 0) + c.annualValue
      }
    }

    const byVendorType: Record<string, number> = {}
    for (const c of contracts) {
      if (c.status === 'active') {
        byVendorType[c.type] = (byVendorType[c.type] ?? 0) + c.annualValue
      }
    }

    return {
      totalCost: peopleCostTotal + contractCostTotal,
      peopleCost: peopleCostTotal,
      contractCost: contractCostTotal,
      byIAMTower,
      byPlatform,
      byVendorType,
    }
  }

  private analyzeVendors(contracts: Contract[]): VendorImpact[] {
    const vendorMap = new Map<string, Contract[]>()
    for (const c of contracts) {
      if (!vendorMap.has(c.vendorId)) vendorMap.set(c.vendorId, [])
      vendorMap.get(c.vendorId)!.push(c)
    }

    return Array.from(vendorMap.entries()).map(([vendorId, vendorContracts]) => {
      const totalCost = vendorContracts.filter(c => c.status === 'active').reduce((s, c) => s + c.annualValue, 0)
      const contractCount = vendorContracts.length
      const hasMultipleTypes = new Set(vendorContracts.map(c => c.type)).size > 1
      const dependencyLevel = totalCost > 500000 ? 'critical' as const : totalCost > 200000 ? 'high' as const : totalCost > 50000 ? 'medium' as const : 'low' as const

      return {
        vendorId,
        vendorName: vendorContracts[0].vendorName,
        vendorType: vendorContracts[0].type,
        totalCost,
        contractCount,
        applicationCount: 0,
        integrationComplexity: hasMultipleTypes ? 'high' as const : 'medium' as const,
        dependencyLevel,
        replaceabilityScore: dependencyLevel === 'critical' ? 20 : dependencyLevel === 'high' ? 40 : 70,
        riskFactors: this.identifyVendorRisks(vendorContracts),
        optimizationOpportunities: this.identifyVendorOptimizations(vendorContracts, totalCost),
      }
    })
  }

  private analyzePartners(contracts: Contract[]): PartnerImpact[] {
    const partnerContracts = contracts.filter(c => c.type === 'implementation')
    const partnerMap = new Map<string, Contract[]>()
    for (const c of partnerContracts) {
      if (!partnerMap.has(c.vendorId)) partnerMap.set(c.vendorId, [])
      partnerMap.get(c.vendorId)!.push(c)
    }

    return Array.from(partnerMap.entries()).map(([partnerId, pContracts]) => ({
      partnerId,
      partnerName: pContracts[0].vendorName,
      totalCost: pContracts.filter(c => c.status === 'active').reduce((s, c) => s + c.annualValue, 0),
      projectCount: pContracts.length,
      efficiency: 'medium' as const,
      qualityScore: 70,
      areasOfExpertise: [...new Set(pContracts.map(c => c.iamTower).filter(Boolean))] as string[],
      recommendations: ['Review partner delivery quality quarterly'],
    }))
  }

  private analyzeStaffAugmentation(peopleCosts: PeopleCost[], _contracts: Contract[]): StaffAugmentationImpact[] {
    const contractors = peopleCosts.filter(p => p.isContractor)
    const providerMap = new Map<string, PeopleCost[]>()
    for (const c of contractors) {
      const vendorId = c.vendorId ?? 'unknown'
      if (!providerMap.has(vendorId)) providerMap.set(vendorId, [])
      providerMap.get(vendorId)!.push(c)
    }

    return Array.from(providerMap.entries()).map(([providerId, staff]) => {
      const totalCost = staff.reduce((s, p) => s + p.annualSalary, 0)
      return {
        providerId,
        providerName: providerId,
        totalCost,
        headcount: staff.length,
        roles: [...new Set(staff.map(s => s.role))],
        dependencyLevel: staff.length > 3 ? 'high' as const : 'medium' as const,
        replaceabilityScore: staff.length > 5 ? 30 : 60,
        recommendations: staff.length > 3
          ? ['Consider knowledge transfer plan to reduce dependency']
          : ['Maintain current staffing level'],
      }
    })
  }

  private identifyVendorRisks(contracts: Contract[]): string[] {
    const risks: string[] = []
    const expiringContracts = contracts.filter(c => {
      if (!c.endDate) return false
      const daysUntilExpiry = (new Date(c.endDate).getTime() - Date.now()) / 86400000
      return daysUntilExpiry < 90 && daysUntilExpiry > 0
    })
    if (expiringContracts.length > 0) risks.push(`${expiringContracts.length} contract(s) expiring within 90 days`)
    if (contracts.length > 3) risks.push('High number of contracts increases management overhead')
    return risks
  }

  private identifyVendorOptimizations(contracts: Contract[], totalCost: number): string[] {
    const optimizations: string[] = []
    if (contracts.length > 2) optimizations.push('Consider contract consolidation for volume discount')
    if (totalCost > 200000) optimizations.push('Review for competitive bidding opportunity')
    return optimizations
  }

  private generateOptimizations(breakdown: CostBreakdown, vendors: VendorImpact[], _partners: PartnerImpact[]): string[] {
    const recommendations: string[] = []

    if (breakdown.peopleCost > breakdown.contractCost * 2) {
      recommendations.push('People costs significantly exceed contract costs — evaluate automation opportunities')
    }

    const highDependencyVendors = vendors.filter(v => v.dependencyLevel === 'critical' || v.dependencyLevel === 'high')
    if (highDependencyVendors.length > 0) {
      recommendations.push(`${highDependencyVendors.length} vendor(s) with high dependency — develop contingency plans`)
    }

    for (const vendor of vendors) {
      recommendations.push(...vendor.optimizationOpportunities)
    }

    return recommendations
  }

  private assessRisk(vendors: VendorImpact[], staffAug: StaffAugmentationImpact[]): string {
    const criticalVendors = vendors.filter(v => v.dependencyLevel === 'critical').length
    const highDependencyStaff = staffAug.filter(s => s.dependencyLevel === 'high').length

    if (criticalVendors > 0 && highDependencyStaff > 0) {
      return 'HIGH — Critical vendor dependencies and high staff augmentation dependency detected'
    }
    if (criticalVendors > 0 || highDependencyStaff > 0) {
      return 'MEDIUM — Some concentration risk identified'
    }
    return 'LOW — Well-distributed vendor and staffing portfolio'
  }
}
