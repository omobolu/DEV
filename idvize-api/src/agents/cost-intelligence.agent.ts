import { v4 as uuidv4 } from 'uuid';
import {
  CostIntelligenceReport, VendorImpact, PartnerAnalysis, StaffAugAnalysis,
  VendorRiskLevel,
} from '../modules/cost/cost.types';
import { costAggregationEngine } from '../modules/cost/engines/cost-aggregation.engine';
import { vendorImpactEngine } from '../modules/cost/engines/vendor-impact.engine';
import { optimizationEngine } from '../modules/cost/engines/optimization.engine';
import { vendorRepository } from '../modules/cost/repositories/vendor.repository';
import { contractRepository } from '../modules/cost/repositories/contract.repository';
import { peopleRepository } from '../modules/cost/repositories/people.repository';
import { runClaudeAnalysis, type ClaudeAnalysisResult } from '../services/claude.service';
import type { Tool } from '@anthropic-ai/sdk/resources/messages';

export interface CostAiAnalysis {
  reportId: string;
  generatedAt: string;
  baseReport: CostIntelligenceReport;
  narrative: string;
  thinking?: string;
  usage: { inputTokens: number; outputTokens: number; model: string };
}

/**
 * Cost Intelligence Agent
 *
 * Orchestrates cost aggregation, vendor analysis, partner analysis,
 * staff augmentation analysis, and optimization recommendations.
 *
 * This agent sits above the engines and produces the full
 * CostIntelligenceReport that answers:
 *   "Which vendors, partners, and staffing models are driving cost,
 *    risk, and inefficiency in IAM?"
 *
 * Phase 2: Will use Claude API tool-use to reason over data and
 * produce natural language analysis and novel recommendations.
 */
export class CostIntelligenceAgent {
  private lastReportByTenant = new Map<string, CostIntelligenceReport>();
  private lastRunAtByTenant = new Map<string, string>();

  /**
   * Run a full cost intelligence analysis.
   * Orchestrates all sub-engines and assembles the report.
   */
  async run(tenantId: string): Promise<CostIntelligenceReport> {
    console.log('[CostIntelligenceAgent] Starting cost intelligence analysis...');

    // ── Step 1: Aggregate all costs ──────────────────────────────────────────
    const summary = costAggregationEngine.compute(tenantId);
    console.log(`[CostIntelligenceAgent] Total IAM cost: $${summary.totalAnnualCost.toLocaleString()}`);

    // ── Step 2: Vendor impact analysis ───────────────────────────────────────
    const allVendorImpacts = vendorImpactEngine.analyzeAll(tenantId);
    console.log(`[CostIntelligenceAgent] Analyzed ${allVendorImpacts.length} vendors`);

    // ── Step 3: Partition by vendor type ─────────────────────────────────────
    const partnerImpacts = allVendorImpacts.filter(v => v.vendorType === 'implementation_partner');
    const staffAugImpacts = allVendorImpacts.filter(v => v.vendorType === 'staff_augmentation');

    const partnerAnalysis: PartnerAnalysis[] = partnerImpacts.map(p =>
      this.buildPartnerAnalysis(tenantId, p)
    );

    const staffAugAnalysis: StaffAugAnalysis[] = staffAugImpacts.map(s =>
      this.buildStaffAugAnalysis(tenantId, s)
    );

    // ── Step 4: Optimization recommendations ─────────────────────────────────
    const optimizationReport = optimizationEngine.generate(tenantId, allVendorImpacts);
    console.log(`[CostIntelligenceAgent] ${optimizationReport.opportunities.length} optimization opportunities identified`);
    console.log(`[CostIntelligenceAgent] Total potential saving: $${optimizationReport.totalPotentialSaving.toLocaleString()}`);

    // ── Step 5: Risk assessment ───────────────────────────────────────────────
    const riskAssessment = this.assessRisk(allVendorImpacts, summary);

    // ── Step 6: Assemble report ───────────────────────────────────────────────
    const report: CostIntelligenceReport = {
      reportId: uuidv4(),
      summary,
      vendorAnalysis: allVendorImpacts,
      partnerAnalysis,
      staffAugAnalysis,
      optimizationReport,
      riskAssessment,
      generatedAt: new Date().toISOString(),
      generatedBy: 'cost-intelligence-agent',
    };

    this.lastReportByTenant.set(tenantId, report);
    this.lastRunAtByTenant.set(tenantId, report.generatedAt);

    console.log(`[CostIntelligenceAgent] Report ${report.reportId} complete.`);
    return report;
  }

  getLastReport(tenantId: string): CostIntelligenceReport | null {
    return this.lastReportByTenant.get(tenantId) ?? null;
  }

  getStatus(tenantId: string) {
    const report = this.lastReportByTenant.get(tenantId) ?? null;
    return {
      agent: 'CostIntelligenceAgent',
      lastRunAt: this.lastRunAtByTenant.get(tenantId) ?? null,
      hasReport: report !== null,
      reportId: report?.reportId ?? null,
      dataSnapshot: {
        vendors: vendorRepository.count(tenantId),
        contracts: contractRepository.count(tenantId),
        people: peopleRepository.count(tenantId),
      },
    };
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private buildPartnerAnalysis(tenantId: string, impact: VendorImpact): PartnerAnalysis {
    const contracts = contractRepository.findByVendor(tenantId, impact.vendorId).filter(c => c.status === 'active');
    const builds = []; // Will pull from build module once integrated

    // Heuristic: estimate deliverables from contract description keywords
    const integrationsDelivered = contracts.reduce((sum, c) => {
      const match = c.description.match(/(\d+)\s+(app|integration|onboard)/i);
      return sum + (match ? parseInt(match[1]) : 5); // default 5 if not extractable
    }, 0);

    const avgTimeToDeliver = impact.integrationScore > 60 ? 15 : impact.integrationScore > 40 ? 25 : 45;
    const reworkRate = impact.integrationScore > 70 ? 5 : impact.integrationScore > 50 ? 12 : 20;
    const costPerIntegration = integrationsDelivered > 0
      ? Math.round(impact.totalAnnualCost / integrationsDelivered)
      : impact.totalAnnualCost;

    const internalGap = impact.dependencyScore > 70 ? 80 : impact.dependencyScore > 50 ? 60 : 40;

    return {
      vendorId: impact.vendorId,
      partnerName: impact.vendorName,
      totalAnnualCost: impact.totalAnnualCost,
      integrationsDelivered,
      avgTimeToDeliverDays: avgTimeToDeliver,
      reworkRate,
      costPerIntegration,
      dependencyScore: impact.dependencyScore,
      internalCapabilityGap: internalGap,
      efficiencyScore: impact.efficiencyScore,
      riskScore: impact.riskScore,
      recommendations: impact.recommendations,
    };
  }

  private buildStaffAugAnalysis(tenantId: string, impact: VendorImpact): StaffAugAnalysis {
    const people = peopleRepository.findByVendor(tenantId, impact.vendorId);
    const headcount = people.length;
    const fteEquiv = people.reduce((s, p) => s + p.fteEquivalent, 0);

    // Internal FTE benchmark cost
    const internalFtes = peopleRepository.findByType(tenantId, 'fte');
    const avgFteCost = internalFtes.length > 0
      ? internalFtes.reduce((s, p) => s + p.annualCost, 0) / internalFtes.length
      : 135000;

    const fteCostComparison = avgFteCost * fteEquiv;
    const costPremium = fteCostComparison > 0
      ? Math.round(((impact.totalAnnualCost - fteCostComparison) / fteCostComparison) * 100)
      : 0;

    const workloadHandled = Math.round((fteEquiv / (internalFtes.length + fteEquiv)) * 100);
    const replaceabilityScore = impact.integrationScore > 60 ? 70 : 40;
    const relianceRisk: VendorRiskLevel =
      workloadHandled > 50 ? 'critical' :
      workloadHandled > 35 ? 'high' :
      workloadHandled > 20 ? 'medium' : 'low';

    return {
      vendorId: impact.vendorId,
      category: impact.vendorType === 'staff_augmentation' ? 'managed_service' : 'contractor',
      headcount,
      totalAnnualCost: impact.totalAnnualCost,
      fteEquivalent: fteEquiv,
      avgCostPerPerson: headcount > 0 ? Math.round(impact.totalAnnualCost / headcount) : 0,
      fteCostComparison,
      costPremium,
      workloadHandled,
      replaceabilityScore,
      relianceRisk,
      recommendations: impact.recommendations,
    };
  }

  private assessRisk(impacts: VendorImpact[], summary: ReturnType<typeof costAggregationEngine.compute>) {
    const criticalVendors = impacts.filter(i => i.riskLevel === 'critical');
    const highVendors = impacts.filter(i => i.riskLevel === 'high');

    const topRisks = [
      ...criticalVendors.map(v => ({
        risk: `${v.vendorName}: Critical vendor dependency (risk score ${v.riskScore}/100)`,
        severity: 'critical' as VendorRiskLevel,
        mitigation: v.recommendations[0]?.description ?? 'Develop vendor risk mitigation plan',
      })),
      ...highVendors.map(v => ({
        risk: `${v.vendorName}: High dependency or cost concentration`,
        severity: 'high' as VendorRiskLevel,
        mitigation: v.recommendations[0]?.description ?? 'Review vendor performance and alternatives',
      })),
    ].slice(0, 5);

    // Staffing concentration risk
    const contractorPct = (summary.breakdown.people.contractors / summary.breakdown.people.total) * 100;
    if (contractorPct > 30) {
      topRisks.push({
        risk: `High contractor dependency — ${Math.round(contractorPct)}% of people cost is external contractors`,
        severity: 'high',
        mitigation: 'Evaluate FTE conversion for long-term contractor relationships',
      });
    }

    const overallRisk: VendorRiskLevel = criticalVendors.length > 0 ? 'critical'
      : highVendors.length >= 2 ? 'high'
      : highVendors.length === 1 ? 'medium'
      : 'low';

    return { overallRisk, topRisks };
  }

  /**
   * AI-enhanced analysis — runs the deterministic report first, then calls
   * Claude with tool access to reason over the data and produce a narrative.
   */
  async runWithAI(tenantId: string, excludeSections?: { optimization?: boolean; staffAug?: boolean }): Promise<CostAiAnalysis> {
    console.log('[CostIntelligenceAgent] Starting AI-enhanced cost analysis...');

    // Always run the deterministic analysis first so Claude has real data
    const baseReport = await this.run(tenantId);

    const tools: Tool[] = [
      {
        name: 'get_cost_summary',
        description: 'Get the total IAM cost broken down by category (people, tech, partners).',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      {
        name: 'get_vendor_impacts',
        description: 'Get all vendor impact analyses including risk scores, efficiency, and recommendations.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      ...(!excludeSections?.optimization ? [{
        name: 'get_optimization_opportunities',
        description: 'Get all identified cost optimization opportunities with estimated savings.',
        input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
      }] : []),
      {
        name: 'get_risk_assessment',
        description: 'Get the overall risk assessment including top risks and severity.',
        input_schema: { type: 'object' as const, properties: {}, required: [] },
      },
      ...(!excludeSections?.staffAug ? [{
        name: 'get_staff_aug_analysis',
        description: 'Get staff augmentation analysis comparing contractor costs to FTE benchmarks.',
        input_schema: { type: 'object' as const, properties: {}, required: [] as string[] },
      }] : []),
    ];

    const toolHandlers: Record<string, () => unknown> = {
      get_cost_summary: () => baseReport.summary,
      get_vendor_impacts: () => baseReport.vendorAnalysis,
      get_risk_assessment: () => baseReport.riskAssessment,
      ...(!excludeSections?.optimization ? { get_optimization_opportunities: () => baseReport.optimizationReport } : {}),
      ...(!excludeSections?.staffAug ? { get_staff_aug_analysis: () => baseReport.staffAugAnalysis } : {}),
    };

    const systemPrompt = `You are an expert IAM (Identity and Access Management) financial analyst and vendor strategist.
You have access to real IAM platform cost data through tool calls. Your job is to produce a concise, executive-level
analysis that identifies patterns, highlights risks, and recommends novel actions that a typical deterministic system
would miss. Focus on: vendor concentration risk, hidden cost drivers, build-vs-buy decisions, and specific optimization
moves with estimated ROI. Be direct, quantitative where possible, and prioritise by business impact.`;

    const availableData = ['cost summary', 'vendor impacts', 'risk assessment'];
    if (!excludeSections?.optimization) availableData.push('optimization opportunities');
    if (!excludeSections?.staffAug) availableData.push('staff augmentation data');

    const sections = [
      '1. **Financial Health Overview** — total spend, biggest cost buckets, year-on-year trajectory signals',
      '2. **Vendor & Partner Risk** — concentration risks, underperforming vendors, dependency red flags',
    ];
    if (!excludeSections?.staffAug) {
      sections.push('3. **Staff Augmentation Assessment** — contractor vs FTE cost premium, key reliance risks');
    }
    if (!excludeSections?.optimization) {
      sections.push(`${sections.length + 1}. **Top Optimization Moves** — specific, actionable recommendations with estimated savings or risk reduction`);
    }
    sections.push(`${sections.length + 1}. **Strategic Recommendations** — 2–3 longer-horizon recommendations for the IAM investment strategy`);

    const userPrompt = `Analyse the current IAM cost intelligence data for our platform.
Use the available tools to inspect the ${availableData.join(', ')}. Then produce a structured executive narrative covering:

${sections.join('\n')}

Be specific about vendor names, dollar amounts, and risk scores from the data.`;

    let aiResult: ClaudeAnalysisResult;
    try {
      aiResult = await runClaudeAnalysis(
        systemPrompt,
        userPrompt,
        tools,
        toolHandlers as Record<string, (input: Record<string, unknown>) => unknown>,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const fallbackParts = [`${baseReport.vendorAnalysis.length} vendors analysed`];
      if (!excludeSections?.optimization) {
        fallbackParts.push(`${baseReport.optimizationReport.opportunities.length} optimization opportunities identified`);
      }
      aiResult = {
        narrative: `AI analysis unavailable: ${msg}\n\nDeterministic report generated successfully — ${fallbackParts.join(', ')}.`,
        inputTokens: 0,
        outputTokens: 0,
        modelUsed: 'none',
      };
    }

    return {
      reportId: `cost-ai-${Date.now()}`,
      generatedAt: new Date().toISOString(),
      baseReport,
      narrative: aiResult.narrative,
      thinking: aiResult.thinking,
      usage: {
        inputTokens: aiResult.inputTokens,
        outputTokens: aiResult.outputTokens,
        model: aiResult.modelUsed,
      },
    };
  }
}

// Singleton
export const costIntelligenceAgent = new CostIntelligenceAgent();
