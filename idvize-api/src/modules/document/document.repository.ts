import { Document } from './document.types';

class DocumentRepository {
  private store = new Map<string, Document>();

  findAll(): Document[] {
    return Array.from(this.store.values()).sort((a, b) =>
      b.updatedAt.localeCompare(a.updatedAt)
    );
  }

  findById(id: string): Document | undefined {
    return this.store.get(id);
  }

  findByStatus(status: Document['status']): Document[] {
    return this.findAll().filter(d => d.status === status);
  }

  findByOwner(owner: string): Document[] {
    return this.findAll().filter(d => d.owner === owner);
  }

  save(doc: Document): Document {
    this.store.set(doc.documentId, doc);
    return doc;
  }

  delete(id: string): boolean {
    return this.store.delete(id);
  }

  count(): number {
    return this.store.size;
  }
}

export const documentRepository = new DocumentRepository();
