/**
 * In-memory store for per-app IAM control overrides.
 * Persists for the lifetime of the API process.
 */

export interface ControlOverride {
  notApplicable: boolean;
  notes:         string;
  updatedAt:     string;
  updatedBy:     string;
}

// Map<appId, Map<controlId, ControlOverride>>
const store = new Map<string, Map<string, ControlOverride>>();

export const controlOverridesStore = {
  get(appId: string, controlId: string): ControlOverride | undefined {
    return store.get(appId)?.get(controlId);
  },

  getAll(appId: string): Record<string, ControlOverride> {
    const map = store.get(appId);
    if (!map) return {};
    return Object.fromEntries(map.entries());
  },

  set(appId: string, controlId: string, override: Omit<ControlOverride, 'updatedAt'> & { updatedAt?: string }): ControlOverride {
    if (!store.has(appId)) store.set(appId, new Map());
    const record: ControlOverride = {
      ...override,
      updatedAt: override.updatedAt ?? new Date().toISOString(),
    };
    store.get(appId)!.set(controlId, record);
    return record;
  },

  delete(appId: string, controlId: string): void {
    store.get(appId)?.delete(controlId);
  },
};
