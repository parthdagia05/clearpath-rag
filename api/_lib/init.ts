// Per-PDF chat: documents are uploaded at runtime via /api/upload.
// No pre-baked corpus is loaded at boot. This module is kept as a no-op
// for backwards compatibility with any caller that imports `ensureInitialized`.

let initialized = false;

export async function ensureInitialized(): Promise<void> {
  if (initialized) return;
  initialized = true;
}
