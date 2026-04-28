import { randomUUID } from 'crypto';
import type { Chunk } from './types';

// pdfjs-dist legacy build is CommonJS-friendly for serverless
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface ExtractedDocument {
  filename: string;
  pages: ExtractedPage[];
  fullText: string;
}

const MAX_CHUNK_WORDS = 350;
const OVERLAP_WORDS = 75;
const STRIDE = MAX_CHUNK_WORDS - OVERLAP_WORDS;

export async function extractPdf(
  buffer: Buffer,
  filename: string
): Promise<ExtractedDocument> {
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
    isEvalSupported: false,
    verbosity: 0,
  }).promise;

  const pages: ExtractedPage[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    const strings: string[] = [];
    for (const item of textContent.items as any[]) {
      if (typeof item.str === 'string') {
        strings.push(item.str);
        if (item.hasEOL) strings.push('\n');
      }
    }
    pages.push({ pageNumber: i, text: cleanText(strings.join('')) });
  }

  if (pages.length === 0) {
    pages.push({ pageNumber: 1, text: '' });
  }

  return {
    filename,
    pages,
    fullText: pages.map((p) => p.text).join('\n\n'),
  };
}

function cleanText(raw: string): string {
  let text = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  text = text.replace(/[^\S\n]+/g, ' ');
  text = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .join('\n');
  return text.trim();
}

export function chunkDocument(doc: ExtractedDocument): Chunk[] {
  const chunks: Chunk[] = [];

  for (const page of doc.pages) {
    if (!page.text || page.text.trim().length === 0) continue;
    const pageChunks = chunkPageText(page.text);
    for (const chunkText of pageChunks) {
      chunks.push({
        chunk_id: randomUUID(),
        document_name: doc.filename,
        page_number: page.pageNumber,
        text: chunkText.trim(),
      });
    }
  }

  return chunks;
}

function chunkPageText(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length === 0) return [];
  if (words.length <= MAX_CHUNK_WORDS) return [words.join(' ')];

  const chunks: string[] = [];
  let start = 0;

  while (start < words.length) {
    const rawEnd = Math.min(start + MAX_CHUNK_WORDS, words.length);
    let end = rawEnd >= words.length ? words.length : snapToSentence(words, rawEnd);
    end = Math.min(end, start + MAX_CHUNK_WORDS + 30);
    chunks.push(words.slice(start, end).join(' '));
    if (end >= words.length) break;
    start += STRIDE;
  }

  return chunks;
}

function snapToSentence(words: string[], target: number): number {
  const MAX_SEARCH = 30;
  for (let i = target; i < Math.min(target + MAX_SEARCH, words.length); i++) {
    if (/[.!?]$/.test(words[i])) return i + 1;
  }
  for (let i = target - 1; i >= Math.max(target - MAX_SEARCH, 0); i--) {
    if (/[.!?]$/.test(words[i])) return i + 1;
  }
  return target;
}
