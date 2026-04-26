import { Document } from './document.types';

class DocumentRepository {
  private store = new Map<string, Map<string, Document>>();

  private bucket(tenantId: string): Map<string, Document> {
    if (!this.store.has(tenantId)) this.store.set(tenantId, new Map());
    return this.store.get(tenantId)!;
  }

  findAll(tenantId: string): Document[] {
    return Array.from(this.bucket(tenantId).values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  findById(tenantId: string, id: string): Document | undefined {
    return this.bucket(tenantId).get(id);
  }

  findByStatus(tenantId: string, status: Document['status']): Document[] {
    return this.findAll(tenantId).filter(d => d.status === status);
  }

  findByOwner(tenantId: string, owner: string): Document[] {
    return this.findAll(tenantId).filter(d => d.owner === owner);
  }

  save(tenantId: string, doc: Document): Document {
    this.bucket(tenantId).set(doc.documentId, doc);
    return doc;
  }

  delete(tenantId: string, id: string): boolean {
    return this.bucket(tenantId).delete(id);
  }

  count(tenantId: string): number {
    return this.bucket(tenantId).size;
  }
}

export const documentRepository = new DocumentRepository();
