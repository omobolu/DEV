/**
 * Document Registry — Types
 *
 * Supports versioning, review/publish workflow, and permission-gated access.
 * Permissions already defined in security.types.ts:
 *   document.view, document.review, document.publish
 */

export type DocumentStatus = 'draft' | 'in_review' | 'published' | 'archived';
export type DocumentCategory =
  | 'policy'
  | 'procedure'
  | 'standard'
  | 'guideline'
  | 'runbook'
  | 'architecture'
  | 'other';

export interface DocumentVersion {
  version: number;                  // 1, 2, 3 …
  content: string;                  // Markdown body
  changedBy: string;               // email
  changedAt: string;               // ISO timestamp
  changeNote: string;              // commit message style
}

export interface ReviewRecord {
  reviewId: string;
  documentId: string;
  version: number;
  reviewedBy: string;              // email
  reviewedAt: string;              // ISO
  outcome: 'approved' | 'rejected' | 'pending';
  comments?: string;
}

export interface Document {
  documentId: string;
  title: string;
  category: DocumentCategory;
  owner: string;                   // email of document owner
  tags: string[];
  status: DocumentStatus;
  currentVersion: number;
  versions: DocumentVersion[];
  reviews: ReviewRecord[];
  createdAt: string;
  updatedAt: string;
  publishedAt?: string;
  archivedAt?: string;
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateDocumentDto {
  title: string;
  category: DocumentCategory;
  owner: string;
  tags?: string[];
  content: string;
  changeNote?: string;
}

export interface UpdateDocumentDto {
  title?: string;
  category?: DocumentCategory;
  owner?: string;
  tags?: string[];
  content: string;
  changeNote: string;
}

export interface ReviewDocumentDto {
  outcome: 'approved' | 'rejected';
  comments?: string;
}
