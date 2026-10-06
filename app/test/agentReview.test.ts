import test from 'node:test';
import assert from 'node:assert/strict';
import { areaOf, buildAgentReview, groupAreas, rankFiles, staleKnowledgeFor } from '../src/core/agentReview';
import type { ChangeBrief, BriefFile } from '../src/core/changeBrief';
import type { KnowledgeObject } from '../src/core/knowledge';

const files: BriefFile[] = [
  { path: 'src/ui/Button.tsx', insertions: 4, deletions: 2, kind: 'code' },
  { path: 'src/auth/session.ts', insertions: 30, deletions: 10, kind: 'sensitive' },
  { path: 'src/api/users.ts', insertions: 120, deletions: 20, kind: 'service' },
  { path: 'package.json', insertions: 2, deletions: 0, kind: 'config' },
  { path: 'src/ui/NewCard.tsx', insertions: 50, deletions: 0, kind: 'code' },
];

function brief(list: BriefFile[]): ChangeBrief {
  return {
    scope: 'working', repo: 'acme', filesChanged: list.length,
    insertions: list.reduce((n, f) => n + f.insertions, 0), deletions: list.reduce((n, f) => n + f.deletions, 0),
    mainChanges: [], architectureImpact: 'HIGH', understandBeforeCommit: [], files: list, provenanceNote: '', empty: list.length === 0,
  };
}

function knowledgeFor(file: string, freshness: KnowledgeObject['freshnessStatus'] = 'CURRENT'): KnowledgeObject {
  return {
    id: `k-${file}`, objectType: 'file', objectId: file, title: `About ${file}`, summary: '', body: '', sourceType: 'explanation',
    sourceRefs: [], visibility: 'PRIVATE', verificationStatus: 'AI_GENERATED', createdAt: '', updatedAt: '', codeVersion: '',
    freshnessStatus: freshness, confidence: 0.5, file,
  };
}

test('sensitive files rank first, then big service edits', () => {
  const ranked = rankFiles(files);
  assert.equal(ranked[0]!.path, 'src/auth/session.ts');
  assert.equal(ranked[1]!.path, 'src/api/users.ts');
  assert.match(ranked[0]!.reason, /auth/);
});

test('areas skip wrapper folders and put sensitive areas first', () => {
  assert.equal(areaOf('src/auth/session.ts'), 'auth');
  assert.equal(areaOf('packages/billing/x.ts'), 'billing');
  assert.equal(areaOf('README.md'), 'root');
  const areas = groupAreas(files);
  assert.equal(areas[0]!.name, 'auth');
  assert.ok(areas.some((a) => a.name === 'ui' && a.files === 2));
});

test('saved knowledge on a changed file is flagged', () => {
  const hits = staleKnowledgeFor(files, [knowledgeFor('auth/session.ts'), knowledgeFor('other/thing.ts')]);
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.file, 'auth/session.ts');
});

test('review checklist covers sensitive files, config, missing tests and stale knowledge', () => {
  const review = buildAgentReview(brief(files), [knowledgeFor('src/api/users.ts')]);
  assert.equal(review.size, 'medium');
  assert.ok(review.reviewFirst.some((line) => line.includes('src/auth/session.ts')));
  assert.ok(review.reviewFirst.some((line) => line.includes('package.json')));
  assert.ok(review.reviewFirst.some((line) => line.includes('no test changes')));
  assert.ok(review.reviewFirst.some((line) => line.includes('saved explanation')));
  assert.deepEqual(review.added, ['package.json', 'src/ui/NewCard.tsx']);
  assert.equal(review.headline, '5 files changed, +206 / -32');
});

test('an empty change produces an empty review', () => {
  const review = buildAgentReview(brief([]));
  assert.equal(review.whatMatters.length, 0);
  assert.equal(review.size, 'small');
  assert.deepEqual(review.reviewFirst, []);
});
