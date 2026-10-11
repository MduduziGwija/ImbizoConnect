// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE.
// Finds candidate campus photos on Unsplash's public search pages, filtered to the free
// Unsplash License (license=free), and saves small previews to photo-candidates/ for review.
// Run by .github/workflows/photos.yml on working branches. Not part of the site.
import { mkdir, writeFile } from 'node:fs/promises';

const QUERIES = ['african-university-students', 'black-university-students', 'african-students-studying', 'south-africa-university',
  'african-graduation', 'black-graduation', 'african-student-library', 'black-students-studying', 'african-college-students', 'university-lecture-hall'];
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'Accept-Language': 'en' };
await mkdir('photo-candidates', { recursive: true });
const seen = new Map();
for (const q of QUERIES) {
  const r = await fetch(`https://unsplash.com/s/photos/${q}?license=free`, { headers: UA });
  const html = await r.text();
  console.log(q, r.status, html.length);
  for (const m of html.matchAll(/href="\/photos\/([a-z0-9-]*?-?([A-Za-z0-9_-]{11}))"/g)) {
    const [, slug, id] = m;
    if (!seen.has(id)) seen.set(id, { id, slug, query: q });
  }
}
console.log('found', seen.size);
let n = 0;
const out = [];
for (const p of [...seen.values()].slice(0, 140)) {
  const page = await (await fetch(`https://unsplash.com/photos/${p.slug}`, { headers: UA })).text();
  if (/Unsplash\+ License|unsplash\.com\/plus/i.test(page.slice(0, 200000)) && !/Unsplash License/.test(page)) continue;
  const title = (page.match(/<title>([^<]*)<\/title>/) || [])[1] || '';
  const img = (page.match(/https:\/\/images\.unsplash\.com\/photo-[^"?\s]+/) || [])[0];
  if (!img || /premium_photo/.test(img)) continue;
  const r = await fetch(`${img}?w=360&q=60&fm=jpg&fit=max`);
  if (!r.ok) continue;
  n += 1;
  await writeFile(`photo-candidates/${String(n).padStart(3, '0')}-${p.id}.jpg`, Buffer.from(await r.arrayBuffer()));
  out.push({ n, ...p, title, img });
}
await writeFile('photo-candidates/candidates.json', JSON.stringify(out, null, 1));
console.log(`${n} previews`);
