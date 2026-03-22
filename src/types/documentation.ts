/**
 * IDVIZE Platform Documentation Types
 * Module 6: IAM Documentation and Knowledge Publishing
 */

export type DocumentType =
  | 'logical_architecture'
  | 'reference_architecture'
  | 'network_architecture'
  | 'solution_design'
  | 'process_design'
  | 'application_iam_design'
  | 'runbook'
  | 'knowledge_article'

export type DocumentStatus =
  | 'draft'
  | 'in_review'
  | 'approved'
  | 'published'
  | 'archived'

export interface DocumentRecord {
  id: string
  title: string
  type: DocumentType
  status: DocumentStatus
  version: number
  author: string
  content: string
  summary?: string
  tags: string[]
  relatedAppIds: string[]
  facts: DocumentFact[]
  reviewHistory: DocumentReview[]
  createdAt: string
  updatedAt: string
  publishedAt?: string
  publishedTo?: string
}

export interface DocumentFact {
  source: string
  module: string
  key: string
  value: string
  collectedAt: string
}

export interface DocumentReview {
  reviewerId: string
  reviewerName: string
  status: 'pending' | 'approved' | 'rejected' | 'revision_requested'
  comments?: string
  reviewedAt?: string
}

export interface DocumentTemplate {
  id: string
  name: string
  type: DocumentType
  description: string
  sections: DocumentTemplateSection[]
  requiredFacts: string[]
}

export interface DocumentTemplateSection {
  title: string
  description: string
  required: boolean
  order: number
  defaultContent?: string
}

export interface DocumentGenerationRequest {
  templateId?: string
  type: DocumentType
  title: string
  appIds?: string[]
  context: Record<string, unknown>
  requestedBy: string
}

export interface PublishingPayload {
  documentId: string
  format: 'confluence' | 'markdown' | 'html' | 'pdf'
  destination?: string
  spaceKey?: string
  parentPageId?: string
  content: string
  metadata: Record<string, string>
}
