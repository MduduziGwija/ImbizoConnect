// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
/* ImbizoConnect — generated artwork: logo mark, field icons, campus
 * skylines, the university map and the Ndebele-inspired pattern band.
 * Everything is SVG built in code so the site ships without image files. */

/* Logo mark: an imbizo, people gathered in a circle around one point. */
function logoMark(size = 30) {
  const dots = Array.from({ length: 6 }, (_, k) => {
    const a = (k / 6) * Math.PI * 2 - Math.PI / 2;
    return `<circle cx="${(16 + Math.cos(a) * 10).toFixed(2)}" cy="${(16 + Math.sin(a) * 10).toFixed(2)}" r="3.1"/>`;
  }).join('');
  return `<svg class="logo-mark" viewBox="0 0 32 32" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="16" cy="16" r="14.5" fill="none" stroke="currentColor" stroke-opacity=".35" stroke-width="1.2" stroke-dasharray="2.2 3"/>
    <g class="logo-dots" fill="currentColor">${dots}</g>
    <circle cx="16" cy="16" r="4.2" fill="currentColor"/>
  </svg>`;
}

/* 24px stroke icons, one per field of study. */
const ICON_PATHS = {
  health:      '<path d="M12 21s-7-4.4-9-9.2C1.7 8.4 3.8 5 7.2 5c2 0 3.6 1.1 4.8 2.8C13.2 6.1 14.8 5 16.8 5 20.2 5 22.3 8.4 21 11.8 19 16.6 12 21 12 21z"/><path d="M5 12h3.5l1.5-3 2.5 6 1.8-3H19"/>',
  engineering: '<path d="M3 21h18"/><path d="M5 21V10l7-5 7 5v11"/><path d="M9 21v-6h6v6"/><path d="M12 5V2"/>',
  science:     '<path d="M9 3h6"/><path d="M10 3v6L4.5 18.5A1.7 1.7 0 0 0 6 21h12a1.7 1.7 0 0 0 1.5-2.5L14 9V3"/><path d="M7.5 15h9"/>',
  commerce:    '<path d="M3 21h18"/><rect x="5" y="12" width="3" height="6" rx="1"/><rect x="10.5" y="8" width="3" height="10" rx="1"/><rect x="16" y="4" width="3" height="14" rx="1"/>',
  law:         '<path d="M12 3v18"/><path d="M7 21h10"/><path d="M4 7h16"/><path d="M6 7l-3 7a3 3 0 0 0 6 0z"/><path d="M18 7l-3 7a3 3 0 0 0 6 0z"/>',
  humanities:  '<path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19 9h1a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-1v3l-3-3h-3"/>',
  education:   '<path d="M2 8l10-5 10 5-10 5z"/><path d="M6 10v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5"/><path d="M22 8v6"/>',
  ict:         '<rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="M9 9l-2 2 2 2"/><path d="M15 9l2 2-2 2"/>',
};
function icon(field, size = 22) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON_PATHS[field] || ''}</svg>`;
}

/* Deterministic pseudo-random numbers from a string seed. */
function rng(seed) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
}

/* A small campus skyline, unique per university. Windows light up on hover. */
function skyline(seed, variant = 'traditional') {
  const r = rng(seed); const W = 320, H = 90;
  let x = -4, blocks = '', windows = '';
  while (x < W) {
    const w = 18 + Math.floor(r() * 34);
    const h = 26 + Math.floor(r() * 46);
    const y = H - h;
    const roof = r();
    blocks += `<rect x="${x}" y="${y}" width="${w}" height="${h}"/>`;
    if (roof > .82 && w > 26) blocks += `<path d="M${x} ${y}L${x + w / 2} ${y - 12}L${x + w} ${y}z"/>`;
    else if (roof > .7 && variant !== 'technology') blocks += `<path d="M${x + w * .2} ${y}a${w * .3} ${w * .3} 0 0 1 ${w * .6} 0z"/>`;
    else if (roof < .08) blocks += `<rect x="${x + w / 2 - 1}" y="${y - 14}" width="2" height="14"/>`;
    for (let wy = y + 7; wy < H - 8; wy += 9) for (let wx = x + 5; wx < x + w - 6; wx += 8)
      if (r() > .45) windows += `<rect x="${wx}" y="${wy}" width="3.5" height="4" rx=".6"/>`;
    x += w + 2 + Math.floor(r() * 5);
  }
  const hills = `<path d="M0 ${H - 18} Q ${W * .25} ${H - 44 - r() * 10} ${W * .5} ${H - 22} T ${W} ${H - 26} V ${H} H 0z"/>`;
  return `<svg class="skyline" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
    <g class="sky-hills">${hills}</g><g class="sky-blocks">${blocks}</g><g class="sky-windows">${windows}</g></svg>`;
}

/* ── Map of South Africa (simplified outline, lon/lat). */
const BORDER = [[16.45,-28.63],[17.4,-28.75],[18.2,-28.9],[19.0,-28.95],[19.9,-28.45],[20.0,-24.77],[20.8,-25.9],[22.2,-26.0],[23.3,-25.3],[24.3,-25.7],[25.6,-25.6],[26.6,-24.7],[27.3,-23.9],[28.1,-22.9],[29.3,-22.2],[30.3,-22.3],[31.3,-22.4],[31.6,-23.5],[32.0,-24.4],[31.95,-25.5],[31.4,-25.75],[30.9,-26.3],[31.1,-27.0],[31.9,-27.3],[32.0,-26.85],[32.9,-26.85],[32.6,-27.9],[32.2,-28.8],[31.3,-29.5],[30.4,-30.8],[29.5,-31.6],[28.4,-32.6],[27.2,-33.5],[25.9,-33.75],[25.6,-34.0],[24.8,-34.2],[23.4,-33.98],[22.2,-34.1],[21.0,-34.4],[20.0,-34.83],[19.3,-34.62],[18.8,-34.38],[18.4,-34.3],[18.45,-33.9],[18.0,-33.1],[18.15,-32.6],[17.85,-31.9],[17.3,-30.6],[16.9,-29.6]];
const LESOTHO = [[27.0,-29.65],[27.55,-28.9],[28.6,-28.6],[29.35,-29.2],[29.45,-29.9],[28.65,-30.6],[27.6,-30.6]];
const ESWATINI = [[30.8,-26.4],[31.3,-25.75],[31.95,-25.95],[32.1,-26.8],[31.3,-27.3],[30.85,-26.9]];
const COORDS = {
  uct:[18.46,-33.96], uwc:[18.63,-33.93], cput:[18.47,-33.93], su:[18.86,-33.93],
  wits:[28.03,-26.19], uj:[27.99,-26.18], up:[28.23,-25.75], tut:[28.16,-25.73], unisa:[28.2,-25.77], smu:[28.02,-25.62], vut:[27.86,-26.71], nwu:[27.09,-26.69],
  ukzn:[30.98,-29.87], dut:[31.0,-29.85], mut:[30.9,-29.97], unizulu:[31.85,-28.85],
  ufs:[26.19,-29.11], cut:[26.22,-29.12], spu:[24.77,-28.74],
  ru:[26.52,-33.31], nmu:[25.67,-34.0], ufh:[26.85,-32.78], wsu:[28.78,-31.59],
  ul:[29.74,-23.88], univen:[30.48,-22.98], ump:[30.97,-25.43],
};
const MAP_W = 460, MAP_H = 400;
const project = ([lon, lat]) => [(lon - 16.0) * 26.6 + 8, (-lat - 22.0) * 29.4 + 10];
const poly = pts => 'M' + pts.map(p => project(p).map(n => n.toFixed(1)).join(' ')).join('L') + 'z';

/* Spread pins in dense cities (Gauteng, Cape Town, Durban) so each can be
 * hovered, keeping a leader line back to the real location. */
function layoutPins(ids) {
  const pins = ids.map(id => { const [x, y] = project(COORDS[id]); return { id, x, y, ox: x, oy: y }; });
  const MIN = 15;
  for (let it = 0; it < 120; it++) {
    for (let a = 0; a < pins.length; a++) for (let b = a + 1; b < pins.length; b++) {
      const p = pins[a], q = pins[b];
      let dx = q.x - p.x, dy = q.y - p.y; let d = Math.hypot(dx, dy);
      if (d < .01) { dx = Math.cos(a + b); dy = Math.sin(a + b); d = 1; }
      if (d < MIN) { const push = (MIN - d) / 2; dx /= d; dy /= d; p.x -= dx * push; p.y -= dy * push; q.x += dx * push; q.y += dy * push; }
    }
    for (const p of pins) { p.x += (p.ox - p.x) * .02; p.y += (p.oy - p.y) * .02; }
  }
  return pins;
}

function map(institutions) {
  const pins = layoutPins(institutions.map(i => i.id).filter(id => COORDS[id]));
  const byId = Object.fromEntries(institutions.map(i => [i.id, i]));
  const cities = [['Johannesburg', 28.05, -26.2, 'r'], ['Cape Town', 18.42, -33.92, 'b'], ['Durban', 31.03, -29.86, 'r'], ['Bloemfontein', 26.2, -29.1, 'l'], ['Gqeberha', 25.6, -33.96, 'b'], ['Polokwane', 29.45, -23.9, 'l']];
  return `<svg class="sa-map" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="Map of South Africa showing all ${pins.length} public universities">
    <defs>
      <pattern id="map-dots" width="7" height="7" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" class="map-dot"/></pattern>
      <filter id="pin-glow" x="-100%" y="-100%" width="300%" height="300%"><feGaussianBlur stdDeviation="3"/></filter>
    </defs>
    <path class="map-land" d="${poly(BORDER)} ${poly(LESOTHO)}" fill-rule="evenodd"/>
    <path class="map-land-dots" d="${poly(BORDER)} ${poly(LESOTHO)}" fill-rule="evenodd" fill="url(#map-dots)"/>
    <path class="map-neighbour" d="${poly(LESOTHO)}"/><path class="map-neighbour" d="${poly(ESWATINI)}"/>
    <text class="map-label" x="${project([28.2, -29.62])[0]}" y="${project([28.2, -29.62])[1]}">Lesotho</text>
    ${cities.map(([name, lon, lat, side]) => { const [x, y] = project([lon, lat]); const dx = side === 'r' ? 16 : side === 'l' ? -16 : 0; const dy = side === 'b' ? 22 : 4; return `<text class="map-city" x="${(x + dx).toFixed(1)}" y="${(y + dy).toFixed(1)}" text-anchor="${side === 'r' ? 'start' : side === 'l' ? 'end' : 'middle'}">${name}</text>`; }).join('')}
    ${pins.map(p => `<line class="map-leader" x1="${p.ox.toFixed(1)}" y1="${p.oy.toFixed(1)}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}"/>`).join('')}
    ${pins.map(p => `<g class="map-pin" data-pin="${p.id}" tabindex="0" role="button" aria-label="${byId[p.id].name}" transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})">
        <circle class="pin-halo" r="11" filter="url(#pin-glow)"/><circle class="pin-dot" r="6"/><circle class="pin-core" r="2.2"/></g>`).join('')}
  </svg>`;
}

/* Ndebele-inspired tile: bold outlines around stepped colour blocks. */
function ndebeleTile() {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='96' height='24' viewBox='0 0 96 24'>
    <rect width='96' height='24' fill='#fdfaf4'/>
    <g stroke='#0b1f3a' stroke-width='2.4' stroke-linejoin='miter'>
      <path d='M0 12L12 0L24 12L12 24Z' fill='#f4a535'/>
      <path d='M24 0h24v24H24z' fill='#fdfaf4'/><path d='M30 6h12v12H30z' fill='#1d9e75'/>
      <path d='M48 12L60 0L72 12L60 24Z' fill='#0c3864'/>
      <path d='M72 0h24v24H72z' fill='#e24b4a'/><path d='M78 6h12v12H78z' fill='#fdfaf4'/>
    </g>
    <g fill='#0b1f3a'><rect x='10' y='10' width='4' height='4'/><rect x='58' y='10' width='4' height='4' fill='#fdfaf4'/></g>
  </svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg.replace(/\s+/g, ' '))}")`;
}

export const ART = { logoMark, icon, skyline, map, ndebeleTile, MAP_W, MAP_H };
