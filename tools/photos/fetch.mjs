// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE.
// Downloads the chosen campus photos (assets/img/campus/photos.json) as optimised WebP in two
// widths, after checking each is under the free Unsplash License. Credits stay in photos.json.
// Run by .github/workflows/photos.yml.
import { readFile, writeFile } from 'node:fs/promises';

const file = 'assets/img/campus/photos.json';
const photos = JSON.parse(await readFile(file, 'utf8'));
const UA = { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36', 'Accept-Language': 'en' };
for (const p of photos) {
  const page = await (await fetch(`https://unsplash.com/photos/${p.slug}`, { headers: UA })).text();
  if (!/Unsplash License/.test(page)) throw new Error(`photo ${p.slug}: free Unsplash License not found`);
  const img = (page.match(/https:\/\/images\.unsplash\.com\/photo-[^"?\s]+/) || [])[0];
  if (!img || /premium_photo/.test(img)) throw new Error(`photo ${p.slug}: no free image`);
  const by = (page.match(/<title>(?:[^<]*?)photo by ([^<]+?) on Unsplash<\/title>/i) || [])[1];
  if (by && !p.by) p.by = by.trim();
  p.page = `https://unsplash.com/photos/${p.slug}`;
  for (const w of [800, 1600]) {
    const crop = p.crop ? `&fit=crop&crop=${p.crop}&ar=${p.ar || '4:3'}` : '&fit=max';
    const r = await fetch(`${img}?w=${w}&q=72&fm=webp${crop}`);
    if (!r.ok) throw new Error(`download ${p.slug}: ${r.status}`);
    await writeFile(`assets/img/campus/${p.name}-${w}.webp`, Buffer.from(await r.arrayBuffer()));
  }
}
await writeFile(file, JSON.stringify(photos, null, 2) + '\n');
console.log(`fetched ${photos.length} photos`);
