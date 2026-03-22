/**
 * IDVIZE Meeting Agent
 * Schedules meetings, generates agendas, processes notes, triggers reminders
 */

import type { BaseAgent, AgentConfig, AgentOutput, AgentHealthStatus } from '../../types/agent'
import { createAgentOutput } from '../../types/agent'
import type { PlatformEvent } from '../../types/events'

export interface MeetingResult {
  action: 'schedule' | 'generate_agenda' | 'process_notes' | 'reminder'
  meeting?: MeetingDetails
  agenda?: AgendaItem[]
  extractedActionItems?: ActionItem[]
  reminder?: ReminderDetails
}

export interface MeetingDetails {
  id: string
  title: string
  description: string
  attendees: string[]
  suggestedDate: string
  durationMinutes: number
  relatedAppId?: string
  relatedBuildCaseId?: string
}

export interface AgendaItem {
  order: number
  title: string
  description: string
  durationMinutes: number
  presenter?: string
}

export interface ActionItem {
  description: string
  assignee: string
  dueDate: string
  priority: 'high' | 'medium' | 'low'
  relatedTopic: string
}

export interface ReminderDetails {
  meetingId: string
  reminderType: 'upcoming' | 'action_items_due' | 'follow_up'
  message: string
  sendAt: string
}

const AGENT_CONFIG: AgentConfig = {
  id: 'agent-meeting',
  domain: 'meeting',
  name: 'Meeting Agent',
  description: 'Schedules meetings, generates agendas, processes notes and action items, triggers reminders',
  enabled: true,
  capabilities: [
    {
      name: 'manage-meetings',
      description: 'Handle meeting lifecycle — schedule, agenda, notes, reminders',
      inputEventTypes: ['MEETING_NOTES_CAPTURED', 'AGENT_TASK_COMPLETED'],
      outputEventTypes: ['AGENT_TASK_COMPLETED'],
    },
  ],
  maxRetries: 2,
  timeoutMs: 10000,
}

export class MeetingAgent implements BaseAgent {
  readonly config = AGENT_CONFIG
  private processedCount = 0
  private errorCount = 0
  private lastProcessedAt?: string
  private totalProcessingTimeMs = 0

  async initialize(): Promise<void> {}

  canHandle(eventType: string): boolean {
    return this.config.capabilities.some(c => c.inputEventTypes.includes(eventType))
  }

  async process(event: PlatformEvent): Promise<AgentOutput<MeetingResult>> {
    const startTime = Date.now()

    try {
      const action = event.payload.action as string ?? 'schedule'
      let result: MeetingResult

      switch (action) {
        case 'generate_agenda':
          result = this.generateAgenda(event)
          break
        case 'process_notes':
          result = this.processNotes(event)
          break
        case 'reminder':
          result = this.createReminder(event)
          break
        default:
          result = this.scheduleMeeting(event)
      }

      const processingTimeMs = Date.now() - startTime
      this.processedCount++
      this.lastProcessedAt = new Date().toISOString()
      this.totalProcessingTimeMs += processingTimeMs

      return createAgentOutput<MeetingResult>(
        this.config.id,
        this.config.domain,
        result,
        {
          confidence: 'medium',
          assumptions: ['Meeting scheduling is suggestive — actual calendar integration pending'],
          recommendedNextStep: result.action === 'process_notes'
            ? 'Route action items to respective agents'
            : 'Confirm meeting details with attendees',
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

  private scheduleMeeting(event: PlatformEvent): MeetingResult {
    const appName = event.payload.appName as string ?? 'Application'
    const attendees = event.payload.attendees as string[] ?? ['IAM Engineer', 'Application Owner']

    return {
      action: 'schedule',
      meeting: {
        id: `mtg-${Date.now()}`,
        title: `Technical Discovery — ${appName} IAM Integration`,
        description: `Discuss IAM integration requirements for ${appName}`,
        attendees,
        suggestedDate: new Date(Date.now() + 7 * 86400000).toISOString(),
        durationMinutes: 30,
        relatedAppId: event.payload.appId as string,
        relatedBuildCaseId: event.payload.buildCaseId as string,
      },
    }
  }

  private generateAgenda(event: PlatformEvent): MeetingResult {
    const appName = event.payload.appName as string ?? 'Application'
    const gapType = event.payload.gapType as string ?? 'IAM integration'

    return {
      action: 'generate_agenda',
      agenda: [
        { order: 1, title: 'Introductions', description: 'Brief introductions and meeting objectives', durationMinutes: 3 },
        { order: 2, title: 'Current State', description: `Review current IAM state of ${appName}`, durationMinutes: 5 },
        { order: 3, title: 'Gap Analysis', description: `Review identified gap: ${gapType.replace(/_/g, ' ')}`, durationMinutes: 7 },
        { order: 4, title: 'Technical Requirements', description: 'Discuss integration protocol, endpoints, and prerequisites', durationMinutes: 10 },
        { order: 5, title: 'Next Steps', description: 'Agree on timeline, responsibilities, and follow-ups', durationMinutes: 5 },
      ],
    }
  }

  private processNotes(event: PlatformEvent): MeetingResult {
    const notes = event.payload.notes as string ?? ''
    const actionItems: ActionItem[] = []

    // Simple extraction heuristics
    const lines = notes.split('\n')
    for (const line of lines) {
      const lower = line.toLowerCase().trim()
      if (lower.startsWith('action:') || lower.startsWith('todo:') || lower.startsWith('- [')) {
        actionItems.push({
          description: line.replace(/^(action:|todo:|\- \[.\])\s*/i, '').trim(),
          assignee: 'TBD',
          dueDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          priority: 'medium',
          relatedTopic: 'Meeting notes',
        })
      }
    }

    return {
      action: 'process_notes',
      extractedActionItems: actionItems,
    }
  }

  private createReminder(event: PlatformEvent): MeetingResult {
    return {
      action: 'reminder',
      reminder: {
        meetingId: event.payload.meetingId as string ?? 'unknown',
        reminderType: 'upcoming',
        message: `Reminder: Meeting scheduled for ${event.payload.meetingDate as string ?? 'TBD'}`,
        sendAt: new Date(Date.now() + 86400000).toISOString(),
      },
    }
  }
}
