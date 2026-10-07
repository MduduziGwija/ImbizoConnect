// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// "Tell me when applications open": a visitor leaves an email address and/or a WhatsApp number
// for one or more closed institutions. The request is stored by the backend; sending the
// messages is a job for a real deployment (see README, "Things to know").
import { INSTITUTIONS } from '../data.js';
import { byId, isOpen, alertProblems, normaliseWhatsApp } from '../logic.js';
import { esc, dialog, toast, store, busy } from '../ui.js';
import { ART } from '../art.js';

let C = null;
export const initAlerts = (ctx) => { C = ctx; };

const KEY = 'open-alerts';
const mine = () => new Set(store.get(KEY, []));
export const hasAlert = (id) => mine().has(id);

/** Button for a closed institution's card or drawer: "Alert me when open", or a quiet confirmation once set. */
export function alertButton(i, cls = 'btn-outline btn-sm') {
  if (isOpen(i)) return '';
  return hasAlert(i.id)
    ? `<button class="btn btn-ghost btn-sm alert-set" data-alert="${i.id}" title="Change your alert">${ART.ui('bell-check', 16)} Alert set</button>`
    : `<button class="btn ${cls}" data-alert="${i.id}">${ART.ui('bell', 16)} Alert me when open</button>`;
}

/** Opens the alert form with `ids` ticked. Every closed institution can be ticked from the same form. */
export async function openAlertDialog(ids = []) {
  const closed = INSTITUTIONS.filter((i) => !isOpen(i)).sort((a, b) => a.short.localeCompare(b.short));
  const picked = new Set(ids.length ? ids : []);
  const saved = store.get('open-alert-contact', {});
  const res = await dialog({
    title: 'Tell me when applications open',
    wide: true,
    body: `
      <p class="muted">Applications for these institutions are closed. Leave an email address, a WhatsApp number or both, and you'll get one message when each one opens for the next intake.</p>
      <fieldset class="alert-pick"><legend>Institutions <button type="button" class="link-btn" data-all>Select all ${closed.length}</button></legend>
        <div class="check-grid">${closed.map((i) => `<label class="check-chip"><input type="checkbox" name="inst" value="${i.id}" ${picked.has(i.id) ? 'checked' : ''}><span>${esc(i.short)}</span></label>`).join('')}</div>
      </fieldset>
      <div class="grid-2">
        <label>Email<input type="email" name="email" autocomplete="email" placeholder="you@example.com" value="${esc(saved.email || '')}"></label>
        <label>WhatsApp number<input type="tel" name="whatsapp" autocomplete="tel" inputmode="tel" placeholder="082 123 4567" value="${esc(saved.whatsapp || '')}"></label>
      </div>
      <label class="check"><input type="checkbox" name="consent" required> I agree to be contacted about application dates only. I can ask to stop at any time.</label>
      <p class="form-error" role="alert" hidden></p>
      <p class="hint">ImbizoConnect is a concept and is not affiliated with any institution, so this demo stores your request but sends no messages. Always confirm dates on the institution's own website.</p>`,
    buttons: [{ label: 'Cancel', value: null }, { label: 'Set alert', value: 'ok', kind: 'btn-primary', validate: false }],
    onOpen(d) {
      d.querySelector('[data-all]').onclick = () => {
        const boxes = [...d.querySelectorAll('[name=inst]')]; const all = boxes.every((b) => b.checked);
        boxes.forEach((b) => { b.checked = !all; });
      };
      const form = d.querySelector('form'); const err = d.querySelector('.form-error');
      form.addEventListener('submit', (e) => {
        if (e.submitter?.dataset.i !== '1') return;
        const req = read(form);
        const problems = alertProblems(req);
        if (!form.consent.checked) problems.push('Tick the box to agree to be contacted.');
        if (problems.length) { e.preventDefault(); e.stopImmediatePropagation(); err.textContent = problems.join(' '); err.hidden = false; }
      }, { capture: true });
    },
  });
  if (!res) return;
  const req = read(res.el);
  await busy(null, async () => {
    await C.api.addAlert(req);
    store.set(KEY, [...new Set([...mine(), ...req.institution_ids])]);
    store.set('open-alert-contact', { email: req.email, whatsapp: res.form.get('whatsapp') || '' });
    const how = [req.email && 'email', req.whatsapp && 'WhatsApp'].filter(Boolean).join(' and ');
    const n = req.institution_ids.length;
    toast(`Alert set for ${n === 1 ? byId[req.institution_ids[0]].short : `${n} institutions`}. We'll use ${how}.`, 'success');
    // Swap every visible single-institution alert button for its "Alert set" state.
    document.querySelectorAll('[data-alert]').forEach((b) => {
      const id = b.dataset.alert; if (id && !id.includes(',') && hasAlert(id)) b.outerHTML = alertButton(byId[id]);
    });
  });
}

function read(form) {
  const fd = new FormData(form);
  const raw = String(fd.get('whatsapp') || '').trim();
  return {
    institution_ids: fd.getAll('inst').map(String),
    email: String(fd.get('email') || '').trim().toLowerCase(),
    whatsapp: raw ? (normaliseWhatsApp(raw) || raw) : '',
  };
}
