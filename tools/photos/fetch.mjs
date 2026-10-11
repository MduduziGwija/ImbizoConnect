// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE.
// Downloads the campus photos listed in assets/img/campus/photos.json from Unsplash as
// optimised WebP in two widths, through the official Unsplash API (needs the free
// UNSPLASH_ACCESS_KEY repository secret). Checks each photo is under the free Unsplash
// License, records the photographer for the credit line, and reports the download to
// Unsplash as its API guidelines require. Run by .github/workflows/photos.yml.
import { readFile, writeFile } from 'node:fs/promises';

const file = 'assets/img/campus/photos.json';
const photos = JSON.parse(await readFile(file, 'utf8'));
if (!photos.length) { console.log('No photos listed.'); process.exit(0); }
const KEY = process.env.UNSPLASH_ACCESS_KEY;
if (!KEY) throw new Error('Add the UNSPLASH_ACCESS_KEY repository secret (free at unsplash.com/developers).');
const api = (path) => fetch(`https://api.unsplash.com${path}`, { headers: { Authorization: `Client-ID ${KEY}`, 'Accept-Version': 'v1' } });
for (const p of photos) {
  const r = await api(`/photos/${p.id}`);
  if (!r.ok) throw new Error(`photo ${p.id}: ${r.status}`);
  const j = await r.json();
  if (j.premium || j.plus || /premium_photo/.test(j.urls.raw)) throw new Error(`photo ${p.id} is Unsplash+, not free`);
  Object.assign(p, { by: j.user.name, byUrl: j.user.links.html, page: j.links.html });
  p.alt ||= j.alt_description || '';
  for (const w of [800, 1600]) {
    const crop = p.crop ? `&fit=crop&crop=${p.crop}&ar=${p.ar || '4:3'}` : '&fit=max';
    const img = await fetch(`${j.urls.raw}&w=${w}&q=72&fm=webp${crop}`);
    if (!img.ok) throw new Error(`download ${p.id}: ${img.status}`);
    await writeFile(`assets/img/campus/${p.name}-${w}.webp`, Buffer.from(await img.arrayBuffer()));
  }
  await api(new URL(j.links.download_location).pathname + new URL(j.links.download_location).search);
}
await writeFile(file, JSON.stringify(photos, null, 2) + '\n');
console.log(`fetched ${photos.length} photos`);
