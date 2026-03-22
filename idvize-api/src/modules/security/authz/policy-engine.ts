/**
 * Policy Engine — RBAC + ABAC Evaluator
 *
 * Evaluation algorithm (deny-by-default):
 *  1. Collect all policies matching the subject (role or userId).
 *  2. Evaluate ABAC conditions against user attributes + request context.
 *  3. If any DENY policy matches → deny immediately (deny wins).
 *  4. If any ALLOW policy matches → allow.
 *  5. Default → deny.
 */

import { Policy, PolicyCondition, EvaluationContext, AuthzDecision, PermissionId, User } from '../security.types';

export interface PolicyStore {
  findBySubject(subject: string): Policy[];
}

/**
 * Evaluate a single ABAC condition.
 */
function evaluateCondition(condition: PolicyCondition, user: User, context: EvaluationContext): boolean {
  const { attribute, operator, value } = condition;

  // Resolve attribute value from user or context
  let actual: unknown;
  if (attribute.startsWith('user.')) {
    const field = attribute.slice(5);
    actual = (user as unknown as Record<string, unknown>)[field]
      ?? user.attributes[field];
  } else if (attribute.startsWith('resource.')) {
    const field = attribute.slice(9);
    actual = (context as Record<string, unknown>)[`resource${field.charAt(0).toUpperCase()}${field.slice(1)}`]
      ?? (context as Record<string, unknown>)[field];
  } else {
    actual = (context as Record<string, unknown>)[attribute];
  }

  switch (operator) {
    case 'eq':      return actual === value;
    case 'neq':     return actual !== value;
    case 'in':      return Array.isArray(value) && value.includes(actual);
    case 'not_in':  return Array.isArray(value) && !value.includes(actual);
    case 'gt':      return typeof actual === 'number' && typeof value === 'number' && actual > value;
    case 'lt':      return typeof actual === 'number' && typeof value === 'number' && actual < value;
    case 'contains':return typeof actual === 'string' && typeof value === 'string' && actual.includes(value);
    default:        return false;
  }
}

/**
 * Evaluate all conditions for a policy — all must pass (AND semantics).
 */
function allConditionsMet(policy: Policy, user: User, context: EvaluationContext): boolean {
  return policy.conditions.every(c => evaluateCondition(c, user, context));
}

/**
 * Core deny-by-default evaluation function.
 */
export function evaluate(
  user: User,
  permissionId: PermissionId,
  policies: Policy[],
  context: EvaluationContext = {},
): AuthzDecision {
  const base: Pick<AuthzDecision, 'permissionId' | 'userId'> = { permissionId, userId: user.userId };

  // Build subject set: role subjects + user subject
  const subjects = new Set<string>([
    `user:${user.userId}`,
    ...user.roles.map(r => `role:${r}`),
  ]);

  // Filter to applicable policies
  const applicable = policies
    .filter(p => p.enabled)
    .filter(p => p.permissions.includes(permissionId))
    .filter(p => p.subjects.some(s => subjects.has(s)))
    .sort((a, b) => b.priority - a.priority); // higher priority first

  // Evaluate deny policies first (deny wins at same priority)
  for (const policy of applicable) {
    if (policy.effect === 'deny' && allConditionsMet(policy, user, context)) {
      return { ...base, allowed: false, reason: `Denied by policy "${policy.name}"`, matchedPolicy: policy.policyId };
    }
  }

  // Evaluate allow policies
  for (const policy of applicable) {
    if (policy.effect === 'allow' && allConditionsMet(policy, user, context)) {
      return { ...base, allowed: true, reason: `Allowed by policy "${policy.name}"`, matchedPolicy: policy.policyId };
    }
  }

  // Default deny
  return { ...base, allowed: false, reason: 'No matching allow policy — deny by default' };
}
