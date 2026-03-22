/**
 * IDVIZE Platform Event Bus
 * Central event routing for the AI Agent Orchestration Layer
 */

import type { PlatformEvent, EventType, EventSubscription } from '../types/events'
import { recordAudit } from '../types/audit'

export class EventBus {
  private subscriptions: EventSubscription[] = []
  private eventHistory: PlatformEvent[] = []
  private maxHistory = 1000

  /** Subscribe a handler to a specific event type */
  subscribe(eventType: EventType, handlerId: string, handler: (event: PlatformEvent) => Promise<void>): void {
    this.subscriptions.push({ eventType, handlerId, handler })
  }

  /** Unsubscribe a handler */
  unsubscribe(handlerId: string): void {
    this.subscriptions = this.subscriptions.filter(s => s.handlerId !== handlerId)
  }

  /** Publish an event to all matching subscribers */
  async publish(event: PlatformEvent): Promise<void> {
    this.eventHistory.push(event)
    if (this.eventHistory.length > this.maxHistory) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistory)
    }

    const matchingSubscriptions = this.subscriptions.filter(s => s.eventType === event.type)

    const results = await Promise.allSettled(
      matchingSubscriptions.map(async (sub) => {
        try {
          await sub.handler(event)
          recordAudit(
            'agent_decision',
            { type: 'system', id: 'event-bus', name: 'EventBus' },
            `event_delivered:${event.type}`,
            sub.handlerId,
            'success',
            { eventId: event.id },
          )
        } catch (error) {
          recordAudit(
            'agent_decision',
            { type: 'system', id: 'event-bus', name: 'EventBus' },
            `event_delivery_failed:${event.type}`,
            sub.handlerId,
            'failure',
            { eventId: event.id, error: error instanceof Error ? error.message : 'Unknown' },
            'error',
          )
          throw error
        }
      })
    )

    const failures = results.filter(r => r.status === 'rejected')
    if (failures.length > 0) {
      console.warn(`[EventBus] ${failures.length} handler(s) failed for event ${event.type}`)
    }
  }

  /** Get event history */
  getHistory(eventType?: EventType, limit = 50): PlatformEvent[] {
    let events = [...this.eventHistory]
    if (eventType) events = events.filter(e => e.type === eventType)
    return events.slice(-limit)
  }

  /** Get subscription count */
  getSubscriptionCount(): number {
    return this.subscriptions.length
  }

  /** Get all subscribed event types */
  getSubscribedEventTypes(): EventType[] {
    return [...new Set(this.subscriptions.map(s => s.eventType))]
  }
}

/** Singleton event bus instance */
export const eventBus = new EventBus()
