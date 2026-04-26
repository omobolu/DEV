import { v4 as uuidv4 } from 'uuid';
import {
  Document, DocumentVersion, ReviewRecord,
  CreateDocumentDto, UpdateDocumentDto, ReviewDocumentDto,
} from './document.types';
import { documentRepository } from './document.repository';
import { SEED_DOCUMENTS } from './document.seed';
import { getSeedMode } from '../../config/seed-mode';

let seeded = false;

class DocumentService {

  ensureSeeded(tenantId: string): void {
    if (seeded || documentRepository.count(tenantId) > 0) return;
    if (getSeedMode() === 'production') return;
    for (const doc of SEED_DOCUMENTS) {
      documentRepository.save(tenantId, doc);
    }
    seeded = true;
    console.log(`[DocumentService] Seeded ${SEED_DOCUMENTS.length} documents`);
  }

  // ── Queries ───────────────────────────────────────────────────────────────

  listAll(tenantId: string): Document[] {
    return documentRepository.findAll(tenantId);
  }

  listByStatus(tenantId: string, status: Document['status']): Document[] {
    return documentRepository.findByStatus(tenantId, status);
  }

  getById(tenantId: string, id: string): Document | undefined {
    return documentRepository.findById(tenantId, id);
  }

  // ── Create ────────────────────────────────────────────────────────────────

  create(tenantId: string, dto: CreateDocumentDto): Document {
    const now = new Date().toISOString();
    const docId = `doc-${uuidv4().split('-')[0]}`;

    const firstVersion: DocumentVersion = {
      version: 1,
      content: dto.content,
      changedBy: dto.owner,
      changedAt: now,
      changeNote: dto.changeNote ?? 'Initial draft',
    };

    const doc: Document = {
      documentId: docId,
      title: dto.title,
      category: dto.category,
      owner: dto.owner,
      tags: dto.tags ?? [],
      status: 'draft',
      currentVersion: 1,
      versions: [firstVersion],
      reviews: [],
      createdAt: now,
      updatedAt: now,
    };

    return documentRepository.save(tenantId, doc);
  }

  // ── Update (creates a new version) ───────────────────────────────────────

  update(tenantId: string, id: string, dto: UpdateDocumentDto, editorEmail: string): Document | undefined {
    const doc = documentRepository.findById(tenantId, id);
    if (!doc) return undefined;

    if (doc.status === 'published' || doc.status === 'archived') {
      throw new Error(`Cannot edit a ${doc.status} document. Create a new version explicitly.`);
    }

    const newVersionNum = doc.currentVersion + 1;
    const newVersion: DocumentVersion = {
      version: newVersionNum,
      content: dto.content,
      changedBy: editorEmail,
      changedAt: new Date().toISOString(),
      changeNote: dto.changeNote,
    };

    const updated: Document = {
      ...doc,
      title: dto.title ?? doc.title,
      category: dto.category ?? doc.category,
      owner: dto.owner ?? doc.owner,
      tags: dto.tags ?? doc.tags,
      currentVersion: newVersionNum,
      versions: [...doc.versions, newVersion],
      status: 'draft',           // editing resets status to draft
      updatedAt: new Date().toISOString(),
    };

    return documentRepository.save(tenantId, updated);
  }

  // ── Submit for Review ─────────────────────────────────────────────────────

  submitForReview(tenantId: string, id: string): Document | undefined {
    const doc = documentRepository.findById(tenantId, id);
    if (!doc) return undefined;

    if (doc.status !== 'draft') {
      throw new Error(`Only draft documents can be submitted for review (current: ${doc.status})`);
    }

    const updated: Document = {
      ...doc,
      status: 'in_review',
      updatedAt: new Date().toISOString(),
    };

    return documentRepository.save(tenantId, updated);
  }

  // ── Review ────────────────────────────────────────────────────────────────

  review(tenantId: string, id: string, dto: ReviewDocumentDto, reviewerEmail: string): Document | undefined {
    const doc = documentRepository.findById(tenantId, id);
    if (!doc) return undefined;

    if (doc.status !== 'in_review') {
      throw new Error(`Only in_review documents can be reviewed (current: ${doc.status})`);
    }

    const reviewRecord: ReviewRecord = {
      reviewId: `rev-${uuidv4().split('-')[0]}`,
      documentId: id,
      version: doc.currentVersion,
      reviewedBy: reviewerEmail,
      reviewedAt: new Date().toISOString(),
      outcome: dto.outcome,
      comments: dto.comments,
    };

    const newStatus: Document['status'] =
      dto.outcome === 'approved' ? 'in_review' : 'draft';  // approved stays in_review until published

    const updated: Document = {
      ...doc,
      reviews: [...doc.reviews, reviewRecord],
      status: dto.outcome === 'rejected' ? 'draft' : 'in_review',
      updatedAt: new Date().toISOString(),
    };

    return documentRepository.save(tenantId, updated);
  }

  // ── Publish ───────────────────────────────────────────────────────────────

  publish(tenantId: string, id: string, publisherEmail: string): Document | undefined {
    const doc = documentRepository.findById(tenantId, id);
    if (!doc) return undefined;

    if (doc.status !== 'in_review') {
      throw new Error(`Only in_review documents can be published (current: ${doc.status})`);
    }

    // Must have at least one approved review on the current version
    const approvedReview = doc.reviews.find(
      r => r.version === doc.currentVersion && r.outcome === 'approved'
    );
    if (!approvedReview) {
      throw new Error('Document must have an approved review before publishing');
    }

    const now = new Date().toISOString();
    const updated: Document = {
      ...doc,
      status: 'published',
      publishedAt: now,
      updatedAt: now,
    };

    return documentRepository.save(tenantId, updated);
  }

  // ── Archive ───────────────────────────────────────────────────────────────

  archive(tenantId: string, id: string): Document | undefined {
    const doc = documentRepository.findById(tenantId, id);
    if (!doc) return undefined;

    const now = new Date().toISOString();
    const updated: Document = {
      ...doc,
      status: 'archived',
      archivedAt: now,
      updatedAt: now,
    };

    return documentRepository.save(tenantId, updated);
  }

  // ── Stats ─────────────────────────────────────────────────────────────────

  getStats(tenantId: string) {
    const all = documentRepository.findAll(tenantId);
    return {
      total: all.length,
      byStatus: {
        draft: all.filter(d => d.status === 'draft').length,
        in_review: all.filter(d => d.status === 'in_review').length,
        published: all.filter(d => d.status === 'published').length,
        archived: all.filter(d => d.status === 'archived').length,
      },
      byCategory: all.reduce<Record<string, number>>((acc, d) => {
        acc[d.category] = (acc[d.category] ?? 0) + 1;
        return acc;
      }, {}),
    };
  }
}

export const documentService = new DocumentService();
