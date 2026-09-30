-- © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE.
-- Checks schema.sql's permissions and workflow as different users. Run with tests/db/run.sh.
\set ON_ERROR_STOP on

-- Helpers: act as a user, and expect an error.
create function test_login(p uuid) returns void language sql as
$$ select set_config('request.jwt.claim.sub', p::text, false) $$;
create function expect_error(p_sql text, p_like text) returns void language plpgsql as $$
begin
  execute p_sql;
  raise exception 'Expected an error like "%" from: %', p_like, p_sql;
exception when others then
  if sqlerrm like 'Expected an error%' then raise; end if;
  if sqlerrm not ilike '%' || p_like || '%' then raise exception 'Wrong error for %: % (wanted %)', p_sql, sqlerrm, p_like; end if;
end $$;
create function expect(p_ok boolean, p_what text) returns void language plpgsql as $$
begin if not coalesce(p_ok, false) then raise exception 'FAILED: %', p_what; end if; end $$;
grant execute on function test_login(uuid), expect_error(text, text), expect(boolean, text) to authenticated;

-- Accounts: the first becomes admin, the rest students.
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'admin@example.org', '{"full_name":"Lwazi Ndlovu"}'),
  ('00000000-0000-0000-0000-000000000001', 'thandiwe@example.org', '{"full_name":"Thandiwe Mokoena"}'),
  ('00000000-0000-0000-0000-000000000002', 'sipho@example.org', '{"full_name":"Sipho Dlamini"}'),
  ('00000000-0000-0000-0000-0000000000b1', 'naledi@example.org', '{"full_name":"Naledi Khumalo"}'),
  ('00000000-0000-0000-0000-0000000000b2', 'priya@example.org', '{"full_name":"Priya Naidoo"}');
select expect((select role from profiles where email = 'admin@example.org') = 'admin', 'first account is admin');
select expect((select role from profiles where email = 'sipho@example.org') = 'student', 'later accounts are students');
select expect((select surname from profiles where email = 'thandiwe@example.org') = 'Mokoena', 'surname from sign-up name');

set role authenticated;
-- Admin appoints officers.
select test_login('00000000-0000-0000-0000-00000000000a');
select set_role('00000000-0000-0000-0000-0000000000b1', 'officer', 'wits');
select set_role('00000000-0000-0000-0000-0000000000b2', 'officer', 'ukzn');
select expect_error($$ select set_role('00000000-0000-0000-0000-00000000000a', 'student') $$, 'own admin role');
select expect_error($$ select set_role('00000000-0000-0000-0000-000000000002', 'officer', 'nowhere') $$, 'institution');

-- A student cannot promote themselves or store an invalid ID number.
select test_login('00000000-0000-0000-0000-000000000001');
select expect_error($$ update profiles set role = 'admin' where id = auth.uid() $$, 'Only an admin');
select expect_error($$ update profiles set id_number = '0803150142081' where id = auth.uid() $$, 'not valid');
select expect_error($$ select submit_applications('[{"institution_id":"wits","choice1":"wits-bcom-acc"}]') $$, 'personal and school details');

-- Complete the profile, confirm marks and upload the two required documents.
update profiles set first_names = 'Thandiwe', surname = 'Mokoena', id_number = '0803150142088', phone = '0725550142',
  province = 'Gauteng', address = '12 Vilakazi St', school = 'Morris Isaacson', guardian_name = 'Palesa Mokoena'
  where id = auth.uid();
select expect((select full_name from profiles where id = auth.uid()) = 'Thandiwe Mokoena', 'full name kept in sync');
select expect_error($$ select submit_applications('[{"institution_id":"wits","choice1":"wits-bcom-acc"}]') $$, 'Confirm your marks');
update profiles set marks = '[{"s":"Mathematics","m":65}]', marks_confirmed_at = now() where id = auth.uid();
select expect_error($$ select submit_applications('[{"institution_id":"wits","choice1":"wits-bcom-acc"}]') $$, 'Upload your ID');
insert into documents (owner_id, kind, name, path) values
  (auth.uid(), 'id', 'id.pdf', auth.uid() || '/id-id.pdf'), (auth.uid(), 'gr11', 'gr11.pdf', auth.uid() || '/gr11-gr11.pdf');
select expect_error($$ insert into documents (owner_id, kind, name, path) values ('00000000-0000-0000-0000-000000000002', 'photo', 'x', '00000000-0000-0000-0000-000000000002/x') $$, 'row-level security');

-- A programme from another institution is refused.
select expect_error($$ select submit_applications('[{"institution_id":"uj","choice1":"wits-bcom-acc"}]') $$, 'does not offer');

-- Closing dates are enforced; the demo copy switches this off.
update settings set enforce_dates = true;
select expect_error($$ select submit_applications('[{"institution_id":"up","choice1":"up-bcom-acc"}]') $$, 'closed');
select expect_error($$ select submit_applications('[{"institution_id":"mut","choice1":"wits-llb"}]') $$, 'does not offer');
reset role;
update settings set enforce_dates = false;
set role authenticated;

-- Apply to Wits, UJ (free) and two CAO institutions in one go.
select count(*) from submit_applications('[
  {"institution_id":"wits","choice1":"wits-bcom-acc","choice2":"wits-bcom"},
  {"institution_id":"uj","choice1":"uj-bacc-ca"},
  {"institution_id":"ukzn","choice1":"ukzn-bcom-acc","choice2":"ukzn-bcom-is"},
  {"institution_id":"dut","choice1":"dut-dip-ict-bus"}]');
select expect((select count(*) from applications where student_id = auth.uid()) = 4, 'four applications created');
select expect((select sum(fee) from applications where student_id = auth.uid() and institution_id in ('ukzn','dut')) = 250, 'CAO fee charged once');
select expect((select status from applications where institution_id = 'uj' and student_id = auth.uid()) = 'submitted', 'free application goes straight in');
select expect((select status from applications where institution_id = 'wits' and student_id = auth.uid()) = 'awaiting_payment', 'paid application waits for payment');
select expect((select count(distinct ref) from applications) = 4, 'unique references');
select expect_error($$ select submit_applications('[{"institution_id":"wits","choice1":"wits-bsc-cs"}]') $$, 'already applied');
select expect_error($$ select submit_applications('[{"institution_id":"mut","choice1":"mut-dip-ict","choice2":"mut-dip-acc"},{"institution_id":"unizulu","choice1":"unizulu-bsc-cs","choice2":"unizulu-bcom-acc"}]') $$, 'CAO allows');

-- Unpaid applications are hidden from the institution.
select test_login('00000000-0000-0000-0000-0000000000b1');
select expect((select count(*) from applications) = 0, 'officer cannot see unpaid applications');
select expect((select count(*) from profiles where email = 'thandiwe@example.org') = 0, 'officer cannot see non-applicants');

-- Paying one CAO application pays the whole CAO group.
select test_login('00000000-0000-0000-0000-000000000001');
select expect_error($$ select student_action((select id from applications where institution_id = 'wits'), 'pay') $$, 'payment reference');
select student_action((select id from applications where institution_id = 'wits'), 'pay', '', 'PF-83412');
select student_action((select id from applications where institution_id = 'dut'), 'pay', '', 'CAO-448812');
select expect((select count(*) from applications where cao_group is not null and status = 'submitted') = 2, 'CAO group paid together');

-- A later CAO choice shares the paid CAO fee.
select count(*) from submit_applications('[{"institution_id":"unizulu","choice1":"unizulu-llb"}]');
select expect((select fee = 0 and status = 'submitted' and payment_ref = 'CAO-448812' from applications where institution_id = 'unizulu'), 'later CAO choice is already paid');

-- Wits officer: sees only Wits, can read the applicant and their documents, and moves the application on.
select test_login('00000000-0000-0000-0000-0000000000b1');
select expect((select count(*) from applications) = 1 and (select institution_id from applications) = 'wits', 'officer sees own institution only');
select expect((select count(*) from profiles where email = 'thandiwe@example.org') = 1, 'officer sees the applicant');
select expect((select count(*) from documents) = 2, 'officer sees the applicant''s documents');
select expect_error($$ select officer_action((select id from applications where institution_id = 'uj'), 'review') $$, 'not found');
select expect_error($$ select officer_action((select id from applications), 'accept') $$, 'Unknown action');
select expect_error($$ select officer_action((select id from applications), 'decline') $$, 'note');
select officer_action((select id from applications), 'review');
select officer_action((select id from applications), 'offer', 'Welcome to Wits', 'wits-bcom');
select expect((select offer_choice from applications) = 'wits-bcom', 'offer for the second choice');
select expect_error($$ select officer_action((select id from applications), 'offer', '', 'wits-bsc-cs') $$, 'not available');
select expect_error($$ update applications set status = 'accepted' $$, 'permission denied');

-- The UKZN officer cannot see Wits applications, but does see the paid CAO application.
select test_login('00000000-0000-0000-0000-0000000000b2');
select expect((select count(*) from applications) = 1 and (select institution_id from applications) = 'ukzn', 'UKZN officer scope');

-- Student accepts Wits; any other offer is declined automatically.
select test_login('00000000-0000-0000-0000-0000000000b2');
select officer_action((select id from applications), 'offer', 'Welcome to UKZN');
select test_login('00000000-0000-0000-0000-000000000001');
select student_action((select id from applications where institution_id = 'wits'), 'accept');
select expect((select status from applications where institution_id = 'ukzn') = 'offer_declined', 'other offers declined automatically');
select expect_error($$ select student_action((select id from applications where institution_id = 'uj'), 'accept') $$, 'not available');
select student_action((select id from applications where institution_id = 'uj'), 'withdraw');
select expect((select count(*) from application_events e join applications a on a.id = e.application_id where a.institution_id = 'wits') = 5, 'event log kept');

-- Another student sees nothing of Thandiwe's.
select test_login('00000000-0000-0000-0000-000000000002');
select expect((select count(*) from applications) = 0, 'students see only their own applications');
select expect((select count(*) from profiles) = 1, 'students see only their own profile');
select expect((select count(*) from documents) = 0, 'students see only their own documents');
select expect_error($$ select student_action((select id from applications limit 1), 'withdraw') $$, 'not found');

-- Storage: files live under the owner's folder.
select test_login('00000000-0000-0000-0000-000000000001');
insert into storage.objects (bucket_id, name) values ('documents', '00000000-0000-0000-0000-000000000001/id-id.pdf');
select expect_error($$ insert into storage.objects (bucket_id, name) values ('documents', '00000000-0000-0000-0000-000000000002/x.pdf') $$, 'row-level security');
select test_login('00000000-0000-0000-0000-0000000000b1');
select expect((select count(*) from storage.objects) = 1, 'officer can open the applicant''s file');
select test_login('00000000-0000-0000-0000-000000000002');
select expect((select count(*) from storage.objects) = 0, 'other students cannot open it');

reset role;
select 'All database checks passed' as result;
