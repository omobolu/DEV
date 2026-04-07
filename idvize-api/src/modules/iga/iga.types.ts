// ── SNOW Ticket Types ────────────────────────────────────────────────────────

export type TicketState = 'new' | 'accepted' | 'investigating' | 'solution_ready' | 'agent_planning' | 'agent_approved' | 'executing' | 'resolved' | 'closed'
export type TicketPriority = 'critical' | 'high' | 'medium' | 'low'

export interface Finding {
  source: string
  type: string
  detail: string
  severity: 'info' | 'warning' | 'critical'
}

export interface Investigation {
  problem: string
  rootCause: string
  affectedSystems: string[]
  findings: Finding[]
  recommendedSolution: string
  confidence: number
  investigatedAt: string
}

export interface PlannedAction {
  step: number
  system: string
  action: string
  detail: string
  risk: 'low' | 'medium' | 'high'
  status: 'pending' | 'executing' | 'completed' | 'failed'
}

export interface AgentPlan {
  instructions: string
  plannedActions: PlannedAction[]
  status: 'draft' | 'approved' | 'executing' | 'completed' | 'failed'
  createdAt: string
}

export interface ActionResult {
  step: number
  status: 'success' | 'failed'
  output: string
  timestamp: string
}

export interface AgentExecution {
  startedAt: string
  completedAt?: string
  results: ActionResult[]
  status: 'running' | 'completed' | 'failed'
}

export interface SNOWTicket {
  ticketId: string
  number: string
  shortDescription: string
  description: string
  caller: string
  callerEmail: string
  assignmentGroup: string
  priority: TicketPriority
  state: TicketState
  category: string
  subcategory: string
  createdAt: string
  updatedAt: string
  acceptedBy?: string
  acceptedAt?: string
  investigation?: Investigation
  solution?: { summary: string; steps: string[]; estimatedEffort: string; risk: 'low' | 'medium' | 'high' }
  agentPlan?: AgentPlan
  agentExecution?: AgentExecution
  feedback?: string
}

// ── Certification Types ──────────────────────────────────────────────────────

export type CertStatus = 'scheduled' | 'active' | 'in_review' | 'completed' | 'expired'

export interface CertificationItem {
  itemId: string
  identity: string
  entitlement: string
  application: string
  decision: 'certified' | 'revoked' | 'pending'
  reviewer: string
  decidedAt?: string
}

export interface CertificationCampaign {
  campaignId: string
  name: string
  type: 'manager' | 'application' | 'entitlement' | 'role'
  status: CertStatus
  owner: string
  startDate: string
  endDate: string
  totalItems: number
  certified: number
  revoked: number
  pending: number
  progress: number
  items: CertificationItem[]
}
