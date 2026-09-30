// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// App shell: picks the backend, handles sign-in, draws the account menu for the user's role
// and routes between the public pages (static HTML sections) and the portal pages.
import { CONFIG } from './config.js';
import { demoApi } from './api/demo.js';
import { supabaseApi } from './api/supabase.js';
import { ART } from './art.js';
import { INTAKE_YEAR, DATA_VERIFIED } from './data.js';
import { ACTIVE } from './logic.js';
import { $, $$, esc, store, toast } from './ui.js';
import * as pub from './pages/public.js';
import * as auth from './pages/auth.js';
import * as profile from './pages/profile.js';
import * as apply from './pages/apply.js';
import * as applications from './pages/applications.js';
import * as admissions from './pages/admissions.js';
import * as admin from './pages/admin.js';

const useSupabase = !!(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
const api = useSupabase ? supabaseApi : demoApi;

// Shared state handed to every page.
export const ctx = {
  api,
  me: null,
  apps: [],
  events: [],
  profiles: [],
  docs: [],
  shortlist: new Set(store.get('shortlist', [])),
  local: { marks: store.get('marks', []), confirmed: store.get('confirmed', false) },
  saveLocal() {
    store.set('shortlist', [...this.shortlist]);
    store.set('marks', this.local.marks);
    store.set('confirmed', this.local.confirmed);
  },
};

const isStudent = (m) => m?.role === 'student';
const isStaff = (m) => m && ['officer', 'admin'].includes(m.role);

/** Reloads everything the signed-in user can see. */
export async function refresh() {
  if (!ctx.me) { Object.assign(ctx, { apps: [], events: [], profiles: [], docs: [] }); return; }
  const me = await api.session();
  if (!me) { ctx.me = null; return refresh(); }
  const [apps, events, profiles, docs] = await Promise.all([
    api.applications(), api.events(), api.profiles(), isStudent(me) ? api.documents() : Promise.resolve([]),
  ]);
  Object.assign(ctx, { me, apps, events, profiles, docs });
}

const PORTAL = {
  signin: { title: 'Sign in', page: auth.render, who: () => true },
  'set-password': { title: 'Set a new password', page: auth.renderSetPassword, who: () => true },
  applications: { title: 'My applications', page: applications.render, who: isStudent },
  profile: { title: 'My profile', page: profile.render, who: isStudent },
  apply: { title: 'New application', page: apply.render, who: isStudent },
  admissions: { title: 'Admissions', page: admissions.render, who: isStaff },
  admin: { title: 'Admin', page: admin.render, who: (m) => m?.role === 'admin' },
};
const PUBLIC = ['home', 'universities', 'aps', 'funding'];
const TITLES = { home: 'ImbizoConnect', universities: 'Universities & fees', aps: 'APS calculator', funding: 'Funding & FAQ' };

export function go(route) { if (location.hash === `#/${route}`) route_(); else location.hash = `#/${route}`; }
export const reload = () => route_();
export const homeFor = (m) => (isStudent(m) ? 'applications' : isStaff(m) ? 'admissions' : 'home');

function parseHash() {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs] = raw.split('?');
  return { name: path || 'home', query: new URLSearchParams(qs || '') };
}

let recovering = /(^|[#&])type=recovery(&|$)/.test(location.hash);

async function route_() {
  let { name, query } = parseHash();
  if (recovering) { recovering = false; name = 'set-password'; }
  pub.closeDrawer(true);
  closeMenu();

  if (PUBLIC.includes(name) || !PORTAL[name]) {
    if (!PUBLIC.includes(name)) name = 'home';
    showScreen(name);
    document.title = name === 'home' ? 'ImbizoConnect' : `${TITLES[name]} · ImbizoConnect`;
    ({ home: pub.home, universities: pub.universities, aps: pub.aps, funding: () => {} })[name](ctx, query);
    scrollTo(0, 0);
    return;
  }

  const r = PORTAL[name];
  if (name !== 'signin' && name !== 'set-password' && !ctx.me) {
    location.hash = `#/signin?next=${encodeURIComponent(name + (query.toString() ? '?' + query : ''))}`;
    return;
  }
  if (ctx.me && name === 'signin') { location.hash = `#/${homeFor(ctx.me)}`; return; }
  if (ctx.me && !r.who(ctx.me)) { location.hash = `#/${homeFor(ctx.me)}`; return; }

  showScreen('portal', name);
  document.title = `${r.title} · ImbizoConnect`;
  const main = $('#portal');
  main.innerHTML = '<p class="loading">Loading…</p>';
  try {
    await refresh();
    renderAccount();
    await r.page(main, ctx, query);
  } catch (e) {
    console.error(e);
    main.innerHTML = `<div class="card"><h2>Something went wrong</h2><p>${esc(e.message)}</p><div class="btn-row"><button class="btn btn-primary" id="retry">Try again</button></div></div>`;
    $('#retry').onclick = () => route_();
  }
  scrollTo(0, 0);
}

function showScreen(screen, portalName = '') {
  $$('.screen').forEach((s) => { s.hidden = s.dataset.screen !== screen; });
  const active = screen === 'portal' ? portalName : screen;
  $$('.primary-nav a[data-route]').forEach((a) => {
    const on = a.dataset.route === active;
    a.classList.toggle('active', on);
    if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
}

/** The right-hand side of the navigation: depends on who is signed in. */
export function renderAccount() {
  const m = ctx.me;
  const el = $('#account-nav');
  if (!m) {
    const n = ctx.shortlist.size;
    el.innerHTML = `<a href="#/signin" data-route="signin">Sign in</a>
      <a href="#/signin?next=apply" class="nav-cta">Apply now${n ? ` <span class="cart-count">${n}</span>` : ''}</a>`;
    return;
  }
  const initials = (m.full_name || m.email || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  let links = '';
  if (isStudent(m)) {
    const active = ctx.apps.filter((a) => ACTIVE.includes(a.status)).length;
    const due = ctx.apps.filter((a) => ['awaiting_payment', 'docs_requested', 'offer'].includes(a.status)).length;
    links = `<a href="#/applications" data-route="applications">My applications${due ? ` <span class="cart-count warn" title="${due} need your attention">${due}</span>` : active ? ` <span class="cart-count">${active}</span>` : ''}</a>
      <a href="#/apply" data-route="apply" class="nav-cta">New application${ctx.shortlist.size ? ` <span class="cart-count">${ctx.shortlist.size}</span>` : ''}</a>`;
  } else {
    links = `<a href="#/admissions" data-route="admissions">Admissions</a>${m.role === 'admin' ? '<a href="#/admin" data-route="admin">Admin</a>' : ''}`;
  }
  const roleLabel = { student: 'Student', officer: 'Admissions officer', admin: 'Administrator' }[m.role];
  el.innerHTML = `${links}
    <details class="acct">
      <summary aria-label="Account menu"><span class="avatar">${esc(initials)}</span></summary>
      <div class="acct-menu" role="menu">
        <div class="acct-who"><strong>${esc(m.full_name || m.email)}</strong><span>${esc(m.job_title || roleLabel)}</span></div>
        ${isStudent(m) ? '<a href="#/profile" role="menuitem">My profile</a><a href="#/applications" role="menuitem">My applications</a>' : ''}
        ${isStaff(m) ? '<a href="#/admissions" role="menuitem">Admissions</a>' : ''}
        ${api.kind === 'demo' ? '<button type="button" data-act="switch" role="menuitem">Switch demo user</button>' : ''}
        <button type="button" data-act="signout" role="menuitem">Sign out</button>
      </div>
    </details>`;
  const cur = parseHash().name;
  $$('a[data-route]', el).forEach((a) => a.classList.toggle('active', a.dataset.route === cur));
}

export async function signedIn(next) {
  ctx.me = await api.session();
  await refresh();
  renderAccount();
  toast(`Welcome, ${ctx.me.first_names || ctx.me.full_name}`);
  location.hash = `#/${next || homeFor(ctx.me)}`;
}

async function signOut(switchUser = false) {
  await api.signOut();
  ctx.me = null;
  await refresh();
  renderAccount();
  location.hash = switchUser ? '#/signin' : '#/';
}

function closeMenu() {
  $('#primary-nav')?.classList.remove('open');
  $('.menu-toggle')?.setAttribute('aria-expanded', 'false');
  $$('details.acct[open]').forEach((d) => d.removeAttribute('open'));
}

function initTheme() {
  const saved = store.get('theme', null);
  if (saved) document.documentElement.dataset.theme = saved;
  $('#theme-toggle').addEventListener('click', () => {
    const dark = document.documentElement.dataset.theme === 'dark'
      || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    store.set('theme', next);
  });
}

function bind() {
  $('.menu-toggle').addEventListener('click', (e) => {
    const open = $('#primary-nav').classList.toggle('open');
    e.currentTarget.setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]');
    if (act?.dataset.act === 'signout') signOut();
    if (act?.dataset.act === 'switch') signOut(true);
    if (act?.dataset.act === 'reset-demo') resetDemo();
    if (!e.target.closest('details.acct')) $$('details.acct[open]').forEach((d) => d.removeAttribute('open'));
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { pub.closeDrawer(); closeMenu(); } });
  window.addEventListener('hashchange', route_);
}

async function resetDemo() {
  await api.demoReset();
  ctx.me = null;
  ctx.shortlist.clear(); ctx.local = { marks: [], confirmed: false }; ctx.saveLocal();
  await refresh(); renderAccount();
  toast('Demo data reset');
  location.hash = '#/signin';
}

async function boot() {
  $$('[data-logo-mark]').forEach((el) => { el.outerHTML = ART.logoMark(30); });
  document.documentElement.style.setProperty('--ndebele', ART.ndebeleTile());
  $$('[data-intake]').forEach((el) => { el.textContent = INTAKE_YEAR; });
  $$('[data-verified]').forEach((el) => { el.textContent = DATA_VERIFIED; });
  initTheme();
  bind();
  if (api.kind === 'demo') {
    const bar = document.createElement('div');
    bar.className = 'demo-banner';
    bar.innerHTML = `<span><strong>Demo.</strong> Made-up students and admissions officers. Everything stays in this browser.</span>
      <button type="button" data-act="switch">Switch user</button><button type="button" data-act="reset-demo">Reset demo</button>`;
    document.body.append(bar);
    document.body.classList.add('has-demo-banner');
  }
  try {
    await api.init(CONFIG);
    ctx.me = await api.session();
    await refresh();
  } catch (e) {
    console.error(e);
    toast(e.message, 'bad');
    ctx.me = null;
  }
  pub.init(ctx, { renderAccount, go });
  renderAccount();
  await route_();
}

boot();
