// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// Sign in, create an account, reset a password. In the demo: pick a made-up person instead.
import { signedIn } from '../app.js';
import { byId } from '../logic.js';
import { $, esc, toast, busy, passwordToggles, monogram } from '../ui.js';

const ROLE_BLURB = {
  student: ['Students', 'Build a profile once, apply to several institutions, pay, and follow every application.'],
  officer: ['Admissions officers', 'Review applications to their own institution only: marks, documents and decisions.'],
  admin: ['Administrator', 'Sees every institution and sets who is an admissions officer.'],
};

export async function render(main, ctx, query) {
  const next = query.get('next') || '';
  const api = ctx.api;
  if (api.kind === 'demo') {
    const users = await api.demoUsers();
    const card = (u) => {
      const inst = u.institution_id && byId[u.institution_id];
      const sub = u.role === 'student'
        ? [u.city, u.school_status === 'matric' ? `Matric ${u.matric_year}` : 'Grade 12'].filter(Boolean).join(' · ')
        : u.job_title;
      return `<button class="user-card" data-id="${esc(u.id)}">
        ${inst ? monogram(inst) : `<span class="avatar lg">${esc((u.first_names[0] || '') + (u.surname[0] || ''))}</span>`}
        <span><strong>${esc(u.full_name)}</strong><small>${esc(sub || '')}</small></span></button>`;
    };
    main.innerHTML = `<div class="portal-head"><div><h1>Try ImbizoConnect</h1>
        <p>Pick someone to sign in as. Each person sees only what their role allows. Everything stays in this browser, so click around freely.</p></div></div>
      ${['student', 'officer', 'admin'].map((role) => `
        <section class="role-block"><h2>${ROLE_BLURB[role][0]}</h2><p class="muted">${ROLE_BLURB[role][1]}</p>
        <div class="user-grid">${users.filter((u) => u.role === role).map(card).join('')}</div></section>`).join('')}
      <div class="callout info">Tip: sign in as <strong>Thandiwe</strong> to see a student with offers and a fee to pay, then as <strong>Naledi</strong> (Wits) to review her application. <strong>Sipho</strong> is a new student who hasn't finished his profile.</div>`;
    main.onclick = async (e) => {
      const b = e.target.closest('.user-card');
      if (!b) return;
      main.onclick = null;
      await api.demoLogin(b.dataset.id);
      await signedIn(next);
    };
    return;
  }

  main.innerHTML = `<div class="auth-wrap">
    <div class="card auth-card">
      <h1>Sign in</h1>
      <form id="signin" class="stack" novalidate>
        <label class="field"><span>Email</span><input id="si-email" name="email" type="email" autocomplete="email" required></label>
        <label class="field"><span>Password</span><input id="si-password" name="password" type="password" autocomplete="current-password" required></label>
        <button class="btn btn-primary">Sign in</button>
      </form>
      <p><button class="btn btn-text" id="forgot">Forgot your password?</button></p>
    </div>
    <div class="card auth-card">
      <h2>New here? Create your student account</h2>
      <p class="muted">One profile for every application. It's free.</p>
      <form id="signup" class="stack" novalidate>
        <label class="field"><span>Full name</span><input id="su-name" name="full_name" required autocomplete="name"></label>
        <label class="field"><span>Email</span><input id="su-email" name="email" type="email" required autocomplete="email"></label>
        <label class="field"><span>Password (at least 8 characters)</span><input id="su-password" name="password" type="password" minlength="8" required autocomplete="new-password"></label>
        <label class="check"><input id="su-consent" type="checkbox" name="consent" required> I agree that ImbizoConnect stores my details to send my applications to the institutions I choose (POPIA).</label>
        <button class="btn btn-gold">Create account</button>
      </form>
    </div>
  </div>`;
  passwordToggles(main);
  $('#signin').onsubmit = (e) => {
    e.preventDefault();
    if (!e.target.reportValidity()) return;
    const f = new FormData(e.target);
    busy(e.submitter, async () => { await api.signIn(f.get('email'), f.get('password')); await signedIn(next); });
  };
  $('#signup').onsubmit = (e) => {
    e.preventDefault();
    if (!e.target.reportValidity()) return;
    const f = new FormData(e.target);
    busy(e.submitter, async () => {
      const r = await api.signUp(f.get('email'), f.get('password'), f.get('full_name'));
      if (r.needsConfirmation) toast('Check your email to confirm your account, then sign in.');
      else await signedIn('profile');
    });
  };
  $('#forgot').onclick = () => {
    const email = $('#si-email').value;
    if (!email) { toast('Type your email address first', 'bad'); $('#si-email').focus(); return; }
    busy($('#forgot'), async () => { await api.resetPassword(email); toast('If that address has an account, a reset link is on its way.'); });
  };
}

export async function renderSetPassword(main, ctx) {
  main.innerHTML = `<div class="auth-wrap"><div class="card auth-card"><h1>Choose a new password</h1>
    <form id="setpw" class="stack" novalidate>
      <label class="field"><span>New password (at least 8 characters)</span><input id="np" name="password" type="password" minlength="8" required autocomplete="new-password"></label>
      <button class="btn btn-primary">Save password</button>
    </form></div></div>`;
  passwordToggles(main);
  $('#setpw').onsubmit = (e) => {
    e.preventDefault();
    if (!e.target.reportValidity()) return;
    busy(e.submitter, async () => { await ctx.api.updatePassword(new FormData(e.target).get('password')); toast('Password saved'); await signedIn(); });
  };
}
