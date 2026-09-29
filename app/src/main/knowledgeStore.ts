import { app } from 'electron';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { KnowledgeObject, KnowledgeVerification, KnowledgeVisibility } from '../core/knowledge';
import { hashCode, refreshKnowledge } from '../core/knowledge';
import type { TeachBackResult } from '../core/teachBack';

export interface TeachBackRecord {
  id: string;
  concept: string;
  file?: string;
  question: string;
  answer: string;
  evidence: TeachBackResult['evidence'];
  checks: TeachBackResult['checks'];
  createdAt: string;
  codeVersion: string;
}

interface KnowledgeFile {
  objects: KnowledgeObject[];
  teachBacks: TeachBackRecord[];
}

class KnowledgeStore {
  private data: KnowledgeFile = { objects: [], teachBacks: [] };
  private file: string;

  constructor() {
    this.file = path.join(app.getPath('userData'), 'unvibe-knowledge.json');
    try {
      const loaded = JSON.parse(readFileSync(this.file, 'utf8')) as KnowledgeFile;
      this.data.objects = loaded.objects ?? [];
      this.data.teachBacks = loaded.teachBacks ?? [];
    } catch {
      /* first run */
    }
  }

  private save(): void {
    mkdirSync(path.dirname(this.file), { recursive: true });
    const temporary = `${this.file}.tmp`;
    writeFileSync(temporary, JSON.stringify(this.data), { mode: 0o600 });
    renameSync(temporary, this.file);
  }

  list(repositoryId?: string): KnowledgeObject[] {
    const items = repositoryId
      ? this.data.objects.filter((item) => item.repositoryId === repositoryId)
      : this.data.objects;
    return [...items].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  upsert(input: {
    objectType: KnowledgeObject['objectType'];
    objectId: string;
    title: string;
    summary: string;
    body: string;
    sourceType: string;
    sourceRefs: string[];
    visibility?: KnowledgeVisibility;
    verificationStatus?: KnowledgeVerification;
    code: string;
    repositoryId?: string;
    file?: string;
  }): KnowledgeObject {
    const now = new Date().toISOString();
    const existing = this.data.objects.find((item) => item.objectType === input.objectType && item.objectId === input.objectId);
    const next: KnowledgeObject = {
      id: existing?.id ?? randomUUID(),
      objectType: input.objectType,
      objectId: input.objectId,
      title: input.title.slice(0, 160),
      summary: input.summary.slice(0, 400),
      body: input.body.slice(0, 20_000),
      sourceType: input.sourceType,
      sourceRefs: input.sourceRefs.slice(0, 12),
      visibility: input.visibility ?? 'PRIVATE',
      verificationStatus: input.verificationStatus ?? 'AI_GENERATED',
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
      codeVersion: hashCode(input.code),
      freshnessStatus: 'CURRENT',
      confidence: input.verificationStatus === 'AI_GENERATED' ? 0.4 : 0.85,
      repositoryId: input.repositoryId,
      file: input.file,
    };
    if (existing && existing.verificationStatus !== 'AI_GENERATED' && next.verificationStatus === 'AI_GENERATED') {
      next.verificationStatus = existing.verificationStatus;
      next.body = existing.body;
      next.summary = existing.summary;
      next.confidence = existing.confidence;
    }
    if (existing) {
      this.data.objects = this.data.objects.map((item) => (item.id === existing.id ? next : item));
    } else {
      this.data.objects.push(next);
    }
    this.data.objects = this.data.objects.slice(-200);
    this.save();
    return next;
  }

  verify(id: string, status: KnowledgeVerification): KnowledgeObject | null {
    const item = this.data.objects.find((row) => row.id === id);
    if (!item) return null;
    item.verificationStatus = status;
    item.updatedAt = new Date().toISOString();
    item.confidence = status === 'AI_GENERATED' ? 0.4 : 0.9;
    this.save();
    return item;
  }

  refreshAgainst(id: string, currentCode: string): KnowledgeObject | null {
    const item = this.data.objects.find((row) => row.id === id);
    if (!item) return null;
    const next = refreshKnowledge(item, currentCode);
    this.data.objects = this.data.objects.map((row) => (row.id === id ? next : row));
    this.save();
    return next;
  }

  recordTeachBack(input: Omit<TeachBackRecord, 'id' | 'createdAt'>): TeachBackRecord {
    const row: TeachBackRecord = {
      ...input,
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      answer: input.answer.slice(0, 8_000),
      question: input.question.slice(0, 400),
    };
    this.data.teachBacks.push(row);
    this.data.teachBacks = this.data.teachBacks.slice(-200);
    this.save();
    return row;
  }

  teachBacks(): TeachBackRecord[] {
    return [...this.data.teachBacks].reverse();
  }

  wipe(): void {
    this.data = { objects: [], teachBacks: [] };
    this.save();
  }
}

let singleton: KnowledgeStore | null = null;
export function knowledgeStore(): KnowledgeStore {
  if (!singleton) singleton = new KnowledgeStore();
  return singleton;
}
