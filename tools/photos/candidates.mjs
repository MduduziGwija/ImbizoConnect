// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE.
// Saves small previews of candidate student-life photos to photo-candidates/ for review:
// specific free-licence Unsplash photos (direct download links), plus Wikimedia Commons
// search results under CC0 / CC BY / CC BY-SA. Run by .github/workflows/photos.yml on
// working branches (never merged). Not part of the site.
import { mkdir, writeFile, rm } from 'node:fs/promises';

const UNSPLASH = ['dGNvkOOCWeQ', 'HmX3neVpUPs', 'oPwVLHvteAY', 'naeJ0lmTdIg', 'kp7qkHTgSKc', 'LscaHTQsmIY', 'qVmH0x-jfPY',
  'o3o9bewLJ_o', 'gGbuETcoKjw', 'mzAh9viZGAM', 'JGdKrxbg9eY'];
const COMMONS = ['students University of Johannesburg', 'students University of the Witwatersrand library', 'Stellenbosch University students',
  'University of Pretoria students', 'graduation ceremony South Africa', 'students studying South Africa', 'University of KwaZulu-Natal students',
  'Nelson Mandela University students', 'African university students lecture'];
const UA = { 'User-Agent': 'ImbizoConnectPhotoReview/1.0 (https://github.com/MduduziGwija/ImbizoConnect; mduduzigwija@gmail.com)' };
await rm('photo-candidates', { recursive: true, force: true });
await mkdir('photo-candidates', { recursive: true });
const out = []; let n = 0;
const save = async (url, meta) => {
  const r = await fetch(url, { headers: UA, redirect: 'follow' }).catch((e) => ({ ok: false, status: e.message }));
  if (!r.ok) { console.log('skip', meta.id, r.status); return; }
  n += 1;
  await writeFile(`photo-candidates/${String(n).padStart(3, '0')}.jpg`, Buffer.from(await r.arrayBuffer()));
  out.push({ n, ...meta, final: r.url });
};
for (const id of UNSPLASH) await save(`https://unsplash.com/photos/${id}/download?force=true&w=480`, { id, source: 'unsplash' });
for (const q of COMMONS) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrnamespace=6&gsrlimit=12&gsrsearch=${encodeURIComponent(q)}&prop=imageinfo&iiprop=url|extmetadata|size&iiurlwidth=420`;
  const r = await fetch(api, { headers: UA });
  console.log(q, r.status);
  if (!r.ok) continue;
  for (const p of Object.values((await r.json()).query?.pages || {})) {
    const ii = p.imageinfo?.[0]; const m = ii?.extmetadata || {};
    const lic = (m.LicenseShortName?.value || '').toLowerCase();
    if (!/^(cc0|cc by(-sa)? [0-9.]+|public domain)/.test(lic) || !/\.(jpe?g|png)$/i.test(p.title)) continue;
    if (out.some((o) => o.title === p.title)) continue;
    await save(ii.thumburl, { id: p.pageid, source: 'commons', title: p.title, license: m.LicenseShortName?.value, artist: (m.Artist?.value || '').replace(/<[^>]+>/g, '').trim(), page: ii.descriptionurl, w: ii.width, h: ii.height, query: q });
  }
}
await writeFile('photo-candidates/candidates.json', JSON.stringify(out, null, 1));
console.log(`${n} previews`);
