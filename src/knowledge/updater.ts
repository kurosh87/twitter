import { readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import type { Event, Fact, Source } from './loader';

const KNOWLEDGE_DIR = path.join(process.cwd(), 'knowledge');

export interface ExtractedEvent {
  title: string;
  description: string;
  date: string | null;
  location: string | null;
  category: string;
  severity: number;
  isVerified: boolean;
  sourceHandles: string[];
  rawClaims: string[];
}

export interface ExtractedFact {
  statement: string;
  confidence: 'verified' | 'reported' | 'unconfirmed';
  source: string;
}

export interface ExtractionResult {
  events: ExtractedEvent[];
  newFacts: ExtractedFact[];
  extractedAt: string;
}

function generateEventId(event: ExtractedEvent): string {
  const dateStr = event.date || new Date().toISOString().slice(0, 10);
  const slug = event.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 30);
  return `evt_${dateStr}_${slug}`;
}

function generateFactId(fact: ExtractedFact): string {
  const slug = fact.statement
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .slice(0, 40);
  return slug;
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function isSimilarEvent(existing: Event, extracted: ExtractedEvent): boolean {
  if (existing.date !== extracted.date) return false;

  const existingNorm = normalizeText(existing.title + existing.description);
  const extractedNorm = normalizeText(extracted.title + extracted.description);

  const overlap = existingNorm
    .split('')
    .filter((char) => extractedNorm.includes(char)).length;
  const similarity = overlap / Math.max(existingNorm.length, extractedNorm.length);

  return similarity > 0.6;
}

function isSimilarFact(existing: Fact, extracted: ExtractedFact): boolean {
  const existingNorm = normalizeText(existing.statement);
  const extractedNorm = normalizeText(extracted.statement);

  const overlap = existingNorm
    .split('')
    .filter((char) => extractedNorm.includes(char)).length;
  const similarity = overlap / Math.max(existingNorm.length, extractedNorm.length);

  return similarity > 0.7;
}

function mergeEvent(existing: Event, extracted: ExtractedEvent): Event {
  const newSources: Source[] = extracted.sourceHandles.map((handle) => ({
    name: handle,
    url: null,
    date: new Date().toISOString().slice(0, 10),
  }));

  const existingSourceNames = existing.sources.map((s) => s.name);
  const uniqueNewSources = newSources.filter(
    (s) => !existingSourceNames.includes(s.name)
  );

  return {
    ...existing,
    sources: [...existing.sources, ...uniqueNewSources],
    description:
      extracted.description.length > existing.description.length
        ? extracted.description
        : existing.description,
    severity: Math.max(existing.severity, extracted.severity) as 1 | 2 | 3 | 4 | 5,
    verified: existing.verified || extracted.isVerified,
  };
}

function mergeFact(existing: Fact, extracted: ExtractedFact): Fact {
  const existingSources = existing.sources;
  if (!existingSources.includes(extracted.source)) {
    existingSources.push(extracted.source);
  }

  const confidenceRank = { verified: 3, reported: 2, unconfirmed: 1 };
  const newConfidence =
    confidenceRank[extracted.confidence] > confidenceRank[existing.confidence]
      ? extracted.confidence
      : existing.confidence;

  return {
    ...existing,
    sources: existingSources,
    confidence: newConfidence,
    dateVerified:
      newConfidence === 'verified' && !existing.dateVerified
        ? new Date().toISOString().slice(0, 10)
        : existing.dateVerified,
  };
}

export async function updateKnowledge(extraction: ExtractionResult): Promise<{
  eventsAdded: number;
  eventsMerged: number;
  factsAdded: number;
  factsMerged: number;
}> {
  const stats = {
    eventsAdded: 0,
    eventsMerged: 0,
    factsAdded: 0,
    factsMerged: 0,
  };

  const eventsPath = path.join(KNOWLEDGE_DIR, 'events.json');
  const factsPath = path.join(KNOWLEDGE_DIR, 'facts.json');

  let eventsData: { events: Event[] } = { events: [] };
  let factsData: { facts: Fact[] } = { facts: [] };

  if (existsSync(eventsPath)) {
    eventsData = JSON.parse(await readFile(eventsPath, 'utf-8'));
  }
  if (existsSync(factsPath)) {
    factsData = JSON.parse(await readFile(factsPath, 'utf-8'));
  }

  for (const extracted of extraction.events) {
    const existingIndex = eventsData.events.findIndex((e) =>
      isSimilarEvent(e, extracted)
    );

    if (existingIndex >= 0) {
      eventsData.events[existingIndex] = mergeEvent(
        eventsData.events[existingIndex],
        extracted
      );
      stats.eventsMerged++;
    } else {
      const newEvent: Event = {
        id: generateEventId(extracted),
        date: extracted.date || new Date().toISOString().slice(0, 10),
        category: extracted.category as Event['category'],
        severity: Math.min(5, Math.max(1, extracted.severity)) as 1 | 2 | 3 | 4 | 5,
        title: extracted.title,
        description: extracted.description,
        location: extracted.location,
        sources: extracted.sourceHandles.map((handle) => ({
          name: handle,
          url: null,
          date: new Date().toISOString().slice(0, 10),
        })),
        verified: extracted.isVerified,
        relatedEvents: [],
        tags: [],
      };
      eventsData.events.push(newEvent);
      stats.eventsAdded++;
    }
  }

  for (const extracted of extraction.newFacts) {
    const existingIndex = factsData.facts.findIndex((f) =>
      isSimilarFact(f, extracted)
    );

    if (existingIndex >= 0) {
      factsData.facts[existingIndex] = mergeFact(
        factsData.facts[existingIndex],
        extracted
      );
      stats.factsMerged++;
    } else {
      const newFact: Fact = {
        id: generateFactId(extracted),
        statement: extracted.statement,
        persianStatement: null,
        category: 'extracted',
        confidence: extracted.confidence,
        sources: [extracted.source],
        dateAdded: new Date().toISOString().slice(0, 10),
        dateVerified:
          extracted.confidence === 'verified'
            ? new Date().toISOString().slice(0, 10)
            : null,
        usageCount: 0,
      };
      factsData.facts.push(newFact);
      stats.factsAdded++;
    }
  }

  eventsData.events.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  await writeFile(eventsPath, JSON.stringify(eventsData, null, 2));
  await writeFile(factsPath, JSON.stringify(factsData, null, 2));

  await logUpdate(extraction, stats);

  return stats;
}

async function logUpdate(
  extraction: ExtractionResult,
  stats: {
    eventsAdded: number;
    eventsMerged: number;
    factsAdded: number;
    factsMerged: number;
  }
): Promise<void> {
  const historyPath = path.join(KNOWLEDGE_DIR, 'generation-history.json');
  let history: { updates: unknown[] } = { updates: [] };

  if (existsSync(historyPath)) {
    try {
      history = JSON.parse(await readFile(historyPath, 'utf-8'));
    } catch {
      history = { updates: [] };
    }
  }

  history.updates.push({
    timestamp: new Date().toISOString(),
    extractedAt: extraction.extractedAt,
    eventsExtracted: extraction.events.length,
    factsExtracted: extraction.newFacts.length,
    ...stats,
  });

  if (history.updates.length > 100) {
    history.updates = history.updates.slice(-100);
  }

  await writeFile(historyPath, JSON.stringify(history, null, 2));
}

export async function incrementFactUsage(factIds: string[]): Promise<void> {
  const factsPath = path.join(KNOWLEDGE_DIR, 'facts.json');
  if (!existsSync(factsPath)) return;

  const factsData: { facts: Fact[] } = JSON.parse(
    await readFile(factsPath, 'utf-8')
  );

  for (const id of factIds) {
    const fact = factsData.facts.find((f) => f.id === id);
    if (fact) {
      fact.usageCount++;
    }
  }

  await writeFile(factsPath, JSON.stringify(factsData, null, 2));
}
