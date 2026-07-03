export const config = { runtime: 'edge', maxDuration: 15 };

import { json } from '../lib/store.js';
import { buildSectionFromMd, MD_FILENAME } from '../lib/ai-pm-interview-kb.js';

export default async function handler(req) {
  if (req.method !== 'GET') {
    return json({ error: 'Method not allowed' }, 405);
  }
  const url = new URL(req.url);
  const origin = url.origin;
  const mdUrl = `${origin}/${MD_FILENAME}?t=${Date.now()}`;
  try {
    const res = await fetch(mdUrl, { cache: 'no-store' });
    if (!res.ok) {
      return json({ error: 'Markdown not found', path: MD_FILENAME }, 404);
    }
    const md = await res.text();
    const section = buildSectionFromMd(md);
    if (!section) {
      return json({ error: 'No cards parsed from markdown' }, 500);
    }
    return new Response(JSON.stringify(section), {
      status: 200,
      headers: {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'public, max-age=60, stale-while-revalidate=300'
      }
    });
  } catch (e) {
    return json({ error: String(e?.message || e) }, 500);
  }
}
