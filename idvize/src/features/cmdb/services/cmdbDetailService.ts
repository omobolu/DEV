/**
 * CMDB Application Detail Service
 *
 * Currently reads from local mock data.
 * Replace the fetch* methods with real API calls when the backend is ready:
 *   GET /applications
 *   GET /applications/:appId
 *   GET /applications/:appId/controls
 *   GET /applications/:appId/recommendations
 */

import type { AppDetail } from '../types'
import { APPLICATION_DETAILS } from '../data/applicationDetails'

export const cmdbDetailService = {
  /**
   * Get a single application by ID.
   * Returns undefined if not found (caller should show 404/not-found state).
   */
  getApp(appId: string): AppDetail | undefined {
    return APPLICATION_DETAILS.find(a => a.appId === appId)
  },

  /**
   * Get all applications with detail records available.
   */
  listApps(): AppDetail[] {
    return APPLICATION_DETAILS
  },

  /**
   * Check whether a given appId has a detail record.
   * Useful to decide whether to show the clickable affordance in the list.
   */
  hasDetail(appId: string): boolean {
    return APPLICATION_DETAILS.some(a => a.appId === appId)
  },

  /**
   * Get all app IDs that have detail records (for link rendering in table).
   */
  detailIds(): Set<string> {
    return new Set(APPLICATION_DETAILS.map(a => a.appId))
  },
}
