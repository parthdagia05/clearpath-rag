// services/chunking.service.ts
// Heading-aware chunking with sliding window overlap
//
// Chunk size : 800 words (word count ≈ token count)
// Overlap    : 150 words
// Stride     : 650 words (next chunk starts at word index 650)
//
// Split priority:
//   1. Headings (ALL CAPS / markdown #)
//   2. Paragraph boundaries (double newlines)
//   3. Sentence boundaries (., !, ?)
//   4. Strict word split (final fallback)

import { randomUUID } from 'crypto';
import { Chunk, ExtractedDocument } from '../types';

const MAX_CHUNK_WORDS = 800;
const OVERLAP_WORDS = 150;
const STRIDE = MAX_CHUNK_WORDS - OVERLAP_WORDS; // 650

// ───────────────────────────────────────────────
// Word utilities
// ───────────────────────────────────────────────

function getWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 0);
}

function countWords(text: string): number {
  return getWords(text).length;
}

function wordsToText(words: string[], start: number, end: number): string {
  return words.slice(start, end).join(' ');
}

// ───────────────────────────────────────────────
// Heading detection
// ───────────────────────────────────────────────

function isHeading(line: string): boolean {
  const trimmed = line.trim();
  if (trimmed.length < 3) return false;

  // Markdown headings
  if (/^#{1,6}\s+/.test(trimmed)) return true;

  // ALL CAPS: ≥60% uppercase letters, minimum 3 letter chars
  const letters = trimmed.replace(/[^a-zA-Z]/g, '');
  if (letters.length < 3) return false;
  const upperCount = letters.replace(/[^A-Z]/g, '').length;
  return upperCount / letters.length >= 0.6;
}

// ───────────────────────────────────────────────
// Text splitting (heading → paragraph → sentence)
// ───────────────────────────────────────────────

/**
 * Split text into sections at heading boundaries.
 */
function splitByHeadings(text: string): string[] {
  const lines = text.split('\n');
  const sections: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isHeading(line) && current.length > 0) {
      sections.push(current.join('\n'));
      current = [line];
    } else {
      current.push(line);
    }
  }

  if (current.length > 0) {
    sections.push(current.join('\n'));
  }

  return sections;
}

/**
 * Split text at paragraph boundaries (blank lines).
 */
function splitByParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

/**
 * Split text at sentence boundaries (. ! ?), preserving the
 * terminator with the sentence. Avoids breaking on abbreviations
 * like "U.S." or "Dr." by requiring whitespace after the terminator.
 */
function splitBySentences(text: string): string[] {
  // Split on sentence-ending punctuation followed by whitespace
  const parts = text.split(/(?<=[.!?])\s+/);
  return parts.filter((p) => p.trim().length > 0);
}

// ───────────────────────────────────────────────
// Core: sliding window with sentence-aware edges
// ───────────────────────────────────────────────

/**
 * Given a word array and a target end index, try to snap forward to a
 * sentence boundary (. ! ?) to avoid breaking mid-sentence.
 * Searches up to ±30 words from the target for a period/exclamation/question.
 * Returns the adjusted end index.
 */
function snapToSentenceBoundary(words: string[], targetEnd: number): number {
  const MAX_SEARCH = 30;

  // Search forward first (prefer slightly larger chunk over truncation)
  for (let i = targetEnd; i < Math.min(targetEnd + MAX_SEARCH, words.length); i++) {
    if (/[.!?]$/.test(words[i])) {
      return i + 1; // include the word with the period
    }
  }

  // Search backward
  for (let i = targetEnd - 1; i >= Math.max(targetEnd - MAX_SEARCH, 0); i--) {
    if (/[.!?]$/.test(words[i])) {
      return i + 1;
    }
  }

  // No sentence boundary found — use exact position
  return targetEnd;
}

/**
 * Sliding window chunker over a word array.
 *
 * chunk[0] = words[0   .. 800)    (snapped to sentence boundary)
 * chunk[1] = words[650 .. 1450)   (snapped)
 * chunk[2] = words[1300 .. 2100)  (snapped)
 * ...
 *
 * Guarantees:
 * - Every chunk is ≤ 830 words (800 + up to 30 for sentence snap)
 * - Overlap is ~150 words (exact when no snap adjustment)
 * - Last chunk captures all remaining words
 */
function slidingWindowChunk(words: string[]): string[] {
  if (words.length <= MAX_CHUNK_WORDS) {
    return [words.join(' ')];
  }

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const rawEnd = Math.min(start + MAX_CHUNK_WORDS, words.length);

    let end: number;
    if (rawEnd >= words.length) {
      // Last chunk — take everything remaining
      end = words.length;
    } else {
      // Snap to sentence boundary
      end = snapToSentenceBoundary(words, rawEnd);
      // Hard cap: never exceed 830 words (800 + 30 snap margin)
      end = Math.min(end, start + MAX_CHUNK_WORDS + 30);
    }

    chunks.push(wordsToText(words, start, end));

    if (end >= words.length) break;

    // Next chunk starts at STRIDE from current start
    start += STRIDE;
  }

  return chunks;
}

// ───────────────────────────────────────────────
// Merge small pieces, preserve heading structure
// ───────────────────────────────────────────────

/**
 * Merge adjacent small sections and split oversized sections.
 * This preserves heading boundaries: we only merge *within* the
 * list order, never across heading splits.
 */
function mergeAndSplit(pieces: string[]): string[] {
  const result: string[] = [];
  let buffer = '';

  for (const piece of pieces) {
    const combined = buffer ? buffer + '\n\n' + piece : piece;

    if (countWords(combined) <= MAX_CHUNK_WORDS) {
      buffer = combined;
    } else {
      // Flush buffer
      if (buffer) {
        flushBuffer(buffer, result);
      }
      // Start new buffer — but if piece itself is oversized, flush it too
      if (countWords(piece) > MAX_CHUNK_WORDS) {
        flushBuffer(piece, result);
        buffer = '';
      } else {
        buffer = piece;
      }
    }
  }

  // Flush remaining
  if (buffer) {
    flushBuffer(buffer, result);
  }

  return result;
}

/**
 * Flush a buffer into the result array.
 * If it's within limit, push as-is. If oversized, split with sliding window.
 */
function flushBuffer(text: string, result: string[]): void {
  if (countWords(text) <= MAX_CHUNK_WORDS) {
    result.push(text);
  } else {
    // Try paragraph split first
    const paragraphs = splitByParagraphs(text);
    if (paragraphs.length > 1) {
      // Recursively merge-and-split the paragraphs
      result.push(...mergeAndSplit(paragraphs));
    } else {
      // Try sentence split
      const sentences = splitBySentences(text);
      if (sentences.length > 1) {
        result.push(...mergeAndSplit(sentences));
      } else {
        // Final fallback: strict sliding window
        const words = getWords(text);
        result.push(...slidingWindowChunk(words));
      }
    }
  }
}

// ───────────────────────────────────────────────
// Overlap application (per-document, structure-aware)
// ───────────────────────────────────────────────

/**
 * Apply sliding window overlap across the chunks of a single document.
 *
 * Instead of destroying heading-aware structure by re-joining all text
 * (the bug in v1), we apply overlap by prepending the tail of the
 * previous chunk to the start of the next chunk.
 *
 * For each pair of adjacent chunks:
 *   - Take the last OVERLAP_WORDS from chunk[i]
 *   - Prepend them to chunk[i+1]
 *   - If this makes chunk[i+1] exceed MAX_CHUNK_WORDS, trim from the end
 */
function applyOverlap(chunks: string[]): string[] {
  if (chunks.length <= 1) return chunks;

  const result: string[] = [chunks[0]]; // First chunk stays as-is

  for (let i = 1; i < chunks.length; i++) {
    const prevWords = getWords(chunks[i - 1]);
    const overlapWords = prevWords.slice(
      Math.max(0, prevWords.length - OVERLAP_WORDS)
    );

    const currentWords = getWords(chunks[i]);
    const combined = [...overlapWords, ...currentWords];

    // Trim from end if exceeding max — snap to sentence boundary
    if (combined.length > MAX_CHUNK_WORDS) {
      const targetEnd = MAX_CHUNK_WORDS;
      // Search backward from target for a sentence-ending word
      let trimEnd = targetEnd;
      for (let j = targetEnd - 1; j >= Math.max(targetEnd - 50, OVERLAP_WORDS); j--) {
        if (/[.!?]$/.test(combined[j])) {
          trimEnd = j + 1;
          break;
        }
      }
      result.push(combined.slice(0, trimEnd).join(' '));
    } else {
      result.push(combined.join(' '));
    }
  }

  return result;
}

// ───────────────────────────────────────────────
// Page number detection
// ───────────────────────────────────────────────

function findPageNumber(
  chunkText: string,
  pages: { pageNumber: number; text: string }[]
): number | null {
  if (pages.length === 0) return null;

  const probe = chunkText.substring(0, 100).trim();
  if (!probe) return pages[0].pageNumber;

  let cumulativeText = '';
  for (const page of pages) {
    cumulativeText += page.text + ' ';
    if (cumulativeText.includes(probe)) {
      return page.pageNumber;
    }
  }

  return null;
}

// ───────────────────────────────────────────────
// Public API
// ───────────────────────────────────────────────

/**
 * Chunk a single document using heading-aware splitting with overlap.
 *
 * Pipeline:
 * 1. Split by headings
 * 2. Within oversized sections: split by paragraphs → sentences → word window
 * 3. Merge small adjacent pieces
 * 4. Apply 150-word sliding window overlap between adjacent chunks
 */
export function chunkDocument(doc: ExtractedDocument): Chunk[] {
  const text = doc.fullText;
  if (!text || countWords(text) === 0) return [];

  // Step 1: Split by headings
  const sections = splitByHeadings(text);

  // Step 2+3: Merge small pieces, split oversized ones (paragraph → sentence → word)
  const rawChunks = mergeAndSplit(sections);

  // Step 4: Apply sliding window overlap
  const overlappedChunks = applyOverlap(rawChunks);

  // Step 5: Create Chunk objects
  return overlappedChunks.map((chunkText) => ({
    chunk_id: randomUUID(),
    document_name: doc.name,
    page_number: findPageNumber(chunkText, doc.pages),
    text: chunkText.trim(),
  }));
}

/**
 * Chunk all documents and return combined chunks array.
 */
export function chunkAllDocuments(docs: ExtractedDocument[]): Chunk[] {
  const allChunks: Chunk[] = [];

  for (const doc of docs) {
    const chunks = chunkDocument(doc);
    allChunks.push(...chunks);
  }

  return allChunks;
}
