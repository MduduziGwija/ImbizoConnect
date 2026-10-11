// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE.
// Finds candidate campus photos on Unsplash (free Unsplash License only: no Unsplash+,
// no sponsored iStock results) and saves small previews to photo-candidates/ for review.
// Run by .github/workflows/photos.yml. Not part of the site.
import { mkdir, writeFile } from 'node:fs/promises';

const QUERIES = ['african university students', 'black university students campus', 'african students studying',
  'south africa university', 'african graduation', 'students library africa', 'african student lecture', 'johannesburg students'];
const UA = { 'User-Agent': 'Mozilla/5.0 (ImbizoConnect photo review; +https://github.com/MduduziGwija/ImbizoConnect)', Accept: 'application/json' };
await mkdir('photo-candidates', { recursive: true });
const seen = new Map();
for (const q of QUERIES) {
  for (const page of [1, 2]) {
    const r = await fetch(`https://unsplash.com/napi/search/photos?query=${encodeURIComponent(q)}&per_page=30&page=${page}`, { headers: UA });
    if (!r.ok) { console.log('search failed', q, r.status); continue; }
    const j = await r.json();
    for (const p of j.results || []) {
      if (p.premium || p.plus || p.sponsorship || seen.has(p.id)) continue;
      seen.set(p.id, { id: p.id, slug: p.slug, alt: p.alt_description, desc: p.description, w: p.width, h: p.height,
        by: p.user?.name, byUrl: p.user?.links?.html, page: p.links?.html, raw: p.urls?.raw, query: q });
    }
  }
}
const list = [...seen.values()].slice(0, 120);
let n = 0;
for (const p of list) {
  const r = await fetch(`${p.raw}&w=360&q=60&fm=jpg&fit=max`);
  if (!r.ok) continue;
  await writeFile(`photo-candidates/${String(++n).padStart(3, '0')}-${p.id}.jpg`, Buffer.from(await r.arrayBuffer()));
  p.n = n;
}
await writeFile('photo-candidates/candidates.json', JSON.stringify(list.filter((p) => p.n), null, 1));
console.log(`${list.length} candidates, ${n} previews`);
