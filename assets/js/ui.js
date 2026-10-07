// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// Small DOM helpers shared by the pages.
import { STATUS } from './logic.js';
import { BRAND } from './data.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const store = {
  get(key, fallback) { try { const v = localStorage.getItem('ic:' + key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem('ic:' + key, JSON.stringify(val)); } catch { /* storage unavailable */ } },
};

export function toast(message, kind = 'ok') {
  let box = $('#toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.setAttribute('role', kind === 'bad' ? 'alert' : 'status');
  t.textContent = message;
  box.append(t);
  while (box.children.length > 3) box.firstElementChild.remove();
  setTimeout(() => t.classList.add('out'), kind === 'bad' ? 6500 : 3200);
  setTimeout(() => t.remove(), kind === 'bad' ? 7000 : 3700);
}

/** Runs an async action while a button shows it is busy; shows errors as a toast. */
export async function busy(button, fn) {
  const label = button?.innerHTML;
  if (button) { button.disabled = true; button.classList.add('is-busy'); }
  try { return await fn(); }
  catch (e) { console.error(e); toast(e.message || String(e), 'bad'); }
  finally { if (button) { button.disabled = false; button.classList.remove('is-busy'); button.innerHTML = label; } }
}

/**
 * Opens a dialog. `body` is an HTML string. Buttons: [{ label, kind, value }].
 * Resolves with { value, form } (the dialog's FormData), or null when dismissed.
 */
export function dialog({ title, body, buttons = [{ label: 'Close', value: null }], wide = false, onOpen }) {
  return new Promise((resolve) => {
    const d = document.createElement('dialog');
    d.className = `modal${wide ? ' wide' : ''}`;
    d.innerHTML = `<form method="dialog" novalidate>
      <header><h2>${esc(title)}</h2><button type="button" class="icon-btn" data-close aria-label="Close"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg></button></header>
      <div class="dialog-body">${body}</div>
      <footer>${buttons.map((b, i) => `<button type="submit" class="btn ${b.kind || 'btn-outline'}" data-i="${i}">${esc(b.label)}</button>`).join('')}</footer>
    </form>`;
    document.body.append(d);
    const form = d.querySelector('form');
    let done = false;
    const finish = (v) => { if (done) return; done = true; d.close(); d.remove(); resolve(v); };
    d.querySelector('[data-close]').onclick = () => finish(null);
    d.addEventListener('cancel', (e) => { e.preventDefault(); finish(null); });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const b = buttons[Number(e.submitter?.dataset.i ?? 0)];
      const hasValue = b.value !== null && b.value !== undefined;
      if (hasValue && b.validate !== false && !form.reportValidity()) return;
      finish(hasValue ? { value: b.value, form: new FormData(form), el: form } : null);
    });
    d.showModal();
    onOpen?.(d);
  });
}

export function statusBadge(status) {
  const s = STATUS[status] || { label: status, tone: 'muted' };
  return `<span class="badge tone-${s.tone}">${esc(s.label)}</span>`;
}

export const brandOf = (inst) => BRAND[inst.id] || { c: '#10294a', w: '#d4a24c', s: '#d4a24c' };
export const brandVars = (inst) => { const b = brandOf(inst); return `--c:${b.c};--w:${b.w};--s:${b.s}`; };
export const monogram = (inst, size = '') => {
  const long = inst.short.length > 4;
  const fs = long ? (size === 'sm' ? ';font-size:8px' : ';font-size:10px') : '';
  return `<span class="uni-mono ${size}" style="background:${brandOf(inst).c}${fs}">${esc(inst.short.slice(0, 7))}</span>`;
};

export const fmtSize = (bytes) => (bytes > 1048576 ? (bytes / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(bytes / 1024)) + ' KB');

export async function copyText(text, done = 'Copied') {
  try { await navigator.clipboard.writeText(text); toast(done); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.append(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch { /* ignore */ }
    ta.remove(); toast(ok ? done : 'Copy failed. Select the text and copy it yourself.', ok ? 'ok' : 'bad');
  }
}

/** Adds show/hide buttons to password fields inside `root`. */
export function passwordToggles(root = document) {
  $$('input[type=password]', root).forEach((input) => {
    if (input.dataset.toggle) return;
    input.dataset.toggle = '1';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pw-toggle'; b.textContent = 'Show';
    b.setAttribute('aria-label', 'Show password');
    b.onclick = () => { const show = input.type === 'password'; input.type = show ? 'text' : 'password'; b.textContent = show ? 'Hide' : 'Show'; };
    input.parentElement.classList.add('pw-wrap');
    input.after(b);
  });
}

export function confetti() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  let cv = $('#confetti');
  if (!cv) { cv = document.createElement('canvas'); cv.id = 'confetti'; cv.className = 'confetti'; document.body.append(cv); }
  const ctx = cv.getContext('2d');
  cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio);
  const colours = ['#d4a24c', '#1a7f5a', '#10294a', '#c0362c', '#f7f6f2'];
  const bits = Array.from({ length: 140 }, () => ({ x: innerWidth / 2 + (Math.random() - 0.5) * 200, y: innerHeight * 0.35, vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4, s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.3, c: colours[Math.floor(Math.random() * colours.length)] }));
  const t0 = performance.now();
  const frame = (now) => {
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const b of bits) { b.vy += 0.35; b.vx *= 0.99; b.x += b.vx; b.y += b.vy; b.r += b.vr; ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(b.r); ctx.fillStyle = b.c; ctx.fillRect(-b.s / 2, -b.s / 4, b.s, b.s / 2); ctx.restore(); }
    if (now - t0 < 2600) requestAnimationFrame(frame); else ctx.clearRect(0, 0, innerWidth, innerHeight);
  };
  requestAnimationFrame(frame);
}
