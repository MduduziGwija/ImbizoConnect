// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE.
// Downloads the chosen campus photos (assets/img/campus/photos.json) from Unsplash as
// optimised WebP in two widths. Free Unsplash License; credits are kept in photos.json.
// Run by .github/workflows/photos.yml.
import { readFile, writeFile } from 'node:fs/promises';

const file = 'assets/img/campus/photos.json';
const photos = JSON.parse(await readFile(file, 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (ImbizoConnect; +https://github.com/MduduziGwija/ImbizoConnect)', Accept: 'application/json' };
for (const p of photos) {
  const r = await fetch(`https://unsplash.com/napi/photos/${p.id}`, { headers: UA });
  if (!r.ok) throw new Error(`photo ${p.id}: ${r.status}`);
  const j = await r.json();
  if (j.premium || j.plus) throw new Error(`photo ${p.id} is not under the free Unsplash License`);
  Object.assign(p, { by: j.user.name, byUrl: j.user.links.html, page: j.links.html });
  for (const w of [800, 1600]) {
    const crop = p.crop ? `&fit=crop&crop=${p.crop}&ar=${p.ar || '4:3'}` : '&fit=max';
    const img = await fetch(`${j.urls.raw}&w=${w}&q=72&fm=webp${crop}`);
    if (!img.ok) throw new Error(`download ${p.id}: ${img.status}`);
    await writeFile(`assets/img/campus/${p.name}-${w}.webp`, Buffer.from(await img.arrayBuffer()));
  }
  // Ask Unsplash to count the download, as its API guidelines request.
  if (j.links.download_location) await fetch(j.links.download_location, { headers: UA }).catch(() => {});
}
await writeFile(file, JSON.stringify(photos, null, 2) + '\n');
console.log(`fetched ${photos.length} photos`);
