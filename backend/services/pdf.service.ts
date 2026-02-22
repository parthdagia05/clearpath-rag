// services/pdf.service.ts
// PDF ingestion using pdfjs-dist with per-page text extraction

import fs from 'fs';
import path from 'path';
import { ExtractedDocument, ExtractedPage } from '../types';

// pdfjs-dist v5 legacy build — compatible with CommonJS / ts-node
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.mjs');

/**
 * Extract text from a single PDF file using pdfjs-dist.
 * Extracts text per-page, preserving page boundaries.
 */
export async function extractPdf(filePath: string): Promise<ExtractedDocument> {
  const absolutePath = path.resolve(filePath);
  const buffer = fs.readFileSync(absolutePath);
  const name = path.basename(absolutePath, '.pdf');

  // Load the PDF document
  const data = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({
    data,
    useSystemFonts: true,
  }).promise;

  const pages: ExtractedPage[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const textContent = await page.getTextContent();

    // Join text items — items with `hasEOL` get a newline appended
    const strings: string[] = [];
    for (const item of textContent.items as any[]) {
      if (typeof item.str === 'string') {
        strings.push(item.str);
        if (item.hasEOL) {
          strings.push('\n');
        }
      }
    }
    const pageText = strings.join('');
    pages.push({ pageNumber: i, text: pageText });
  }

  // Fallback: if somehow no pages were extracted, create a single empty page
  if (pages.length === 0) {
    pages.push({ pageNumber: 1, text: '' });
  }

  // Clean each page's text
  const cleanedPages = pages.map((p) => ({
    ...p,
    text: cleanText(p.text),
  }));

  return {
    name,
    pages: cleanedPages,
    fullText: cleanedPages.map((p) => p.text).join('\n\n'),
  };
}

/**
 * Clean extracted PDF text:
 * - Normalize line breaks (CRLF → LF)
 * - Collapse excessive whitespace
 * - Remove empty lines
 * - Attempt to remove repeating headers/footers
 */
export function cleanText(raw: string): string {
  let text = raw;

  // Normalize line breaks
  text = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Collapse multiple spaces into one (within lines)
  text = text.replace(/[^\S\n]+/g, ' ');

  // Remove leading/trailing whitespace per line
  text = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');

  // Remove repeating headers/footers
  text = removeRepeatingHeadersFooters(text);

  return text.trim();
}

/**
 * Detect and remove lines that repeat frequently (likely headers/footers).
 * A line appearing in more than 30% of "page-like" sections is considered a header/footer.
 */
function removeRepeatingHeadersFooters(text: string): string {
  const lines = text.split('\n');
  if (lines.length < 10) return text;

  // Count occurrences of each line
  const lineCounts = new Map<string, number>();
  for (const line of lines) {
    const normalized = line.trim().toLowerCase();
    if (normalized.length < 3) continue; // Skip very short lines
    lineCounts.set(normalized, (lineCounts.get(normalized) || 0) + 1);
  }

  // Estimate "page count" — rough heuristic: every ~40 lines is a page
  const estimatedPages = Math.max(1, Math.floor(lines.length / 40));
  const threshold = Math.max(3, Math.floor(estimatedPages * 0.3));

  // Build set of repeating lines to remove
  const repeatingLines = new Set<string>();
  for (const [line, count] of lineCounts) {
    if (count >= threshold) {
      repeatingLines.add(line);
    }
  }

  // Filter them out
  const filtered = lines.filter(
    (line) => !repeatingLines.has(line.trim().toLowerCase())
  );

  return filtered.join('\n');
}

/**
 * Extract all PDFs from a directory.
 * Fails gracefully per-document — one bad PDF won't stop the rest.
 */
export async function extractAllPdfs(
  docsDir: string
): Promise<ExtractedDocument[]> {
  const absoluteDir = path.resolve(docsDir);

  if (!fs.existsSync(absoluteDir)) {
    console.warn(
      `[PDF Service] Docs directory not found: ${absoluteDir}. Skipping ingestion.`
    );
    return [];
  }

  const files = fs
    .readdirSync(absoluteDir)
    .filter((f) => f.toLowerCase().endsWith('.pdf'))
    .sort();

  if (files.length === 0) {
    console.warn(`[PDF Service] No PDF files found in ${absoluteDir}.`);
    return [];
  }

  console.log(`[PDF Service] Found ${files.length} PDF(s) in ${absoluteDir}`);

  const documents: ExtractedDocument[] = [];
  let failedCount = 0;

  for (const file of files) {
    const filePath = path.join(absoluteDir, file);
    try {
      console.log(`[PDF Service]   Processing: ${file}`);
      const doc = await extractPdf(filePath);
      documents.push(doc);
    } catch (err: any) {
      failedCount++;
      const message = err?.message || String(err);
      console.error(`[PDF Service]   ❌ FAILED: ${file} — ${message}`);
    }
  }

  if (failedCount > 0) {
    console.warn(
      `[PDF Service] ${failedCount}/${files.length} document(s) failed to process.`
    );
  }

  return documents;
}
