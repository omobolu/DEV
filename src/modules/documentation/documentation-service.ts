/**
 * IDVIZE Documentation Service
 * Module 6: IAM Documentation and Knowledge Publishing
 */

import type {
  DocumentRecord,
  DocumentTemplate,
  DocumentType,
  DocumentStatus,
  DocumentGenerationRequest,
  PublishingPayload,
} from '../../types/documentation'
import { recordAudit } from '../../types/audit'

/** In-memory stores */
const documents: Map<string, DocumentRecord> = new Map()
const templates: Map<string, DocumentTemplate> = new Map()

// Seed default templates
const defaultTemplates: DocumentTemplate[] = [
  {
    id: 'tmpl-solution-design',
    name: 'Solution Design',
    type: 'solution_design',
    description: 'IAM solution design document template',
    sections: [
      { title: 'Overview', description: 'Solution overview and objectives', required: true, order: 1 },
      { title: 'Current State', description: 'Current authentication and authorization state', required: true, order: 2 },
      { title: 'Target State', description: 'Desired IAM integration state', required: true, order: 3 },
      { title: 'Architecture', description: 'Integration architecture', required: true, order: 4 },
      { title: 'Implementation Plan', description: 'Step-by-step implementation', required: true, order: 5 },
      { title: 'Testing Strategy', description: 'Testing approach', required: true, order: 6 },
      { title: 'Rollback Plan', description: 'Contingency procedures', required: false, order: 7 },
    ],
    requiredFacts: ['appName', 'authMethod', 'integrationType'],
  },
  {
    id: 'tmpl-runbook',
    name: 'Operational Runbook',
    type: 'runbook',
    description: 'Operational runbook template',
    sections: [
      { title: 'Prerequisites', description: 'Access and tool requirements', required: true, order: 1 },
      { title: 'Procedures', description: 'Step-by-step procedures', required: true, order: 2 },
      { title: 'Troubleshooting', description: 'Common issues and resolutions', required: true, order: 3 },
      { title: 'Escalation', description: 'Escalation contacts', required: true, order: 4 },
    ],
    requiredFacts: ['appName'],
  },
  {
    id: 'tmpl-process-design',
    name: 'Process Design',
    type: 'process_design',
    description: 'IAM process design template (joiner/mover/leaver, etc.)',
    sections: [
      { title: 'Process Overview', description: 'High-level process description', required: true, order: 1 },
      { title: 'Actors and Roles', description: 'Stakeholders and responsibilities', required: true, order: 2 },
      { title: 'Process Flow', description: 'Detailed flow steps', required: true, order: 3 },
      { title: 'Exceptions', description: 'Exception handling', required: false, order: 4 },
      { title: 'Metrics', description: 'Success metrics and KPIs', required: false, order: 5 },
    ],
    requiredFacts: ['processName'],
  },
  {
    id: 'tmpl-knowledge-article',
    name: 'Knowledge Article',
    type: 'knowledge_article',
    description: 'General knowledge article template',
    sections: [
      { title: 'Summary', description: 'Article summary', required: true, order: 1 },
      { title: 'Details', description: 'Detailed content', required: true, order: 2 },
      { title: 'References', description: 'Related resources', required: false, order: 3 },
    ],
    requiredFacts: [],
  },
]

for (const t of defaultTemplates) {
  templates.set(t.id, t)
}

export class DocumentationService {
  /** Generate a document from a request */
  generateDocument(request: DocumentGenerationRequest): DocumentRecord {
    const template = request.templateId ? templates.get(request.templateId) : undefined
    const id = `doc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`

    const content = template
      ? template.sections.map(s => `## ${s.title}\n\n${s.defaultContent ?? s.description}`).join('\n\n')
      : `# ${request.title}\n\nGenerated document content placeholder.`

    const document: DocumentRecord = {
      id,
      title: request.title,
      type: request.type,
      status: 'draft',
      version: 1,
      author: request.requestedBy,
      content,
      summary: `Generated ${request.type.replace(/_/g, ' ')} document`,
      tags: [request.type],
      relatedAppIds: request.appIds ?? [],
      facts: [],
      reviewHistory: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    documents.set(id, document)

    recordAudit(
      'publication',
      { type: 'user', id: request.requestedBy, name: request.requestedBy },
      'document_generated',
      id,
      'success',
      { type: request.type, title: request.title },
    )

    return document
  }

  /** Submit document for review */
  submitForReview(documentId: string, reviewerId: string): DocumentRecord | null {
    const doc = documents.get(documentId)
    if (!doc) return null

    doc.status = 'in_review'
    doc.updatedAt = new Date().toISOString()
    doc.reviewHistory.push({
      reviewerId,
      reviewerName: reviewerId,
      status: 'pending',
    })

    recordAudit(
      'publication',
      { type: 'system', id: 'doc-service', name: 'DocumentationService' },
      'document_submitted_for_review',
      documentId,
      'success',
      { reviewerId },
    )

    return doc
  }

  /** Approve a document */
  approveDocument(documentId: string, reviewerId: string, comments?: string): DocumentRecord | null {
    const doc = documents.get(documentId)
    if (!doc) return null

    doc.status = 'approved'
    doc.updatedAt = new Date().toISOString()

    const review = doc.reviewHistory.find(r => r.reviewerId === reviewerId && r.status === 'pending')
    if (review) {
      review.status = 'approved'
      review.comments = comments
      review.reviewedAt = new Date().toISOString()
    }

    recordAudit(
      'publication',
      { type: 'user', id: reviewerId, name: reviewerId },
      'document_approved',
      documentId,
      'success',
    )

    return doc
  }

  /** Publish a document */
  publishDocument(documentId: string, format: PublishingPayload['format'] = 'confluence'): PublishingPayload | null {
    const doc = documents.get(documentId)
    if (!doc) return null

    doc.status = 'published'
    doc.publishedAt = new Date().toISOString()
    doc.publishedTo = format
    doc.updatedAt = new Date().toISOString()

    recordAudit(
      'publication',
      { type: 'system', id: 'doc-service', name: 'DocumentationService' },
      'document_published',
      documentId,
      'success',
      { format },
    )

    return {
      documentId,
      format,
      content: doc.content,
      metadata: {
        title: doc.title,
        type: doc.type,
        author: doc.author,
        version: String(doc.version),
      },
    }
  }

  /** Get all documents */
  getDocuments(): DocumentRecord[] {
    return Array.from(documents.values())
  }

  /** Get document by ID */
  getDocumentById(id: string): DocumentRecord | undefined {
    return documents.get(id)
  }

  /** Get documents by type */
  getDocumentsByType(type: DocumentType): DocumentRecord[] {
    return Array.from(documents.values()).filter(d => d.type === type)
  }

  /** Get documents by status */
  getDocumentsByStatus(status: DocumentStatus): DocumentRecord[] {
    return Array.from(documents.values()).filter(d => d.status === status)
  }

  /** Get all templates */
  getTemplates(): DocumentTemplate[] {
    return Array.from(templates.values())
  }

  /** Get template by ID */
  getTemplateById(id: string): DocumentTemplate | undefined {
    return templates.get(id)
  }

  /** Update document content */
  updateContent(documentId: string, content: string): DocumentRecord | null {
    const doc = documents.get(documentId)
    if (!doc) return null

    doc.content = content
    doc.version += 1
    doc.updatedAt = new Date().toISOString()

    return doc
  }
}

/** Singleton documentation service */
export const documentationService = new DocumentationService()
