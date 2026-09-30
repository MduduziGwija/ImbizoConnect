-- © 2026 Mduduzi Gwija. All rights reserved. Proprietary: see LICENSE.
-- For databases created before institution-specific programmes. Run once in the SQL Editor,
-- then run supabase/schema.sql again (it adds the programmes table and its rows).
-- Applications that used the old generic course ids are removed, because they cannot be
-- matched to a real programme at their institution.
delete from public.applications where choice1 not like '%-%';
alter table public.applications drop constraint if exists applications_choice1_fkey;
alter table public.applications drop constraint if exists applications_choice2_fkey;
alter table public.applications drop constraint if exists applications_offer_choice_fkey;
drop table if exists public.courses;
