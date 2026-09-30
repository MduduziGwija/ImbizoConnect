-- © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE. Unauthorised copying or use is prohibited.
-- ImbizoConnect database. Run once in Supabase: SQL Editor -> New query -> paste -> Run.
--
-- Who can see what (enforced here by row level security, not by the web page):
--   * Students see and edit only their own profile, documents and applications.
--   * Admissions officers see applications to their own institution (once the fee is paid, or
--     when there is no fee) and the profile, marks and documents of those applicants only.
--   * Admins see everything and set roles. The first account created becomes admin.
-- Applications are created and moved through their statuses only by the functions at the
-- bottom of this file, which re-check every rule (closing dates, CAO fee, allowed actions).

create extension if not exists pgcrypto;

-- ───────────────────────── reference data
create table if not exists public.institutions (
  id text primary key,
  short text not null,
  name text not null,
  fee int not null default 0,           -- application fee for SA applicants, in rand
  cao boolean not null default false,   -- applies through the Central Applications Office (KZN)
  closes date not null,                 -- closing date for the current intake
  fields text[] not null default '{}'   -- faculties offered
);

insert into public.institutions (id, short, name, fee, cao, closes, fields) values
  ('uct', 'UCT', 'University of Cape Town', 100, false, '2026-07-31', '{health,engineering,science,commerce,law,humanities,ict}'),
  ('wits', 'Wits', 'University of the Witwatersrand', 100, false, '2026-09-30', '{health,engineering,science,commerce,law,humanities,education,ict}'),
  ('up', 'UP', 'University of Pretoria', 300, false, '2026-06-30', '{health,engineering,science,commerce,law,humanities,education,ict}'),
  ('su', 'SU', 'Stellenbosch University', 100, false, '2026-07-31', '{health,engineering,science,commerce,law,humanities,education,ict}'),
  ('uj', 'UJ', 'University of Johannesburg', 0, false, '2026-10-31', '{health,engineering,science,commerce,law,humanities,education,ict}'),
  ('ukzn', 'UKZN', 'University of KwaZulu-Natal', 250, true, '2026-09-30', '{health,engineering,science,commerce,law,humanities,education,ict}'),
  ('nwu', 'NWU', 'North-West University', 0, false, '2026-09-30', '{health,engineering,science,commerce,law,humanities,education,ict}'),
  ('ufs', 'UFS', 'University of the Free State', 0, false, '2026-09-30', '{health,engineering,science,commerce,law,humanities,education,ict}'),
  ('ru', 'Rhodes', 'Rhodes University', 100, false, '2026-09-30', '{health,science,commerce,law,humanities,education,ict}'),
  ('nmu', 'NMU', 'Nelson Mandela University', 0, false, '2026-09-30', '{health,engineering,science,commerce,law,humanities,education,ict}'),
  ('uwc', 'UWC', 'University of the Western Cape', 0, false, '2026-09-30', '{health,science,commerce,law,humanities,education,ict}'),
  ('ufh', 'UFH', 'University of Fort Hare', 120, false, '2026-10-31', '{health,science,commerce,law,humanities,education,ict}'),
  ('wsu', 'WSU', 'Walter Sisulu University', 100, false, '2026-10-31', '{health,engineering,science,commerce,law,humanities,education,ict}'),
  ('ul', 'UL', 'University of Limpopo', 200, false, '2026-09-30', '{health,science,commerce,law,humanities,education,ict}'),
  ('univen', 'UNIVEN', 'University of Venda', 0, false, '2026-09-26', '{health,science,commerce,law,humanities,education,ict}'),
  ('ump', 'UMP', 'University of Mpumalanga', 200, false, '2026-11-30', '{science,commerce,humanities,education,ict}'),
  ('spu', 'SPU', 'Sol Plaatje University', 0, false, '2026-11-30', '{science,commerce,humanities,education,ict}'),
  ('smu', 'SMU', 'Sefako Makgatho Health Sciences University', 300, false, '2026-07-31', '{health,science}'),
  ('unisa', 'UNISA', 'University of South Africa', 150, false, '2026-10-09', '{science,commerce,law,humanities,education,ict}'),
  ('unizulu', 'UNIZULU', 'University of Zululand', 250, true, '2026-09-30', '{health,science,commerce,law,humanities,education,ict}'),
  ('tut', 'TUT', 'Tshwane University of Technology', 240, false, '2026-09-30', '{health,engineering,science,commerce,humanities,education,ict}'),
  ('cput', 'CPUT', 'Cape Peninsula University of Technology', 0, false, '2026-09-30', '{health,engineering,science,commerce,humanities,education,ict}'),
  ('cut', 'CUT', 'Central University of Technology', 0, false, '2026-09-30', '{health,engineering,science,commerce,education,ict}'),
  ('vut', 'VUT', 'Vaal University of Technology', 100, false, '2026-09-30', '{engineering,science,commerce,humanities,ict}'),
  ('dut', 'DUT', 'Durban University of Technology', 250, true, '2026-09-30', '{health,engineering,science,commerce,humanities,ict}'),
  ('mut', 'MUT', 'Mangosuthu University of Technology', 250, true, '2026-09-30', '{engineering,science,commerce,ict}')
on conflict (id) do update set short = excluded.short, name = excluded.name, fee = excluded.fee, cao = excluded.cao,
  closes = excluded.closes, fields = excluded.fields;

create table if not exists public.courses (
  id text primary key,
  field text not null
);
insert into public.courses (id, field) values
  ('mbchb', 'health'),
  ('bpharm', 'health'),
  ('nursing', 'health'),
  ('physio', 'health'),
  ('radio', 'health'),
  ('ot', 'health'),
  ('civil', 'engineering'),
  ('elec', 'engineering'),
  ('mech', 'engineering'),
  ('chem', 'engineering'),
  ('arch', 'engineering'),
  ('bsc', 'science'),
  ('actsci', 'science'),
  ('agri', 'science'),
  ('envsci', 'science'),
  ('acc', 'commerce'),
  ('fin', 'commerce'),
  ('econ', 'commerce'),
  ('mgmt', 'commerce'),
  ('hr', 'commerce'),
  ('mkt', 'commerce'),
  ('llb', 'law'),
  ('balaw', 'law'),
  ('bcomlaw', 'law'),
  ('psych', 'humanities'),
  ('bsw', 'humanities'),
  ('media', 'humanities'),
  ('polsci', 'humanities'),
  ('bedfp', 'education'),
  ('bedsp', 'education'),
  ('bedmath', 'education'),
  ('cs', 'ict'),
  ('it', 'ict'),
  ('ds', 'ict'),
  ('is', 'ict')
on conflict (id) do update set field = excluded.field;

create table if not exists public.settings (
  id int primary key default 1 check (id = 1),
  intake_year int not null default 2027,
  cao_fee int not null default 250,
  cao_max_choices int not null default 6,
  max_institutions int not null default 8,
  enforce_dates boolean not null default true,
  ref_counter int not null default 0
);
insert into public.settings (id) values (1) on conflict do nothing;

-- ───────────────────────── people
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'student' check (role in ('student', 'officer', 'admin')),
  institution_id text references public.institutions,
  email text not null default '',
  full_name text not null default '',
  first_names text not null default '',
  surname text not null default '',
  id_number text not null default '',
  phone text not null default '',
  province text not null default '',
  address text not null default '',
  city text not null default '',
  postal_code text not null default '',
  home_language text not null default '',
  guardian_name text not null default '',
  guardian_phone text not null default '',
  guardian_relation text not null default '',
  school text not null default '',
  school_status text not null default 'gr12' check (school_status in ('gr12', 'matric', 'upgrade')),
  matric_year int,
  nsfas boolean not null default false,
  disability boolean not null default false,
  marks jsonb not null default '[]',          -- [{ "s": subject, "m": percentage }]
  marks_term text not null default 'gr11' check (marks_term in ('gr11', 'gr12_june', 'final')),
  marks_confirmed_at timestamptz,
  job_title text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles on delete cascade,
  kind text not null check (kind in ('id', 'gr11', 'gr12', 'res', 'photo', 'guard', 'income')),
  name text not null,
  size int not null default 0,
  type text not null default '',
  path text not null,                         -- storage path: <owner id>/<kind>-<file name>
  uploaded_at timestamptz not null default now(),
  unique (owner_id, kind)
);

-- ───────────────────────── applications
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  student_id uuid not null references public.profiles on delete cascade,
  institution_id text not null references public.institutions,
  choice1 text not null references public.courses,
  choice2 text references public.courses,
  status text not null check (status in ('awaiting_payment', 'submitted', 'under_review', 'docs_requested', 'waitlisted',
    'offer', 'declined', 'accepted', 'offer_declined', 'withdrawn')),
  fee int not null default 0,
  cao_group uuid,
  payment_ref text,
  paid_at timestamptz,
  offer_choice text references public.courses,
  decision_note text not null default '',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- One live application per institution per student.
create unique index if not exists applications_one_per_institution
  on public.applications (student_id, institution_id) where status <> 'withdrawn';
create index if not exists applications_institution on public.applications (institution_id, status);

create table if not exists public.application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.applications on delete cascade,
  actor_id uuid,
  actor_name text not null default '',
  action text not null,
  note text not null default '',
  at timestamptz not null default now()
);
create index if not exists events_application on public.application_events (application_id, at);

-- ───────────────────────── helpers
create or replace function public.my_role() returns text
  language sql stable security definer set search_path = public as
$$ select role from profiles where id = auth.uid() $$;

create or replace function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select coalesce((select role = 'admin' from profiles where id = auth.uid()), false) $$;

create or replace function public.my_institution() returns text
  language sql stable security definer set search_path = public as
$$ select institution_id from profiles where id = auth.uid() and role = 'officer' $$;

-- True when the signed-in officer has a (paid or free) application from this student.
create or replace function public.officer_sees_student(p_student uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from applications a where a.student_id = p_student
       and a.institution_id = my_institution() and a.status <> 'awaiting_payment') $$;

-- SA ID number: valid date of birth and Luhn check digit.
create or replace function public.valid_sa_id(p text) returns boolean
  language plpgsql immutable as $$
declare s int := 0; d int; k int;
begin
  if p is null or p !~ '^[0-9]{13}$' then return false; end if;
  begin
    perform make_date(2000 + substr(p, 1, 2)::int, substr(p, 3, 2)::int, substr(p, 5, 2)::int);
  exception when others then return false;
  end;
  for k in 1..13 loop
    d := substr(p, k, 1)::int;
    if k % 2 = 0 then d := d * 2; if d > 9 then d := d - 9; end if; end if;
    s := s + d;
  end loop;
  return s % 10 = 0;
end $$;

-- New sign-ups get a student profile. The very first account becomes admin.
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer set search_path = public as $$
declare n text := coalesce(new.raw_user_meta_data ->> 'full_name', '');
begin
  insert into profiles (id, email, full_name, first_names, surname, role)
  values (new.id, coalesce(new.email, ''), n, split_part(n, ' ', 1), nullif(regexp_replace(n, '^\S+\s*', ''), ''),
          case when exists (select 1 from profiles) then 'student' else 'admin' end)
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Only admins change roles, institutions and email; ID numbers must be valid.
create or replace function public.guard_profile_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() and (new.role is distinct from old.role or new.institution_id is distinct from old.institution_id
     or new.email is distinct from old.email or new.id is distinct from old.id or new.created_at is distinct from old.created_at) then
    raise exception 'Only an admin can change roles, institutions or email addresses';
  end if;
  if new.id_number <> '' and new.id_number is distinct from old.id_number and not valid_sa_id(new.id_number) then
    raise exception 'That SA ID number is not valid';
  end if;
  new.full_name := trim(new.first_names || ' ' || new.surname);
  if new.full_name = '' then new.full_name := old.full_name; end if;
  return new;
end $$;
drop trigger if exists guard_profile on public.profiles;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile_update();

-- ───────────────────────── row level security
alter table public.institutions enable row level security;
alter table public.courses enable row level security;
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;

drop policy if exists institutions_read on public.institutions;
create policy institutions_read on public.institutions for select to anon, authenticated using (true);
drop policy if exists institutions_write on public.institutions;
create policy institutions_write on public.institutions for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists courses_read on public.courses;
create policy courses_read on public.courses for select to anon, authenticated using (true);
drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select to authenticated using (true);
drop policy if exists settings_write on public.settings;
create policy settings_write on public.settings for update to authenticated using (is_admin()) with check (is_admin());

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or is_admin() or officer_sees_student(id));
drop policy if exists profiles_write on public.profiles;
create policy profiles_write on public.profiles for update to authenticated
  using (id = auth.uid() or is_admin()) with check (id = auth.uid() or is_admin());

drop policy if exists documents_read on public.documents;
create policy documents_read on public.documents for select to authenticated
  using (owner_id = auth.uid() or is_admin() or officer_sees_student(owner_id));
drop policy if exists documents_insert on public.documents;
create policy documents_insert on public.documents for insert to authenticated
  with check (owner_id = auth.uid() and my_role() = 'student' and path like auth.uid()::text || '/%');
drop policy if exists documents_delete on public.documents;
create policy documents_delete on public.documents for delete to authenticated using (owner_id = auth.uid());

drop policy if exists applications_read on public.applications;
create policy applications_read on public.applications for select to authenticated
  using (student_id = auth.uid() or is_admin() or (institution_id = my_institution() and status <> 'awaiting_payment'));

drop policy if exists events_read on public.application_events;
create policy events_read on public.application_events for select to authenticated
  using (exists (select 1 from applications a where a.id = application_id));

-- Private file storage for documents: <owner id>/<file>.
insert into storage.buckets (id, name, public) values ('documents', 'documents', false) on conflict (id) do nothing;
drop policy if exists documents_files_read on storage.objects;
create policy documents_files_read on storage.objects for select to authenticated using (
  bucket_id = 'documents' and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()
    or officer_sees_student(((storage.foldername(name))[1])::uuid)));
drop policy if exists documents_files_write on storage.objects;
create policy documents_files_write on storage.objects for insert to authenticated with check (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists documents_files_update on storage.objects;
create policy documents_files_update on storage.objects for update to authenticated using (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists documents_files_delete on storage.objects;
create policy documents_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'documents' and (storage.foldername(name))[1] = auth.uid()::text);

-- ───────────────────────── workflow
create or replace function public.log_event(p_app uuid, p_action text, p_note text default '') returns void
  language sql security definer set search_path = public as
$$ insert into application_events (application_id, actor_id, actor_name, action, note)
    values (p_app, auth.uid(), coalesce((select full_name from profiles where id = auth.uid()), ''), p_action, coalesce(p_note, '')) $$;

-- Submits applications to several institutions at once.
-- p_items: [{ "institution_id": "wits", "choice1": "acc", "choice2": "mgmt" }, ...]
create or replace function public.submit_applications(p_items jsonb) returns setof public.applications
  language plpgsql security definer set search_path = public as $$
declare
  me profiles; cfg settings; it jsonb; inst institutions; c1 courses; c2 courses; app applications;
  cao_group uuid; cao_paid applications; cao_fee_taken boolean; cao_choices int; n_insts int; v_fee int; v_status text;
begin
  select * into me from profiles where id = auth.uid();
  if me.id is null or me.role <> 'student' then raise exception 'Only students can apply'; end if;
  select * into cfg from settings where id = 1;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Choose at least one institution'; end if;

  -- The profile must be complete before applying.
  if trim(me.first_names) = '' or trim(me.surname) = '' or not valid_sa_id(me.id_number) or trim(me.phone) = ''
     or trim(me.province) = '' or trim(me.address) = '' or trim(me.school) = '' or trim(me.guardian_name) = '' then
    raise exception 'Complete your personal and school details first';
  end if;
  if me.marks_confirmed_at is null then raise exception 'Confirm your marks first'; end if;
  if (select count(*) from documents where owner_id = me.id and kind in ('id', 'gr11')) < 2 then
    raise exception 'Upload your ID and latest school results first';
  end if;

  select count(distinct institution_id) into n_insts from applications where student_id = me.id and status <> 'withdrawn';
  if n_insts + jsonb_array_length(p_items) > cfg.max_institutions then
    raise exception 'You can apply to at most % institutions per intake', cfg.max_institutions;
  end if;

  select a.cao_group into cao_group from applications a join institutions i on i.id = a.institution_id
    where a.student_id = me.id and i.cao and a.cao_group is not null limit 1;
  select a.* into cao_paid from applications a join institutions i on i.id = a.institution_id
    where a.student_id = me.id and i.cao and a.paid_at is not null limit 1;
  cao_fee_taken := cao_group is not null;
  cao_group := coalesce(cao_group, gen_random_uuid());
  select coalesce(sum(case when a.choice2 is null then 1 else 2 end), 0) into cao_choices
    from applications a join institutions i on i.id = a.institution_id
    where a.student_id = me.id and i.cao and a.status <> 'withdrawn';

  for it in select * from jsonb_array_elements(p_items) loop
    select * into inst from institutions where id = it ->> 'institution_id';
    if inst.id is null then raise exception 'Unknown institution'; end if;
    if cfg.enforce_dates and inst.closes < current_date then raise exception '% closed on %', inst.short, to_char(inst.closes, 'DD Mon YYYY'); end if;
    if exists (select 1 from applications where student_id = me.id and institution_id = inst.id and status <> 'withdrawn') then
      raise exception 'You already applied to %', inst.short;
    end if;
    select * into c1 from courses where id = it ->> 'choice1';
    if c1.id is null or not (c1.field = any (inst.fields)) then raise exception '% does not offer your first choice', inst.short; end if;
    c2 := null;
    if coalesce(it ->> 'choice2', '') <> '' then
      select * into c2 from courses where id = it ->> 'choice2';
      if c2.id is null or not (c2.field = any (inst.fields)) then raise exception '% does not offer your second choice', inst.short; end if;
      if c2.id = c1.id then raise exception 'Your two choices at % are the same', inst.short; end if;
    end if;

    if inst.cao then
      cao_choices := cao_choices + case when c2.id is null then 1 else 2 end;
      if cao_choices > cfg.cao_max_choices then raise exception 'The CAO allows % programme choices in total', cfg.cao_max_choices; end if;
      v_fee := case when cao_fee_taken then 0 else cfg.cao_fee end;
      cao_fee_taken := true;
      v_status := case when cao_paid.id is not null then 'submitted' else 'awaiting_payment' end;
    else
      v_fee := inst.fee;
      v_status := case when inst.fee > 0 then 'awaiting_payment' else 'submitted' end;
    end if;

    update settings set ref_counter = ref_counter + 1 where id = 1 returning * into cfg;
    insert into applications (ref, student_id, institution_id, choice1, choice2, status, fee, cao_group, payment_ref, paid_at)
    values ('IC' || right(cfg.intake_year::text, 2) || '-' || lpad(cfg.ref_counter::text, 6, '0'), me.id, inst.id, c1.id, c2.id,
            v_status, v_fee, case when inst.cao then cao_group end,
            case when inst.cao then cao_paid.payment_ref end, case when inst.cao then cao_paid.paid_at end)
    returning * into app;
    perform log_event(app.id, 'submit', case when inst.cao then 'Sent through the CAO' else '' end);
    return next app;
  end loop;
end $$;

-- Student actions: pay (records the payment reference), respond, accept, decline_offer, withdraw.
create or replace function public.student_action(p_app uuid, p_action text, p_note text default '', p_payment_ref text default '')
  returns void language plpgsql security definer set search_path = public as $$
declare app applications; t applications; allowed text[]; next_status text;
begin
  select * into app from applications where id = p_app and student_id = auth.uid() for update;
  if app.id is null then raise exception 'Application not found'; end if;
  case p_action
    when 'pay' then allowed := '{awaiting_payment}'; next_status := 'submitted';
    when 'respond' then allowed := '{docs_requested}'; next_status := 'under_review';
    when 'accept' then allowed := '{offer}'; next_status := 'accepted';
    when 'decline_offer' then allowed := '{offer}'; next_status := 'offer_declined';
    when 'withdraw' then allowed := '{awaiting_payment,submitted,under_review,docs_requested,waitlisted}'; next_status := 'withdrawn';
    else raise exception 'Unknown action';
  end case;
  if not (app.status = any (allowed)) then raise exception 'That action is not available for this application'; end if;
  if p_action = 'respond' and trim(coalesce(p_note, '')) = '' then raise exception 'Please add a note explaining this'; end if;
  if p_action = 'pay' and trim(coalesce(p_payment_ref, '')) = '' then raise exception 'Enter the payment reference from your proof of payment'; end if;
  if p_action = 'accept' and exists (select 1 from applications where student_id = app.student_id and status = 'accepted') then
    raise exception 'You have already accepted another offer. Decline it first.';
  end if;

  for t in select * from applications where id = app.id
       or (p_action = 'pay' and app.cao_group is not null and cao_group = app.cao_group and status = 'awaiting_payment' and student_id = app.student_id)
  loop
    update applications set status = next_status, updated_at = now(),
      paid_at = case when p_action = 'pay' then now() else paid_at end,
      payment_ref = case when p_action = 'pay' then trim(p_payment_ref) else payment_ref end
    where id = t.id;
    perform log_event(t.id, p_action, case when p_action = 'pay' then 'Paid · ' || trim(p_payment_ref) else p_note end);
  end loop;

  if p_action = 'accept' then
    for t in select * from applications where student_id = app.student_id and status = 'offer' and id <> app.id loop
      update applications set status = 'offer_declined', updated_at = now() where id = t.id;
      perform log_event(t.id, 'decline_offer', 'Declined automatically: accepted an offer from ' || (select short from institutions where id = app.institution_id) || '.');
    end loop;
  end if;
end $$;

-- Admissions actions: review, request_docs, offer, waitlist, decline.
create or replace function public.officer_action(p_app uuid, p_action text, p_note text default '', p_offer_choice text default null)
  returns void language plpgsql security definer set search_path = public as $$
declare app applications; allowed text[]; next_status text;
begin
  select * into app from applications where id = p_app for update;
  if app.id is null or not (is_admin() or (app.institution_id = my_institution() and app.status <> 'awaiting_payment')) then
    raise exception 'Application not found';
  end if;
  case p_action
    when 'review' then allowed := '{submitted,docs_requested}'; next_status := 'under_review';
    when 'request_docs' then allowed := '{submitted,under_review}'; next_status := 'docs_requested';
    when 'offer' then allowed := '{submitted,under_review,waitlisted}'; next_status := 'offer';
    when 'waitlist' then allowed := '{submitted,under_review}'; next_status := 'waitlisted';
    when 'decline' then allowed := '{submitted,under_review,waitlisted,docs_requested}'; next_status := 'declined';
    else raise exception 'Unknown action';
  end case;
  if not (app.status = any (allowed)) then raise exception 'That action is not available for this application'; end if;
  if p_action in ('request_docs', 'decline') and trim(coalesce(p_note, '')) = '' then raise exception 'Please add a note explaining this'; end if;
  if p_action = 'offer' and coalesce(p_offer_choice, app.choice1) not in (app.choice1, coalesce(app.choice2, app.choice1)) then
    raise exception 'The offer must be for one of the applicant''s choices';
  end if;
  update applications set status = next_status, updated_at = now(),
    offer_choice = case when p_action = 'offer' then coalesce(p_offer_choice, app.choice1) else offer_choice end,
    decision_note = case when p_action in ('offer', 'decline', 'waitlist') then coalesce(p_note, '') else decision_note end
  where id = app.id;
  perform log_event(app.id, p_action, p_note);
end $$;

-- Admin: make someone an admissions officer (with their institution), an admin, or a student.
create or replace function public.set_role(p_user uuid, p_role text, p_institution text default null)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can change roles'; end if;
  if p_role not in ('student', 'officer', 'admin') then raise exception 'Unknown role'; end if;
  if p_user = auth.uid() and p_role <> 'admin' then raise exception 'You can''t remove your own admin role'; end if;
  if p_role = 'officer' and not exists (select 1 from institutions where id = p_institution) then
    raise exception 'Choose the institution this officer works for';
  end if;
  update profiles set role = p_role, institution_id = case when p_role = 'officer' then p_institution end where id = p_user;
end $$;

-- Applications and their log change only through the functions above.
revoke insert, update, delete on public.applications, public.application_events from anon, authenticated;
revoke insert, update, delete on public.institutions, public.courses, public.settings from anon;
revoke all on public.profiles, public.documents from anon;

revoke all on function public.submit_applications(jsonb) from anon;
revoke all on function public.student_action(uuid, text, text, text) from anon;
revoke all on function public.officer_action(uuid, text, text, text) from anon;
revoke all on function public.set_role(uuid, text, text) from anon;
