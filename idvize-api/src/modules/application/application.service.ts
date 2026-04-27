import { Application, RawApplication, ImportResult, ImportError, ApplicationQuery, IngestionSource } from './application.types';
import { parseRawApplication, buildDedupeKey } from './parsers/normalizer';
import { enrichMetadata, validateApplication } from './parsers/metadata.parser';
import { applicationRepository } from './application.repository';

export class ApplicationService {

  /**
   * Import applications from a raw array (from CSV parse or API response).
   * Normalizes fields, deduplicates, enriches metadata.
   */
  importApplications(tenantId: string, rows: RawApplication[], source: IngestionSource = 'api'): ImportResult {
    const imported: Application[] = [];
    const errors: ImportError[] = [];
    let duplicateCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        // Parse + normalize
        const app = parseRawApplication(row, source, i + 1);

        // Validate minimum fields
        const validationErrors = validateApplication(app);
        if (validationErrors.length > 0) {
          errors.push({ row: i + 1, rawName: app.rawName, error: validationErrors.join('; ') });
          continue;
        }

        // Deduplicate
        const dedupeKey = buildDedupeKey(app.name, app.vendor);
        if (applicationRepository.isDuplicate(tenantId, dedupeKey)) {
          duplicateCount++;
          continue;
        }
        applicationRepository.registerDedupeKey(tenantId, dedupeKey, app.appId);

        // Enrich metadata
        const enriched = enrichMetadata(app);

        // Persist
        applicationRepository.save(tenantId, enriched);
        imported.push(enriched);

      } catch (err) {
        errors.push({ row: i + 1, error: (err as Error).message });
      }
    }

    return {
      total: rows.length,
      imported: imported.length,
      duplicates: duplicateCount,
      errors,
      apps: imported,
    };
  }

  /**
   * Import from CSV text (handles parsing internally).
   */
  importFromCsv(tenantId: string, csvText: string): ImportResult {
    const rows = parseCsv(csvText);
    return this.importApplications(tenantId, rows, 'csv');
  }

  /**
   * Add or update a single application manually.
   */
  upsertApplication(tenantId: string, data: Partial<Application> & { name: string }): Application {
    const now = new Date().toISOString();
    const existing = data.appId ? applicationRepository.findById(tenantId, data.appId) : undefined;

    if (existing) {
      return applicationRepository.update(tenantId, existing.appId, { ...data, updatedAt: now })!;
    }

    const app: Application = {
      appId: `APP-${generateShortId()}`,
      name: data.name,
      rawName: data.name,
      owner: data.owner ?? 'Unknown',
      ownerEmail: data.ownerEmail ?? '',
      vendor: data.vendor ?? 'Unknown',
      department: data.department ?? 'Unknown',
      riskTier: data.riskTier ?? 'medium',
      dataClassification: data.dataClassification ?? 'internal',
      userPopulation: data.userPopulation ?? 0,
      appType: data.appType ?? 'unknown',
      tags: data.tags ?? [],
      source: 'manual',
      status: data.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    };

    const enriched = enrichMetadata(app);
    const dedupeKey = buildDedupeKey(app.name, app.vendor);
    applicationRepository.registerDedupeKey(tenantId, dedupeKey, app.appId);
    applicationRepository.save(tenantId, enriched);
    return enriched;
  }

  updateFields(tenantId: string, appId: string, fields: Partial<Pick<Application,
    'technicalSme' | 'technicalSmeEmail' | 'owner' | 'ownerEmail' | 'supportContact' | 'department'
  >>): Application | null {
    return applicationRepository.update(tenantId, appId, {
      ...fields,
      updatedAt: new Date().toISOString(),
    });
  }

  getApplication(tenantId: string, appId: string): Application | undefined {
    return applicationRepository.findById(tenantId, appId);
  }

  listApplications(tenantId: string, query?: ApplicationQuery): { apps: Application[]; total: number } {
    const apps = applicationRepository.findAll(tenantId, query);
    const total = applicationRepository.count(tenantId);
    return { apps, total };
  }

  /**
   * Attach IAM posture evaluation result to an application.
   */
  attachPosture(tenantId: string, appId: string, posture: Application['iamPosture']): Application | null {
    return applicationRepository.update(tenantId, appId, { iamPosture: posture });
  }
}

// ─── CSV Parser ───────────────────────────────────────────────────────────────

function parseCsv(csv: string): RawApplication[] {
  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: RawApplication[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = splitCsvLine(lines[i]);
    if (values.length === 0 || values.every(v => v === '')) continue;

    const row: RawApplication = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.replace(/^"|"$/g, '').trim() ?? '';
    });
    rows.push(row);
  }
  return rows;
}

function splitCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function generateShortId(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export const applicationService = new ApplicationService();
