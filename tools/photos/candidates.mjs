// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE.
// Finds candidate student-life photos through Openverse (openly licensed images from Flickr,
// Wikimedia Commons and others), limited to CC0, CC BY and CC BY-SA, and saves small previews
// with their licence and creator to photo-candidates/ for review.
// Run by .github/workflows/photos.yml on working branches (never merged). Not part of the site.
import { mkdir, writeFile } from 'node:fs/promises';

const QUERIES = ['south african university students', 'african university students', 'african students studying',
  'south africa graduation', 'african graduation ceremony', 'students library africa', 'lecture hall students africa',
  'university students campus johannesburg', 'students cape town university', 'african student portrait university'];
const UA = { 'User-Agent': 'ImbizoConnect photo review (+https://github.com/MduduziGwija/ImbizoConnect)' };
await mkdir('photo-candidates', { recursive: true });
const seen = new Map();
for (const q of QUERIES) {
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(q)}&license=cc0,by,by-sa&page_size=20&mature=false&aspect_ratio=wide,square,tall`;
  const r = await fetch(url, { headers: UA });
  console.log(q, r.status);
  if (!r.ok) continue;
  for (const p of (await r.json()).results || []) {
    if (!seen.has(p.id)) seen.set(p.id, { id: p.id, title: p.title, creator: p.creator, creator_url: p.creator_url, license: p.license,
      license_version: p.license_version, license_url: p.license_url, source: p.source, page: p.foreign_landing_url, url: p.url,
      thumb: p.thumbnail, w: p.width, h: p.height, tags: (p.tags || []).map((t) => t.name).slice(0, 12), query: q });
  }
}
let n = 0; const out = [];
for (const p of [...seen.values()].slice(0, 150)) {
  const r = await fetch(p.thumb, { headers: UA }).catch(() => null);
  if (!r?.ok) continue;
  n += 1;
  await writeFile(`photo-candidates/${String(n).padStart(3, '0')}.jpg`, Buffer.from(await r.arrayBuffer()));
  out.push({ n, ...p });
}
await writeFile('photo-candidates/candidates.json', JSON.stringify(out, null, 1));
console.log(`${seen.size} found, ${n} previews`);
