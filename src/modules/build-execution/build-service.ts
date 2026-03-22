/**
 * IDVIZE Build Execution Service
 * Module 4: Build Execution and Delivery Orchestration
 */

import type {
  BuildCase,
  BuildStatus,
  BuildMode,
  BuildSummaryStats,
  BuildArtifact,
  Stakeholder,
} from '../../types/build-execution'
import { recordAudit } from '../../types/audit'

/** In-memory build case store */
const buildCases: Map<string, BuildCase> = new Map()

export class BuildExecutionService {
  /** Create a build case from a detected gap */
  createBuildCase(params: {
    appId: string
    appName: string
    gapId: string
    title: string
    description: string
    mode: BuildMode
    priority: BuildCase['priority']
    integrationType?: BuildCase['integrationType']
  }): BuildCase {
    const buildCase: BuildCase = {
      id: `bc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      appId: params.appId,
      appName: params.appName,
      gapId: params.gapId,
      title: params.title,
      description: params.description,
      status: 'DETECTED',
      mode: params.mode,
      priority: params.priority,
      integrationType: params.integrationType,
      stakeholders: [],
      timeline: [{
        timestamp: new Date().toISOString(),
        status: 'DETECTED',
        actor: 'system',
        notes: 'Build case created from gap detection',
      }],
      artifacts: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    buildCases.set(buildCase.id, buildCase)

    recordAudit(
      'build_execution',
      { type: 'system', id: 'build-service', name: 'BuildExecutionService' },
      'build_case_created',
      buildCase.id,
      'success',
      { appId: params.appId, gapId: params.gapId, mode: params.mode },
    )

    return buildCase
  }

  /** Advance build case to next status */
  advanceStatus(caseId: string, actor: string, notes?: string): BuildCase | null {
    const buildCase = buildCases.get(caseId)
    if (!buildCase) return null

    const statusFlow: BuildStatus[] = [
      'DETECTED', 'CLASSIFIED', 'ASSIGNED', 'READY_TO_BUILD',
      'OUTREACH_SENT', 'MEETING_SCHEDULED', 'DATA_COLLECTED',
      'BUILD_IN_PROGRESS', 'TESTING', 'COMPLETED',
    ]

    const currentIndex = statusFlow.indexOf(buildCase.status)
    if (currentIndex < 0 || currentIndex >= statusFlow.length - 1) return buildCase

    const newStatus = statusFlow[currentIndex + 1]
    buildCase.status = newStatus
    buildCase.updatedAt = new Date().toISOString()

    if (newStatus === 'COMPLETED') {
      buildCase.completedAt = new Date().toISOString()
    }

    buildCase.timeline.push({
      timestamp: new Date().toISOString(),
      status: newStatus,
      actor,
      notes,
    })

    recordAudit(
      'build_execution',
      { type: 'user', id: actor, name: actor },
      `status_advanced_to_${newStatus}`,
      caseId,
      'success',
      { previousStatus: statusFlow[currentIndex], newStatus },
    )

    return buildCase
  }

  /** Set status directly */
  setStatus(caseId: string, status: BuildStatus, actor: string, notes?: string): BuildCase | null {
    const buildCase = buildCases.get(caseId)
    if (!buildCase) return null

    const previousStatus = buildCase.status
    buildCase.status = status
    buildCase.updatedAt = new Date().toISOString()

    if (status === 'COMPLETED') {
      buildCase.completedAt = new Date().toISOString()
    }

    buildCase.timeline.push({
      timestamp: new Date().toISOString(),
      status,
      actor,
      notes,
    })

    recordAudit(
      'build_execution',
      { type: 'user', id: actor, name: actor },
      `status_set_to_${status}`,
      caseId,
      'success',
      { previousStatus, newStatus: status },
    )

    return buildCase
  }

  /** Assign engineer and/or architect */
  assignTeam(caseId: string, engineer?: string, architect?: string): BuildCase | null {
    const buildCase = buildCases.get(caseId)
    if (!buildCase) return null

    if (engineer) buildCase.assignedEngineer = engineer
    if (architect) buildCase.assignedArchitect = architect
    buildCase.updatedAt = new Date().toISOString()

    return buildCase
  }

  /** Add stakeholder */
  addStakeholder(caseId: string, stakeholder: Stakeholder): BuildCase | null {
    const buildCase = buildCases.get(caseId)
    if (!buildCase) return null

    buildCase.stakeholders.push(stakeholder)
    buildCase.updatedAt = new Date().toISOString()

    return buildCase
  }

  /** Add artifact */
  addArtifact(caseId: string, artifact: Omit<BuildArtifact, 'id' | 'createdAt'>): BuildCase | null {
    const buildCase = buildCases.get(caseId)
    if (!buildCase) return null

    buildCase.artifacts.push({
      ...artifact,
      id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      createdAt: new Date().toISOString(),
    })
    buildCase.updatedAt = new Date().toISOString()

    return buildCase
  }

  /** Get all build cases */
  getBuildCases(): BuildCase[] {
    return Array.from(buildCases.values())
  }

  /** Get build case by ID */
  getBuildCaseById(id: string): BuildCase | undefined {
    return buildCases.get(id)
  }

  /** Get build cases for an application */
  getBuildCasesForApp(appId: string): BuildCase[] {
    return Array.from(buildCases.values()).filter(bc => bc.appId === appId)
  }

  /** Get active build cases */
  getActiveCases(): BuildCase[] {
    return Array.from(buildCases.values()).filter(bc => bc.status !== 'COMPLETED')
  }

  /** Get summary statistics */
  getSummaryStats(): BuildSummaryStats {
    const cases = Array.from(buildCases.values())

    const byStatus = {} as Record<BuildStatus, number>
    const byMode = {} as Record<BuildMode, number>

    for (const bc of cases) {
      byStatus[bc.status] = (byStatus[bc.status] ?? 0) + 1
      byMode[bc.mode] = (byMode[bc.mode] ?? 0) + 1
    }

    const completedCases = cases.filter(bc => bc.completedAt)
    const avgDays = completedCases.length > 0
      ? completedCases.reduce((sum, bc) => {
          const days = (new Date(bc.completedAt!).getTime() - new Date(bc.createdAt).getTime()) / 86400000
          return sum + days
        }, 0) / completedCases.length
      : 0

    return {
      totalCases: cases.length,
      byStatus,
      byMode,
      averageCompletionDays: Math.round(avgDays * 10) / 10,
      activeCases: cases.filter(bc => bc.status !== 'COMPLETED').length,
    }
  }
}

/** Singleton build execution service */
export const buildExecutionService = new BuildExecutionService()
