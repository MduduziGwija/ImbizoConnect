// © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
// Supabase backend: real accounts and a shared database. Permissions and the application
// workflow are enforced by supabase/schema.sql (row level security + functions), not by this file.
let sb = null;

const ok = ({ data, error }) => { if (error) throw new Error(error.message); return data; };
const safeName = (n) => n.replace(/[^\w.\-]+/g, '_').slice(-80);
const appUrl = () => location.origin + location.pathname;

function loadLibrary() {
  if (window.supabase) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = new URL('../../../vendor/supabase.min.js', import.meta.url).href;
    s.onload = resolve;
    s.onerror = () => reject(new Error('The Supabase library failed to load.'));
    document.head.append(s);
  });
}

export const supabaseApi = {
  kind: 'supabase',
  enforceDates: true,
  async init({ SUPABASE_URL, SUPABASE_ANON_KEY }) {
    await loadLibrary();
    sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') location.hash = '#/set-password'; });
  },
  async session() {
    const { data: { session } } = await sb.auth.getSession();
    if (!session) return null;
    const p = ok(await sb.from('profiles').select('*').eq('id', session.user.id).maybeSingle());
    if (!p) throw new Error('Your account has no profile. Check that supabase/schema.sql was run before you signed up.');
    return p;
  },
  async signIn(email, password) { ok(await sb.auth.signInWithPassword({ email, password })); },
  async signUp(email, password, full_name) {
    const d = ok(await sb.auth.signUp({ email, password, options: { data: { full_name }, emailRedirectTo: appUrl() } }));
    return { needsConfirmation: !d.session };
  },
  async resetPassword(email) { ok(await sb.auth.resetPasswordForEmail(email, { redirectTo: appUrl() })); },
  async updatePassword(password) { ok(await sb.auth.updateUser({ password })); },
  async signOut() { await sb.auth.signOut(); },

  async profiles() { return ok(await sb.from('profiles').select('*').order('surname')); },
  async saveProfile(patch) {
    const { data: { user } } = await sb.auth.getUser();
    const row = { ...patch };
    for (const k of ['id', 'role', 'institution_id', 'email', 'full_name', 'created_at']) delete row[k];
    return ok(await sb.from('profiles').update(row).eq('id', user.id).select().single());
  },
  async setRole(userId, role, institutionId) { ok(await sb.rpc('set_role', { p_user: userId, p_role: role, p_institution: institutionId || null })); },

  async documents(ownerId) {
    const { data: { user } } = await sb.auth.getUser();
    return ok(await sb.from('documents').select('*').eq('owner_id', ownerId || user.id));
  },
  async uploadDocument(kind, file) {
    if (file.size > 10 * 1048576) throw new Error('That file is over 10 MB. Please compress it.');
    const { data: { user } } = await sb.auth.getUser();
    const old = ok(await sb.from('documents').select('*').eq('owner_id', user.id).eq('kind', kind));
    const path = `${user.id}/${kind}-${Date.now()}-${safeName(file.name)}`;
    ok(await sb.storage.from('documents').upload(path, file, { contentType: file.type || 'application/octet-stream' }));
    if (old.length) {
      await sb.storage.from('documents').remove(old.map((d) => d.path));
      ok(await sb.from('documents').delete().in('id', old.map((d) => d.id)));
    }
    return ok(await sb.from('documents').insert({ owner_id: user.id, kind, name: file.name, size: file.size, type: file.type, path }).select().single());
  },
  async removeDocument(id) {
    const doc = ok(await sb.from('documents').select('*').eq('id', id).single());
    await sb.storage.from('documents').remove([doc.path]);
    ok(await sb.from('documents').delete().eq('id', id));
  },
  async documentUrl(doc) {
    const d = ok(await sb.storage.from('documents').createSignedUrl(doc.path, 300));
    return d.signedUrl;
  },

  async applications() { return ok(await sb.from('applications').select('*').order('submitted_at', { ascending: false })); },
  async events() { return ok(await sb.from('application_events').select('*').order('at')); },
  async submitApplications(items) { return ok(await sb.rpc('submit_applications', { p_items: items })); },
  async studentAction(appId, action, note = '', extra = {}) {
    ok(await sb.rpc('student_action', { p_app: appId, p_action: action, p_note: note || '', p_payment_ref: extra.payment_ref || '' }));
  },
  async officerAction(appId, action, note = '', extra = {}) {
    ok(await sb.rpc('officer_action', { p_app: appId, p_action: action, p_note: note || '', p_offer_choice: extra.offer_choice || null }));
  },
};
