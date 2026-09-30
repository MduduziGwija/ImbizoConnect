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
-- Databases created before institution-specific programmes: see supabase/updates/001-programmes.sql.
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

-- Each institution's own undergraduate programmes (see assets/js/programmes.js).
create table if not exists public.programmes (
  id text primary key,                  -- e.g. 'wits-bcom-acc'
  institution_id text not null references public.institutions,
  field text not null,
  name text not null,
  qual text not null default 'degree' check (qual in ('degree', 'diploma', 'hc'))
);
insert into public.programmes (id, institution_id, field, name, qual) values
  ('up-bcom-acc', 'up', 'commerce', 'BCom in Accounting Sciences', 'degree'),
  ('up-bcom-invest', 'up', 'commerce', 'BCom (Investment Management)', 'degree'),
  ('up-bcom-fms', 'up', 'commerce', 'BCom (Financial Management Sciences)', 'degree'),
  ('up-bcom-econ', 'up', 'commerce', 'BCom (Economics)', 'degree'),
  ('up-bcom-ecmx', 'up', 'commerce', 'BCom (Econometrics)', 'degree'),
  ('up-bcom-stats', 'up', 'commerce', 'BCom (Statistics and Data Science)', 'degree'),
  ('up-bcom-is', 'up', 'ict', 'BCom (Information Systems)', 'degree'),
  ('up-bcom-bm', 'up', 'commerce', 'BCom (Business Management)', 'degree'),
  ('up-bcom-hrm', 'up', 'commerce', 'BCom (Human Resource Management)', 'degree'),
  ('up-bcom-mkt', 'up', 'commerce', 'BCom (Marketing Management)', 'degree'),
  ('up-bcom-scm', 'up', 'commerce', 'BCom (Supply Chain Management)', 'degree'),
  ('up-bcom-agri', 'up', 'commerce', 'BCom (Agribusiness Management)', 'degree'),
  ('up-bcom', 'up', 'commerce', 'Bachelor of Commerce', 'degree'),
  ('up-badmin', 'up', 'humanities', 'BAdmin (Public Administration and International Relations)', 'degree'),
  ('up-llb', 'up', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('up-ba-law', 'up', 'law', 'BA (Law)', 'degree'),
  ('up-bcom-law', 'up', 'law', 'BCom (Law)', 'degree'),
  ('up-beng-civil', 'up', 'engineering', 'BEng (Civil Engineering)', 'degree'),
  ('up-beng-elec', 'up', 'engineering', 'BEng (Electrical Engineering)', 'degree'),
  ('up-beng-electronic', 'up', 'engineering', 'BEng (Electronic Engineering)', 'degree'),
  ('up-beng-comp', 'up', 'engineering', 'BEng (Computer Engineering)', 'degree'),
  ('up-beng-mech', 'up', 'engineering', 'BEng (Mechanical Engineering)', 'degree'),
  ('up-beng-chem', 'up', 'engineering', 'BEng (Chemical Engineering)', 'degree'),
  ('up-beng-ind', 'up', 'engineering', 'BEng (Industrial Engineering)', 'degree'),
  ('up-beng-met', 'up', 'engineering', 'BEng (Metallurgical Engineering)', 'degree'),
  ('up-beng-mining', 'up', 'engineering', 'BEng (Mining Engineering)', 'degree'),
  ('up-bsc-arch', 'up', 'engineering', 'BSc (Architecture)', 'degree'),
  ('up-bsc-qs', 'up', 'engineering', 'BSc (Quantity Surveying)', 'degree'),
  ('up-bsc-cm', 'up', 'engineering', 'BSc (Construction Management)', 'degree'),
  ('up-bsc-re', 'up', 'engineering', 'BSc (Real Estate)', 'degree'),
  ('up-btrp', 'up', 'engineering', 'Bachelor of Town and Regional Planning', 'degree'),
  ('up-bsc-cs', 'up', 'ict', 'BSc (Computer Science)', 'degree'),
  ('up-bit-is', 'up', 'ict', 'BIT (Information Systems)', 'degree'),
  ('up-bsc-it', 'up', 'ict', 'BSc (Information Technology) Information and Knowledge Systems', 'degree'),
  ('up-bis-multimedia', 'up', 'ict', 'BIS (Multimedia)', 'degree'),
  ('up-mbchb', 'up', 'health', 'MBChB', 'degree'),
  ('up-bds', 'up', 'health', 'Bachelor of Dental Surgery (BChD)', 'degree'),
  ('up-boh', 'up', 'health', 'Bachelor of Oral Hygiene', 'degree'),
  ('up-bdiet', 'up', 'health', 'Bachelor of Dietetics', 'degree'),
  ('up-bnurs', 'up', 'health', 'Bachelor of Nursing Science', 'degree'),
  ('up-bot', 'up', 'health', 'Bachelor of Occupational Therapy', 'degree'),
  ('up-bphysio', 'up', 'health', 'Bachelor of Physiotherapy', 'degree'),
  ('up-brad', 'up', 'health', 'Bachelor of Radiography in Diagnostics', 'degree'),
  ('up-bvsc', 'up', 'health', 'Bachelor of Veterinary Science', 'degree'),
  ('up-bvetnurs', 'up', 'health', 'Bachelor of Veterinary Nursing', 'degree'),
  ('up-bsc-actuarial', 'up', 'science', 'BSc (Actuarial and Financial Mathematics)', 'degree'),
  ('up-bsc-mathstats', 'up', 'science', 'BSc (Mathematical Statistics)', 'degree'),
  ('up-bsc-applmath', 'up', 'science', 'BSc (Applied Mathematics)', 'degree'),
  ('up-bsc-chem', 'up', 'science', 'BSc (Chemistry)', 'degree'),
  ('up-bsc-physics', 'up', 'science', 'BSc (Physics)', 'degree'),
  ('up-bsc-geology', 'up', 'science', 'BSc (Geology)', 'degree'),
  ('up-bsc-meteo', 'up', 'science', 'BSc (Meteorology)', 'degree'),
  ('up-bsc-geoinf', 'up', 'science', 'BSc (Geoinformatics)', 'degree'),
  ('up-bsc-biochem', 'up', 'science', 'BSc (Biochemistry)', 'degree'),
  ('up-bsc-genetics', 'up', 'science', 'BSc (Genetics)', 'degree'),
  ('up-bsc-microbio', 'up', 'science', 'BSc (Microbiology)', 'degree'),
  ('up-bsc-biotech', 'up', 'science', 'BSc (Biotechnology)', 'degree'),
  ('up-bsc-medsci', 'up', 'science', 'BSc (Medical Sciences)', 'degree'),
  ('up-bsc-zoology', 'up', 'science', 'BSc (Zoology)', 'degree'),
  ('up-bsc-ecology', 'up', 'science', 'BSc (Ecology)', 'degree'),
  ('up-bsc-food', 'up', 'science', 'BSc (Food Science)', 'degree'),
  ('up-bsc-agric-animal', 'up', 'science', 'BSc (Agriculture) Animal Science', 'degree'),
  ('up-bsc-agric-plant', 'up', 'science', 'BSc (Agriculture) Applied Plant and Soil Sciences', 'degree'),
  ('up-bsc-agric-econ', 'up', 'science', 'BSc (Agriculture) Agricultural Economics and Agribusiness Management', 'degree'),
  ('up-bconsci-food', 'up', 'science', 'Bachelor of Consumer Science (Food Management)', 'degree'),
  ('up-bed-ece', 'up', 'education', 'BEd (Early Childhood Care and Education)', 'degree'),
  ('up-bed-fp', 'up', 'education', 'BEd (Foundation Phase Teaching)', 'degree'),
  ('up-bed-ip', 'up', 'education', 'BEd (Intermediate Phase Teaching)', 'degree'),
  ('up-bed-sp', 'up', 'education', 'BEd (Senior Phase and FET Teaching)', 'degree'),
  ('up-ba', 'up', 'humanities', 'Bachelor of Arts', 'degree'),
  ('up-bsw', 'up', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('up-ba-slp', 'up', 'health', 'BA (Speech-Language Pathology)', 'degree'),
  ('up-ba-audio', 'up', 'health', 'BA (Audiology)', 'degree'),
  ('up-ba-ppe', 'up', 'humanities', 'BA (Philosophy, Politics and Economics)', 'degree'),
  ('up-bpolsci-is', 'up', 'humanities', 'BPolSci (International Studies)', 'degree'),
  ('up-ba-infodesign', 'up', 'humanities', 'BA (Information Design)', 'degree'),
  ('up-bdrama', 'up', 'humanities', 'Bachelor of Drama', 'degree'),
  ('up-bmus', 'up', 'humanities', 'Bachelor of Music', 'degree'),
  ('up-btheology', 'up', 'humanities', 'Bachelor of Theology', 'degree'),
  ('up-hc-sport', 'up', 'health', 'Higher Certificate in Sports Sciences', 'hc'),
  ('su-bacc', 'su', 'commerce', 'BAcc', 'degree'),
  ('su-bcom-mgt-acc', 'su', 'commerce', 'BCom (Management Accounting)', 'degree'),
  ('su-bcom-fin-acc', 'su', 'commerce', 'BCom (Financial Accounting)', 'degree'),
  ('su-bcom-econ', 'su', 'commerce', 'BCom (Economic Sciences)', 'degree'),
  ('su-bcom-mgt', 'su', 'commerce', 'BCom (Management Sciences)', 'degree'),
  ('su-bcom-math', 'su', 'commerce', 'BCom (Mathematical Sciences)', 'degree'),
  ('su-bcom-actuarial', 'su', 'commerce', 'BCom (Actuarial Science)', 'degree'),
  ('su-bcom-ib', 'su', 'commerce', 'BCom (International Business)', 'degree'),
  ('su-bcom-indpsych', 'su', 'commerce', 'BCom (Industrial Psychology)', 'degree'),
  ('su-bdatsci', 'su', 'ict', 'Bachelor of Data Science', 'degree'),
  ('su-bsc-cs', 'su', 'ict', 'BSc Computer Science', 'degree'),
  ('su-bsc-geoinf', 'su', 'science', 'BSc GeoInformatics', 'degree'),
  ('su-bsc-molbio', 'su', 'science', 'BSc Molecular Biology and Biotechnology', 'degree'),
  ('su-bsc-bio', 'su', 'science', 'BSc Biodiversity and Ecology', 'degree'),
  ('su-bsc-chem', 'su', 'science', 'BSc Chemistry', 'degree'),
  ('su-bsc-hls', 'su', 'science', 'BSc Human Life Sciences', 'degree'),
  ('su-bsc-earth', 'su', 'science', 'BSc Earth Science', 'degree'),
  ('su-bsc-math', 'su', 'science', 'BSc Mathematical Sciences', 'degree'),
  ('su-bsc-sport', 'su', 'health', 'BSc Sport Science', 'degree'),
  ('su-bsc-food', 'su', 'science', 'BSc in Food Science', 'degree'),
  ('su-bsc-cons', 'su', 'science', 'BSc in Conservation Ecology', 'degree'),
  ('su-bsc-forestry', 'su', 'science', 'BSc in Forestry', 'degree'),
  ('su-bscagric-animal', 'su', 'science', 'BScAgric in Animal Production Systems', 'degree'),
  ('su-bscagric-plant', 'su', 'science', 'BScAgric in Plant and Soil Science', 'degree'),
  ('su-bagric-agribus', 'su', 'science', 'BAgric in Agribusiness Management', 'degree'),
  ('su-beng-civil', 'su', 'engineering', 'BEng (Civil)', 'degree'),
  ('su-beng-elec', 'su', 'engineering', 'BEng (Electrical and Electronic)', 'degree'),
  ('su-beng-mech', 'su', 'engineering', 'BEng (Mechanical)', 'degree'),
  ('su-beng-mechatronic', 'su', 'engineering', 'BEng (Mechatronic)', 'degree'),
  ('su-beng-chem', 'su', 'engineering', 'BEng (Chemical)', 'degree'),
  ('su-beng-ind', 'su', 'engineering', 'BEng (Industrial)', 'degree'),
  ('su-mbchb', 'su', 'health', 'MBChB', 'degree'),
  ('su-bnurs', 'su', 'health', 'Bachelor of Nursing', 'degree'),
  ('su-bphysio', 'su', 'health', 'BSc in Physiotherapy', 'degree'),
  ('su-bot', 'su', 'health', 'Bachelor of Occupational Therapy', 'degree'),
  ('su-bsc-diet', 'su', 'health', 'BSc in Dietetics', 'degree'),
  ('su-bslht', 'su', 'health', 'Bachelor of Speech-Language and Hearing Therapy', 'degree'),
  ('su-llb', 'su', 'law', 'LLB (four-year)', 'degree'),
  ('su-ba-law', 'su', 'law', 'BA (Law)', 'degree'),
  ('su-bcom-law', 'su', 'law', 'BCom (Law)', 'degree'),
  ('su-ba-hum', 'su', 'humanities', 'BA in Humanities', 'degree'),
  ('su-ba-lang', 'su', 'humanities', 'BA in Language and Culture', 'degree'),
  ('su-ba-dev', 'su', 'humanities', 'BA in Development and the Environment', 'degree'),
  ('su-ba-ppe', 'su', 'humanities', 'BA in Political, Philosophical and Economic Studies', 'degree'),
  ('su-ba-hrm', 'su', 'humanities', 'BA in Human Resource Management', 'degree'),
  ('su-ba-visual', 'su', 'humanities', 'BA in Visual Arts', 'degree'),
  ('su-ba-drama', 'su', 'humanities', 'BA in Drama and Theatre Studies', 'degree'),
  ('su-bmus', 'su', 'humanities', 'Bachelor of Music (BMus)', 'degree'),
  ('su-bsw', 'su', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('su-bed-fp', 'su', 'education', 'BEd (Foundation Phase Education)', 'degree'),
  ('su-bed-ip', 'su', 'education', 'BEd (Intermediate Phase Education)', 'degree'),
  ('su-dip-sustain', 'su', 'humanities', 'Diploma in Sustainable Development', 'diploma'),
  ('ru-bbussci', 'ru', 'commerce', 'Bachelor of Business Science', 'degree'),
  ('ru-bcom', 'ru', 'commerce', 'Bachelor of Commerce (BCom)', 'degree'),
  ('ru-beco', 'ru', 'commerce', 'Bachelor of Economics (BEco)', 'degree'),
  ('ru-ba', 'ru', 'humanities', 'Bachelor of Arts (BA)', 'degree'),
  ('ru-bss', 'ru', 'humanities', 'Bachelor of Social Science (BSS)', 'degree'),
  ('ru-bjourn', 'ru', 'humanities', 'Bachelor of Journalism (BJourn)', 'degree'),
  ('ru-bfa', 'ru', 'humanities', 'Bachelor of Fine Arts (BFA)', 'degree'),
  ('ru-bmus', 'ru', 'humanities', 'Bachelor of Music (BMus)', 'degree'),
  ('ru-bedfp', 'ru', 'education', 'Bachelor of Education (Foundation Phase)', 'degree'),
  ('ru-llb', 'ru', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('ru-bpharm', 'ru', 'health', 'Bachelor of Pharmacy (BPharm)', 'degree'),
  ('ru-bsc', 'ru', 'science', 'Bachelor of Science (BSc)', 'degree'),
  ('ru-bscinfosys', 'ru', 'ict', 'Bachelor of Information Systems (BScInfoSys)', 'degree'),
  ('ru-bsc-cs', 'ru', 'ict', 'BSc (Computer Science)', 'degree'),
  ('ul-mbchb', 'ul', 'health', 'MBChB', 'degree'),
  ('ul-bpharm', 'ul', 'health', 'Bachelor of Pharmacy', 'degree'),
  ('ul-boptom', 'ul', 'health', 'Bachelor of Optometry', 'degree'),
  ('ul-bnurs', 'ul', 'health', 'Bachelor of Nursing', 'degree'),
  ('ul-bsc-diet', 'ul', 'health', 'BSc (Dietetics)', 'degree'),
  ('ul-bsc-medsci', 'ul', 'science', 'BSc (Medical Sciences)', 'degree'),
  ('ul-bsc-phys', 'ul', 'science', 'BSc (Physical Sciences stream)', 'degree'),
  ('ul-bsc-math', 'ul', 'science', 'BSc (Mathematical Sciences stream)', 'degree'),
  ('ul-bsc-life', 'ul', 'science', 'BSc (Life Sciences stream)', 'degree'),
  ('ul-bsc-geology', 'ul', 'science', 'BSc (Geology)', 'degree'),
  ('ul-bsc-env', 'ul', 'science', 'BSc (Environmental & Resource Studies)', 'degree'),
  ('ul-bsc-water', 'ul', 'science', 'BSc (Water & Sanitation Sciences)', 'degree'),
  ('ul-bsc-agric-econ', 'ul', 'science', 'BSc (Agriculture) (Agricultural Economics)', 'degree'),
  ('ul-bsc-agric-plant', 'ul', 'science', 'BSc (Agriculture) (Plant Production)', 'degree'),
  ('ul-bsc-agric-animal', 'ul', 'science', 'BSc (Agriculture) (Animal Production)', 'degree'),
  ('ul-bagricman', 'ul', 'science', 'Bachelor of Agricultural Management', 'degree'),
  ('ul-bacc', 'ul', 'commerce', 'Bachelor of Accountancy', 'degree'),
  ('ul-bcom-acc', 'ul', 'commerce', 'BCom (Accountancy)', 'degree'),
  ('ul-bcom-hrm', 'ul', 'commerce', 'BCom (Human Resource Management)', 'degree'),
  ('ul-bcom-bm', 'ul', 'commerce', 'BCom (Business Management)', 'degree'),
  ('ul-bcom-econ', 'ul', 'commerce', 'BCom (Economics)', 'degree'),
  ('ul-badmin', 'ul', 'humanities', 'Bachelor of Administration', 'degree'),
  ('ul-badmin-lg', 'ul', 'humanities', 'BAdmin (Local Government)', 'degree'),
  ('ul-bdev', 'ul', 'humanities', 'BDev (Planning and Management)', 'degree'),
  ('ul-llb', 'ul', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('ul-bpsych', 'ul', 'humanities', 'Bachelor of Psychology', 'degree'),
  ('ul-bsw', 'ul', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('ul-ba-crim', 'ul', 'humanities', 'BA (Criminology and Psychology stream)', 'degree'),
  ('ul-ba-media', 'ul', 'humanities', 'BA (Media Studies)', 'degree'),
  ('ul-ba-comm', 'ul', 'humanities', 'BA (Communication Studies)', 'degree'),
  ('ul-ba-pol', 'ul', 'humanities', 'BA (Political Studies stream)', 'degree'),
  ('ul-ba-lang', 'ul', 'humanities', 'BA (Languages stream)', 'degree'),
  ('ul-ba-perform', 'ul', 'humanities', 'BA (Performing Arts stream)', 'degree'),
  ('ul-binfst', 'ul', 'ict', 'Bachelor of Information Studies', 'degree'),
  ('ul-bed-fp', 'ul', 'education', 'BEd (Foundation Phase Teaching)', 'degree'),
  ('ul-bed-sp-lang', 'ul', 'education', 'BEd (Senior Phase & FET Teaching): Languages and Life Orientation', 'degree'),
  ('ul-bed-sp-ems', 'ul', 'education', 'BEd (Senior Phase & FET Teaching): Economics and Management Studies', 'degree'),
  ('ul-bed-sp-mst', 'ul', 'education', 'BEd (Senior Phase & FET Teaching): Mathematics, Science & Technology', 'degree'),
  ('wsu-mbchb', 'wsu', 'health', 'Bachelor of Medicine and Bachelor of Surgery', 'degree'),
  ('wsu-bmedsci', 'wsu', 'health', 'Bachelor of Medical Sciences', 'degree'),
  ('wsu-bcmp', 'wsu', 'health', 'Bachelor of Medicine in Clinical Practice', 'degree'),
  ('wsu-bnurs', 'wsu', 'health', 'Bachelor of Nursing', 'degree'),
  ('wsu-bhs-mop', 'wsu', 'health', 'Bachelor of Health Sciences in Medical Orthotics and Prosthetics', 'degree'),
  ('wsu-bacc', 'wsu', 'commerce', 'Bachelor of Accounting', 'degree'),
  ('wsu-baccsci', 'wsu', 'commerce', 'Bachelor of Accounting Sciences', 'degree'),
  ('wsu-bcom', 'wsu', 'commerce', 'Bachelor of Commerce', 'degree'),
  ('wsu-bcom-bm', 'wsu', 'commerce', 'Bachelor of Commerce in Business Management', 'degree'),
  ('wsu-bcom-econ', 'wsu', 'commerce', 'Bachelor of Commerce in Economics', 'degree'),
  ('wsu-badmin', 'wsu', 'humanities', 'Bachelor of Administration', 'degree'),
  ('wsu-llb', 'wsu', 'law', 'Bachelor of Laws', 'degree'),
  ('wsu-bpsych', 'wsu', 'humanities', 'Bachelor of Psychology', 'degree'),
  ('wsu-bsw', 'wsu', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('wsu-bsocsci', 'wsu', 'humanities', 'Bachelor of Social Science', 'degree'),
  ('wsu-ba', 'wsu', 'humanities', 'Bachelor of Arts', 'degree'),
  ('wsu-bsc-cs', 'wsu', 'ict', 'Bachelor of Science in Computer Science', 'degree'),
  ('wsu-bsc-bio', 'wsu', 'science', 'Bachelor of Science in Biological Sciences', 'degree'),
  ('wsu-bsc-math', 'wsu', 'science', 'Bachelor of Science in Mathematics', 'degree'),
  ('wsu-bsc-physics', 'wsu', 'science', 'Bachelor of Science in Physics', 'degree'),
  ('wsu-bsc-env', 'wsu', 'science', 'Bachelor of Science in Environmental Studies', 'degree'),
  ('wsu-bed-fp', 'wsu', 'education', 'Bachelor of Education in Foundation Phase Teaching', 'degree'),
  ('wsu-bed-mst', 'wsu', 'education', 'BEd in Senior Phase & FET Teaching (Maths, Science & Technology)', 'degree'),
  ('wsu-bed-ems', 'wsu', 'education', 'BEd in Senior Phase & FET Teaching (Economic & Management Sciences)', 'degree'),
  ('wsu-dip-civil', 'wsu', 'engineering', 'Diploma in Civil Engineering', 'diploma'),
  ('wsu-dip-elec', 'wsu', 'engineering', 'Diploma in Electrical Engineering', 'diploma'),
  ('wsu-dip-mech', 'wsu', 'engineering', 'Diploma in Mechanical Engineering', 'diploma'),
  ('wsu-dip-building', 'wsu', 'engineering', 'Diploma in Building Technology', 'diploma'),
  ('wsu-dip-ict-app', 'wsu', 'ict', 'Diploma in ICT in Applications Development', 'diploma'),
  ('wsu-dip-ict-net', 'wsu', 'ict', 'Diploma in ICT in Communication Networks', 'diploma'),
  ('wsu-dip-acc', 'wsu', 'commerce', 'Diploma in Accountancy', 'diploma'),
  ('wsu-dip-hrm', 'wsu', 'commerce', 'Diploma in Human Resources Management', 'diploma'),
  ('wsu-dip-mgmt', 'wsu', 'commerce', 'Diploma in Management', 'diploma'),
  ('wsu-dip-mkt', 'wsu', 'commerce', 'Diploma in Marketing', 'diploma'),
  ('wsu-dip-tourism', 'wsu', 'commerce', 'Diploma in Tourism Management', 'diploma'),
  ('wsu-dip-journ', 'wsu', 'humanities', 'Diploma in Journalism', 'diploma'),
  ('wsu-dip-policing', 'wsu', 'humanities', 'Diploma in Policing', 'diploma'),
  ('wsu-dip-fineart', 'wsu', 'humanities', 'Diploma in Fine Art', 'diploma'),
  ('wits-bacc-sci', 'wits', 'commerce', 'Bachelor of Accounting Science', 'degree'),
  ('wits-bcom-acc', 'wits', 'commerce', 'BCom (Accounting)', 'degree'),
  ('wits-bcom', 'wits', 'commerce', 'BCom (General)', 'degree'),
  ('wits-bcom-is', 'wits', 'ict', 'BCom (Information Systems)', 'degree'),
  ('wits-bcom-ppe', 'wits', 'commerce', 'BCom (Politics, Philosophy and Economics)', 'degree'),
  ('wits-beconsci', 'wits', 'commerce', 'Bachelor of Economic Science', 'degree'),
  ('wits-bcom-law', 'wits', 'law', 'BCom (Law)', 'degree'),
  ('wits-llb', 'wits', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('wits-bsc-eng-civil', 'wits', 'engineering', 'BSc (Engineering) in Civil Engineering', 'degree'),
  ('wits-bsc-eng-elec', 'wits', 'engineering', 'BSc (Engineering) in Electrical Engineering', 'degree'),
  ('wits-bsc-eng-mech', 'wits', 'engineering', 'BSc (Engineering) in Mechanical Engineering', 'degree'),
  ('wits-bsc-eng-aero', 'wits', 'engineering', 'BSc (Engineering) in Aeronautical Engineering', 'degree'),
  ('wits-bsc-eng-chem', 'wits', 'engineering', 'BSc (Engineering) in Chemical Engineering', 'degree'),
  ('wits-bsc-eng-ind', 'wits', 'engineering', 'BSc (Engineering) in Industrial Engineering', 'degree'),
  ('wits-bsc-eng-mining', 'wits', 'engineering', 'BSc (Engineering) in Mining Engineering', 'degree'),
  ('wits-bsc-eng-met', 'wits', 'engineering', 'BSc (Engineering) in Metallurgy and Materials Engineering', 'degree'),
  ('wits-bas', 'wits', 'engineering', 'Bachelor of Architectural Studies', 'degree'),
  ('wits-bsc-urp', 'wits', 'engineering', 'BSc (Urban and Regional Planning)', 'degree'),
  ('wits-bsc-construction', 'wits', 'engineering', 'BSc (Construction Studies)', 'degree'),
  ('wits-bsc-cs', 'wits', 'ict', 'BSc (Computer Science)', 'degree'),
  ('wits-bsc-actuarial', 'wits', 'science', 'BSc (Actuarial Science)', 'degree'),
  ('wits-bsc-bio', 'wits', 'science', 'BSc (Biological Sciences)', 'degree'),
  ('wits-bsc-physical', 'wits', 'science', 'BSc (Physical Sciences)', 'degree'),
  ('wits-bsc-earth', 'wits', 'science', 'BSc (Geography and Archaeological Sciences)', 'degree'),
  ('wits-mbbch', 'wits', 'health', 'Bachelor of Medicine and Surgery (MBBCh)', 'degree'),
  ('wits-bds', 'wits', 'health', 'Bachelor of Dental Science (BDS)', 'degree'),
  ('wits-bpharm', 'wits', 'health', 'Bachelor of Pharmacy (BPharm)', 'degree'),
  ('wits-bsc-physio', 'wits', 'health', 'BSc Physiotherapy', 'degree'),
  ('wits-bsc-ot', 'wits', 'health', 'BSc Occupational Therapy', 'degree'),
  ('wits-bnurs', 'wits', 'health', 'Bachelor of Nursing', 'degree'),
  ('wits-bcmp', 'wits', 'health', 'Bachelor of Clinical Medical Practice', 'degree'),
  ('wits-bohsc', 'wits', 'health', 'Bachelor of Oral Health Sciences', 'degree'),
  ('wits-bsc-biokinetics', 'wits', 'health', 'BSc Biokinetics', 'degree'),
  ('wits-ba-audio', 'wits', 'health', 'BA Audiology', 'degree'),
  ('wits-ba-slp', 'wits', 'health', 'BA Speech-Language Pathology', 'degree'),
  ('wits-ba', 'wits', 'humanities', 'Bachelor of Arts', 'degree'),
  ('wits-bsw', 'wits', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('wits-ba-film', 'wits', 'humanities', 'BA (Film and Television)', 'degree'),
  ('wits-bda', 'wits', 'humanities', 'Bachelor of Arts in Theatre and Performance', 'degree'),
  ('wits-ba-fa', 'wits', 'humanities', 'Bachelor of Arts in Fine Arts', 'degree'),
  ('wits-bmus', 'wits', 'humanities', 'Bachelor of Music', 'degree'),
  ('wits-bed-fp', 'wits', 'education', 'BEd (Foundation Phase Teaching)', 'degree'),
  ('wits-bed-ip', 'wits', 'education', 'BEd (Intermediate Phase Teaching)', 'degree'),
  ('wits-bed-sp', 'wits', 'education', 'BEd (Senior Phase and FET Teaching)', 'degree'),
  ('uct-bcom-acc', 'uct', 'commerce', 'BCom (Accounting) – CA route', 'degree'),
  ('uct-bbussci-actuarial', 'uct', 'commerce', 'BBusSc (Actuarial Science)', 'degree'),
  ('uct-bbussci-finance', 'uct', 'commerce', 'BBusSc (Finance)', 'degree'),
  ('uct-bbussci-marketing', 'uct', 'commerce', 'BBusSc (Marketing)', 'degree'),
  ('uct-bcom-econ', 'uct', 'commerce', 'BCom (Economics)', 'degree'),
  ('uct-bcom-is', 'uct', 'ict', 'BCom (Information Systems)', 'degree'),
  ('uct-bcom-ppe', 'uct', 'commerce', 'BCom (Philosophy, Politics and Economics)', 'degree'),
  ('uct-bsc-eng-chem', 'uct', 'engineering', 'BSc (Eng) Chemical Engineering', 'degree'),
  ('uct-bsc-eng-civil', 'uct', 'engineering', 'BSc (Eng) Civil Engineering', 'degree'),
  ('uct-bsc-eng-elec', 'uct', 'engineering', 'BSc (Eng) Electrical Engineering', 'degree'),
  ('uct-bsc-eng-ece', 'uct', 'engineering', 'BSc (Eng) Electrical and Computer Engineering', 'degree'),
  ('uct-bsc-eng-mech', 'uct', 'engineering', 'BSc (Eng) Mechanical Engineering', 'degree'),
  ('uct-bsc-eng-mechatronic', 'uct', 'engineering', 'BSc (Eng) Mechatronics', 'degree'),
  ('uct-bsc-eng-mining', 'uct', 'engineering', 'BSc (Eng) Mining Engineering', 'degree'),
  ('uct-bas', 'uct', 'engineering', 'Bachelor of Architectural Studies', 'degree'),
  ('uct-bsc-construction', 'uct', 'engineering', 'BSc (Construction Studies)', 'degree'),
  ('uct-bsc-geomatics', 'uct', 'engineering', 'BSc (Geomatics)', 'degree'),
  ('uct-bsc-cs', 'uct', 'ict', 'BSc (Computer Science)', 'degree'),
  ('uct-bsc-stats', 'uct', 'science', 'BSc (Statistics and Data Science)', 'degree'),
  ('uct-bsc-bio', 'uct', 'science', 'BSc (Biological Sciences)', 'degree'),
  ('uct-bsc-chem', 'uct', 'science', 'BSc (Chemistry)', 'degree'),
  ('uct-bsc-env', 'uct', 'science', 'BSc (Environmental and Geographical Science)', 'degree'),
  ('uct-bsc-ocean', 'uct', 'science', 'BSc (Ocean and Atmosphere Science)', 'degree'),
  ('uct-mbchb', 'uct', 'health', 'MBChB', 'degree'),
  ('uct-bsc-physio', 'uct', 'health', 'BSc Physiotherapy', 'degree'),
  ('uct-bsc-ot', 'uct', 'health', 'BSc Occupational Therapy', 'degree'),
  ('uct-bsc-audio', 'uct', 'health', 'BSc Audiology', 'degree'),
  ('uct-bsc-slp', 'uct', 'health', 'BSc Speech-Language Pathology', 'degree'),
  ('uct-bnurs', 'uct', 'health', 'Bachelor of Nursing and Midwifery', 'degree'),
  ('uct-llb', 'uct', 'law', 'LLB (four-year)', 'degree'),
  ('uct-ba', 'uct', 'humanities', 'Bachelor of Arts', 'degree'),
  ('uct-bsocsc', 'uct', 'humanities', 'Bachelor of Social Science', 'degree'),
  ('uct-bsw', 'uct', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('uct-ba-film', 'uct', 'humanities', 'BA (Film and Television Studies)', 'degree'),
  ('uct-bfa', 'uct', 'humanities', 'Bachelor of Fine Art', 'degree'),
  ('uct-bmus', 'uct', 'humanities', 'Bachelor of Music', 'degree'),
  ('uct-ba-theatre', 'uct', 'humanities', 'BA (Theatre and Performance)', 'degree'),
  ('uj-bacc-ca', 'uj', 'commerce', 'Bachelor of Accounting (CA stream)', 'degree'),
  ('uj-bcom-acc', 'uj', 'commerce', 'BCom in Accounting', 'degree'),
  ('uj-bcom-fin', 'uj', 'commerce', 'BCom in Finance', 'degree'),
  ('uj-bcom-econ', 'uj', 'commerce', 'BCom in Economics and Econometrics', 'degree'),
  ('uj-bcom-bm', 'uj', 'commerce', 'BCom in Business Management', 'degree'),
  ('uj-bcom-hrm', 'uj', 'commerce', 'BCom in Human Resource Management', 'degree'),
  ('uj-bcom-mkt', 'uj', 'commerce', 'BCom in Marketing Management', 'degree'),
  ('uj-bcom-is', 'uj', 'ict', 'BCom in Information Systems', 'degree'),
  ('uj-bcom-logistics', 'uj', 'commerce', 'BCom in Transport and Logistics Management', 'degree'),
  ('uj-beng-civil', 'uj', 'engineering', 'BEng in Civil Engineering', 'degree'),
  ('uj-beng-elec', 'uj', 'engineering', 'BEng in Electrical and Electronic Engineering', 'degree'),
  ('uj-beng-mech', 'uj', 'engineering', 'BEng in Mechanical Engineering', 'degree'),
  ('uj-bengtech-civil', 'uj', 'engineering', 'BEngTech in Civil Engineering', 'degree'),
  ('uj-bengtech-elec', 'uj', 'engineering', 'BEngTech in Electrical Engineering', 'degree'),
  ('uj-bengtech-mech', 'uj', 'engineering', 'BEngTech in Mechanical Engineering', 'degree'),
  ('uj-dip-mech', 'uj', 'engineering', 'Diploma in Mechanical Engineering (Extended)', 'diploma'),
  ('uj-barch', 'uj', 'engineering', 'Bachelor of Architecture', 'degree'),
  ('uj-bsc-cs', 'uj', 'ict', 'BSc in Computer Science and Informatics', 'degree'),
  ('uj-bsc-it', 'uj', 'ict', 'BSc in Information Technology', 'degree'),
  ('uj-bsc-life', 'uj', 'science', 'BSc in Life and Environmental Sciences', 'degree'),
  ('uj-bsc-chem', 'uj', 'science', 'BSc in Physical Sciences (Chemistry and Physics)', 'degree'),
  ('uj-bsc-math', 'uj', 'science', 'BSc in Mathematical Statistics', 'degree'),
  ('uj-bnurs', 'uj', 'health', 'Bachelor of Nursing', 'degree'),
  ('uj-bemc', 'uj', 'health', 'Bachelor of Emergency Medical Care', 'degree'),
  ('uj-brad', 'uj', 'health', 'Bachelor of Diagnostic Radiography', 'degree'),
  ('uj-boptom', 'uj', 'health', 'Bachelor of Optometry', 'degree'),
  ('uj-bpodiatry', 'uj', 'health', 'Bachelor of Health Sciences in Podiatry', 'degree'),
  ('uj-bbiokinetics', 'uj', 'health', 'Bachelor of Health Sciences in Biokinetics', 'degree'),
  ('uj-llb', 'uj', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('uj-ba-law', 'uj', 'law', 'BA (Law)', 'degree'),
  ('uj-bcom-law', 'uj', 'law', 'BCom (Law)', 'degree'),
  ('uj-ba-psych', 'uj', 'humanities', 'BA (Psychology)', 'degree'),
  ('uj-ba-comm', 'uj', 'humanities', 'BA (Strategic Communication)', 'degree'),
  ('uj-ba-journ', 'uj', 'humanities', 'BA (Journalism)', 'degree'),
  ('uj-ba-pol', 'uj', 'humanities', 'BA (Politics, Economics and Technology)', 'degree'),
  ('uj-bsw', 'uj', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('uj-bed-fp', 'uj', 'education', 'BEd in Foundation Phase Teaching', 'degree'),
  ('uj-bed-ip', 'uj', 'education', 'BEd in Intermediate Phase Teaching', 'degree'),
  ('uj-bed-sp', 'uj', 'education', 'BEd in Senior Phase and FET Teaching', 'degree'),
  ('uj-dip-hosp', 'uj', 'commerce', 'Diploma in Hospitality Management', 'diploma'),
  ('uj-dip-acc', 'uj', 'commerce', 'Diploma in Accountancy', 'diploma'),
  ('ukzn-bcom-acc', 'ukzn', 'commerce', 'Bachelor of Commerce in Accounting', 'degree'),
  ('ukzn-bbussci', 'ukzn', 'commerce', 'Bachelor of Business Science', 'degree'),
  ('ukzn-bcom', 'ukzn', 'commerce', 'Bachelor of Commerce (General)', 'degree'),
  ('ukzn-bcom-mkt', 'ukzn', 'commerce', 'Bachelor of Commerce in Marketing', 'degree'),
  ('ukzn-bcom-is', 'ukzn', 'ict', 'Bachelor of Commerce in Information Systems and Technology', 'degree'),
  ('ukzn-badmin', 'ukzn', 'humanities', 'Bachelor of Administration', 'degree'),
  ('ukzn-bsc-eng-agric', 'ukzn', 'engineering', 'BSc Engineering (Agricultural)', 'degree'),
  ('ukzn-bsc-eng-chem', 'ukzn', 'engineering', 'BSc Engineering (Chemical)', 'degree'),
  ('ukzn-bsc-eng-civil', 'ukzn', 'engineering', 'BSc Engineering (Civil)', 'degree'),
  ('ukzn-bsc-eng-comp', 'ukzn', 'engineering', 'BSc Engineering (Computer)', 'degree'),
  ('ukzn-bsc-eng-elec', 'ukzn', 'engineering', 'BSc Engineering (Electrical)', 'degree'),
  ('ukzn-bsc-eng-mech', 'ukzn', 'engineering', 'BSc Engineering (Mechanical)', 'degree'),
  ('ukzn-bsc-land', 'ukzn', 'engineering', 'BSc Land Surveying', 'degree'),
  ('ukzn-bas', 'ukzn', 'engineering', 'Bachelor of Architectural Studies', 'degree'),
  ('ukzn-btrp', 'ukzn', 'engineering', 'Bachelor of Town and Regional Planning', 'degree'),
  ('ukzn-bsc-cs', 'ukzn', 'ict', 'BSc (Computer Science and Information Technology)', 'degree'),
  ('ukzn-bsc-bio', 'ukzn', 'science', 'BSc (Biological Sciences)', 'degree'),
  ('ukzn-bsc-chem', 'ukzn', 'science', 'BSc (Chemistry and Physics)', 'degree'),
  ('ukzn-bsc-env', 'ukzn', 'science', 'BSc (Environmental Sciences)', 'degree'),
  ('ukzn-bsc-agric', 'ukzn', 'science', 'BSc in Agriculture', 'degree'),
  ('ukzn-bsc-diet', 'ukzn', 'health', 'BSc Dietetics and Human Nutrition', 'degree'),
  ('ukzn-mbchb', 'ukzn', 'health', 'MBChB', 'degree'),
  ('ukzn-bpharm', 'ukzn', 'health', 'Bachelor of Pharmacy', 'degree'),
  ('ukzn-bnurs', 'ukzn', 'health', 'Bachelor of Nursing', 'degree'),
  ('ukzn-bphysio', 'ukzn', 'health', 'Bachelor of Physiotherapy', 'degree'),
  ('ukzn-bot', 'ukzn', 'health', 'Bachelor of Occupational Therapy', 'degree'),
  ('ukzn-boptom', 'ukzn', 'health', 'Bachelor of Optometry', 'degree'),
  ('ukzn-baudio', 'ukzn', 'health', 'Bachelor of Audiology', 'degree'),
  ('ukzn-bslt', 'ukzn', 'health', 'Bachelor of Speech-Language Therapy', 'degree'),
  ('ukzn-bdt', 'ukzn', 'health', 'Bachelor of Dental Therapy', 'degree'),
  ('ukzn-bsportsci', 'ukzn', 'health', 'Bachelor of Sport Science', 'degree'),
  ('ukzn-llb', 'ukzn', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('ukzn-ba', 'ukzn', 'humanities', 'Bachelor of Arts', 'degree'),
  ('ukzn-bsocsc', 'ukzn', 'humanities', 'Bachelor of Social Science', 'degree'),
  ('ukzn-bsw', 'ukzn', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('ukzn-ba-media', 'ukzn', 'humanities', 'Bachelor of Arts (Media and Cultural Studies)', 'degree'),
  ('ukzn-bmus', 'ukzn', 'humanities', 'Bachelor of Music', 'degree'),
  ('ukzn-bed-fp', 'ukzn', 'education', 'BEd (Foundation Phase Teaching)', 'degree'),
  ('ukzn-bed-ip', 'ukzn', 'education', 'BEd (Intermediate Phase Teaching)', 'degree'),
  ('ukzn-bed-sp', 'ukzn', 'education', 'BEd (Senior Phase and FET Teaching)', 'degree'),
  ('nwu-bcom-ca', 'nwu', 'commerce', 'BCom (Chartered Accountancy)', 'degree'),
  ('nwu-bcom-finacc', 'nwu', 'commerce', 'BCom (Financial Accountancy)', 'degree'),
  ('nwu-bcom-mgt-acc', 'nwu', 'commerce', 'BCom (Management Accountancy)', 'degree'),
  ('nwu-bcom-econ', 'nwu', 'commerce', 'BCom (Economic Sciences)', 'degree'),
  ('nwu-bcom-risk', 'nwu', 'commerce', 'BCom (Risk Management)', 'degree'),
  ('nwu-bcom-hrm', 'nwu', 'commerce', 'BCom (Human Resource Management)', 'degree'),
  ('nwu-bcom-mkt', 'nwu', 'commerce', 'BCom (Marketing Management)', 'degree'),
  ('nwu-bcom-scm', 'nwu', 'commerce', 'BCom (Transport Economics and Logistics)', 'degree'),
  ('nwu-bcom-it', 'nwu', 'ict', 'BCom (Information Systems)', 'degree'),
  ('nwu-bsc-it', 'nwu', 'ict', 'BSc (Information Technology)', 'degree'),
  ('nwu-bsc-cs', 'nwu', 'ict', 'BSc (Computer Science and Mathematics)', 'degree'),
  ('nwu-bsc-qrm', 'nwu', 'science', 'BSc (Quantitative Risk Management)', 'degree'),
  ('nwu-bsc-actuarial', 'nwu', 'science', 'BSc (Actuarial Science)', 'degree'),
  ('nwu-bsc-bio', 'nwu', 'science', 'BSc (Biological Sciences)', 'degree'),
  ('nwu-bsc-chem', 'nwu', 'science', 'BSc (Chemistry and Physics)', 'degree'),
  ('nwu-bsc-agric', 'nwu', 'science', 'BSc (Agriculture)', 'degree'),
  ('nwu-bsc-animal-health', 'nwu', 'science', 'BSc (Animal Health)', 'degree'),
  ('nwu-bsc-env', 'nwu', 'science', 'BSc (Environmental Sciences)', 'degree'),
  ('nwu-beng-chem', 'nwu', 'engineering', 'BEng (Chemical Engineering)', 'degree'),
  ('nwu-beng-elec', 'nwu', 'engineering', 'BEng (Electrical and Electronic Engineering)', 'degree'),
  ('nwu-beng-comp', 'nwu', 'engineering', 'BEng (Computer and Electronic Engineering)', 'degree'),
  ('nwu-beng-mech', 'nwu', 'engineering', 'BEng (Mechanical Engineering)', 'degree'),
  ('nwu-beng-ind', 'nwu', 'engineering', 'BEng (Industrial Engineering)', 'degree'),
  ('nwu-beng-mechatronic', 'nwu', 'engineering', 'BEng (Mechatronic Engineering)', 'degree'),
  ('nwu-bpharm', 'nwu', 'health', 'Bachelor of Pharmacy', 'degree'),
  ('nwu-bnurs', 'nwu', 'health', 'Bachelor of Nursing', 'degree'),
  ('nwu-bhsc-bio', 'nwu', 'health', 'BHSc (Biokinetics)', 'degree'),
  ('nwu-bsc-diet', 'nwu', 'health', 'BSc Dietetics', 'degree'),
  ('nwu-llb', 'nwu', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('nwu-bcom-law', 'nwu', 'law', 'BCom (Law)', 'degree'),
  ('nwu-ba-psych', 'nwu', 'humanities', 'BA (Psychology)', 'degree'),
  ('nwu-ba-comm', 'nwu', 'humanities', 'BA (Communication)', 'degree'),
  ('nwu-bsw', 'nwu', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('nwu-bmus', 'nwu', 'humanities', 'Bachelor of Music', 'degree'),
  ('nwu-bed-fp', 'nwu', 'education', 'BEd (Foundation Phase)', 'degree'),
  ('nwu-bed-ip', 'nwu', 'education', 'BEd (Intermediate Phase)', 'degree'),
  ('nwu-bed-sp', 'nwu', 'education', 'BEd (Senior and FET Phase)', 'degree'),
  ('ufs-bacc', 'ufs', 'commerce', 'Bachelor of Accounting (BAcc)', 'degree'),
  ('ufs-bcom-acc', 'ufs', 'commerce', 'BCom (Accounting)', 'degree'),
  ('ufs-bcom-econ', 'ufs', 'commerce', 'BCom (Economics)', 'degree'),
  ('ufs-bcom-bm', 'ufs', 'commerce', 'BCom (Business Management)', 'degree'),
  ('ufs-bcom-hrm', 'ufs', 'commerce', 'BCom (Human Resource Management)', 'degree'),
  ('ufs-bcom-mkt', 'ufs', 'commerce', 'BCom (Marketing)', 'degree'),
  ('ufs-badmin', 'ufs', 'humanities', 'Bachelor of Administration', 'degree'),
  ('ufs-barch', 'ufs', 'engineering', 'BArchitectural Studies', 'degree'),
  ('ufs-bsc-qs', 'ufs', 'engineering', 'BSc (Quantity Surveying)', 'degree'),
  ('ufs-bsc-cm', 'ufs', 'engineering', 'BSc (Construction Management)', 'degree'),
  ('ufs-bsc-cs', 'ufs', 'ict', 'BSc (Computer Science and Informatics)', 'degree'),
  ('ufs-bsc-actuarial', 'ufs', 'science', 'BSc (Actuarial Science)', 'degree'),
  ('ufs-bsc-math', 'ufs', 'science', 'BSc (Mathematical Statistics)', 'degree'),
  ('ufs-bsc-bio', 'ufs', 'science', 'BSc (Biological Sciences)', 'degree'),
  ('ufs-bsc-chem', 'ufs', 'science', 'BSc (Chemistry and Physics)', 'degree'),
  ('ufs-bsc-geology', 'ufs', 'science', 'BSc (Geology)', 'degree'),
  ('ufs-bsc-agric', 'ufs', 'science', 'BSc (Agriculture)', 'degree'),
  ('ufs-mbchb', 'ufs', 'health', 'MBChB', 'degree'),
  ('ufs-bot', 'ufs', 'health', 'Bachelor of Occupational Therapy', 'degree'),
  ('ufs-bphysio', 'ufs', 'health', 'BSc Physiotherapy', 'degree'),
  ('ufs-boptom', 'ufs', 'health', 'Bachelor of Optometry', 'degree'),
  ('ufs-bsc-diet', 'ufs', 'health', 'BSc Dietetics', 'degree'),
  ('ufs-bnurs', 'ufs', 'health', 'Bachelor of Nursing', 'degree'),
  ('ufs-brad', 'ufs', 'health', 'Bachelor of Radiography in Diagnostics', 'degree'),
  ('ufs-llb', 'ufs', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('ufs-ba', 'ufs', 'humanities', 'Bachelor of Arts', 'degree'),
  ('ufs-bsocsc', 'ufs', 'humanities', 'Bachelor of Social Science', 'degree'),
  ('ufs-bsw', 'ufs', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('ufs-ba-journ', 'ufs', 'humanities', 'BA (Journalism)', 'degree'),
  ('ufs-bmus', 'ufs', 'humanities', 'Bachelor of Music', 'degree'),
  ('ufs-bdrama', 'ufs', 'humanities', 'BA (Drama and Theatre Arts)', 'degree'),
  ('ufs-bed-fp', 'ufs', 'education', 'BEd (Foundation Phase Teaching)', 'degree'),
  ('ufs-bed-sp', 'ufs', 'education', 'BEd (Senior Phase and FET Teaching)', 'degree'),
  ('ufs-hc-bm', 'ufs', 'commerce', 'Higher Certificate in Business Management', 'hc'),
  ('nmu-mbchb', 'nmu', 'health', 'MBChB', 'degree'),
  ('nmu-bpharm', 'nmu', 'health', 'Bachelor of Pharmacy', 'degree'),
  ('nmu-brad', 'nmu', 'health', 'Bachelor of Radiography in Diagnostics', 'degree'),
  ('nmu-bnurs', 'nmu', 'health', 'Bachelor of Nursing', 'degree'),
  ('nmu-bhms', 'nmu', 'health', 'BHMS (Human Movement Science)', 'degree'),
  ('nmu-bsc-diet', 'nmu', 'health', 'BSc Dietetics', 'degree'),
  ('nmu-bcom-acc', 'nmu', 'commerce', 'BCom (Accounting) – CA stream', 'degree'),
  ('nmu-bcom', 'nmu', 'commerce', 'BCom (General)', 'degree'),
  ('nmu-bcom-econ', 'nmu', 'commerce', 'BCom (Economics)', 'degree'),
  ('nmu-bcom-hrm', 'nmu', 'commerce', 'BCom (Human Resource Management)', 'degree'),
  ('nmu-bcom-is', 'nmu', 'ict', 'BCom (Information Systems)', 'degree'),
  ('nmu-bcom-law', 'nmu', 'law', 'BCom (Law)', 'degree'),
  ('nmu-llb', 'nmu', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('nmu-beng-mechatronic', 'nmu', 'engineering', 'BEng (Mechatronics)', 'degree'),
  ('nmu-bengtech-civil', 'nmu', 'engineering', 'BEngTech (Civil Engineering)', 'degree'),
  ('nmu-bengtech-elec', 'nmu', 'engineering', 'BEngTech (Electrical Engineering)', 'degree'),
  ('nmu-bengtech-mech', 'nmu', 'engineering', 'BEngTech (Mechanical Engineering)', 'degree'),
  ('nmu-bas', 'nmu', 'engineering', 'BAS (Architectural Studies)', 'degree'),
  ('nmu-bsc-cs', 'nmu', 'ict', 'BSc (Computer Science)', 'degree'),
  ('nmu-bsc-bio', 'nmu', 'science', 'BSc (Biological Sciences)', 'degree'),
  ('nmu-bsc-env', 'nmu', 'science', 'BSc (Environmental Sciences)', 'degree'),
  ('nmu-bsc-ocean', 'nmu', 'science', 'BSc (Marine Biology)', 'degree'),
  ('nmu-ba', 'nmu', 'humanities', 'Bachelor of Arts', 'degree'),
  ('nmu-ba-media', 'nmu', 'humanities', 'BA (Media, Communication and Culture)', 'degree'),
  ('nmu-bsw', 'nmu', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('nmu-bed-fp', 'nmu', 'education', 'BEd (Foundation Phase Teaching)', 'degree'),
  ('nmu-bed-sp', 'nmu', 'education', 'BEd (Senior Phase and FET Teaching)', 'degree'),
  ('nmu-dip-mech', 'nmu', 'engineering', 'Diploma in Mechanical Engineering', 'diploma'),
  ('nmu-dip-mkt', 'nmu', 'commerce', 'Diploma in Marketing', 'diploma'),
  ('uwc-bds', 'uwc', 'health', 'Bachelor of Dental Surgery (BDS)', 'degree'),
  ('uwc-boh', 'uwc', 'health', 'Bachelor of Oral Health', 'degree'),
  ('uwc-bpharm', 'uwc', 'health', 'Bachelor of Pharmacy (BPharm)', 'degree'),
  ('uwc-bphysio', 'uwc', 'health', 'BSc Physiotherapy', 'degree'),
  ('uwc-bot', 'uwc', 'health', 'BSc Occupational Therapy', 'degree'),
  ('uwc-bsc-diet', 'uwc', 'health', 'BSc Dietetics and Nutrition', 'degree'),
  ('uwc-bnurs', 'uwc', 'health', 'Bachelor of Nursing', 'degree'),
  ('uwc-bsw', 'uwc', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('uwc-bsc-sres', 'uwc', 'health', 'BSc (Sport, Recreation and Exercise Science)', 'degree'),
  ('uwc-bcom-acc', 'uwc', 'commerce', 'BCom (Accounting)', 'degree'),
  ('uwc-bcom-finacc', 'uwc', 'commerce', 'BCom (Financial Accounting)', 'degree'),
  ('uwc-bcom-mgmt', 'uwc', 'commerce', 'BCom (Management)', 'degree'),
  ('uwc-bcom-is', 'uwc', 'ict', 'BCom (Information Systems)', 'degree'),
  ('uwc-badmin', 'uwc', 'humanities', 'Bachelor of Administration', 'degree'),
  ('uwc-llb', 'uwc', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('uwc-bcom-law', 'uwc', 'law', 'BCom (Law)', 'degree'),
  ('uwc-bsc-cs', 'uwc', 'ict', 'BSc (Computer Science)', 'degree'),
  ('uwc-bsc-biotech', 'uwc', 'science', 'BSc (Biotechnology)', 'degree'),
  ('uwc-bsc-env', 'uwc', 'science', 'BSc (Environmental and Water Science)', 'degree'),
  ('uwc-bsc-chem', 'uwc', 'science', 'BSc (Chemical Sciences)', 'degree'),
  ('uwc-ba', 'uwc', 'humanities', 'Bachelor of Arts', 'degree'),
  ('uwc-bed-fp', 'uwc', 'education', 'BEd (Foundation Phase)', 'degree'),
  ('uwc-bed-sp', 'uwc', 'education', 'BEd (Senior Phase and FET)', 'degree'),
  ('ufh-bcom-acc', 'ufh', 'commerce', 'BCom (Accounting)', 'degree'),
  ('ufh-bcom', 'ufh', 'commerce', 'Bachelor of Commerce', 'degree'),
  ('ufh-bcom-econ', 'ufh', 'commerce', 'BCom (Economics)', 'degree'),
  ('ufh-bcom-hrm', 'ufh', 'commerce', 'BCom (Human Resource Management)', 'degree'),
  ('ufh-badmin', 'ufh', 'humanities', 'Bachelor of Administration', 'degree'),
  ('ufh-llb', 'ufh', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('ufh-bnurs', 'ufh', 'health', 'Bachelor of Nursing Science', 'degree'),
  ('ufh-bsc-agric', 'ufh', 'science', 'BSc Agriculture', 'degree'),
  ('ufh-bagric', 'ufh', 'science', 'Bachelor of Agriculture', 'degree'),
  ('ufh-bsc-cs', 'ufh', 'ict', 'BSc (Computer Science)', 'degree'),
  ('ufh-bsc-bio', 'ufh', 'science', 'BSc (Biochemistry and Microbiology)', 'degree'),
  ('ufh-bsc-env', 'ufh', 'science', 'BSc (Environmental Science)', 'degree'),
  ('ufh-bsocsc', 'ufh', 'humanities', 'Bachelor of Social Science', 'degree'),
  ('ufh-bsw', 'ufh', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('ufh-ba', 'ufh', 'humanities', 'Bachelor of Arts', 'degree'),
  ('ufh-ba-journ', 'ufh', 'humanities', 'BA (Journalism)', 'degree'),
  ('ufh-bed-fp', 'ufh', 'education', 'BEd (Foundation Phase Teaching)', 'degree'),
  ('ufh-bed-sp', 'ufh', 'education', 'BEd (Senior Phase and FET Teaching)', 'degree'),
  ('univen-llb', 'univen', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('univen-bcom-acc', 'univen', 'commerce', 'BCom (Accounting)', 'degree'),
  ('univen-bcom-bm', 'univen', 'commerce', 'BCom (Business Management)', 'degree'),
  ('univen-bcom-econ', 'univen', 'commerce', 'BCom (Economics)', 'degree'),
  ('univen-badmin', 'univen', 'humanities', 'Bachelor of Administration', 'degree'),
  ('univen-bnurs', 'univen', 'health', 'Bachelor of Nursing', 'degree'),
  ('univen-bsc-nutrition', 'univen', 'health', 'BSc Nutrition', 'degree'),
  ('univen-bpsych', 'univen', 'humanities', 'Bachelor of Psychology', 'degree'),
  ('univen-bsw', 'univen', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('univen-ba', 'univen', 'humanities', 'Bachelor of Arts', 'degree'),
  ('univen-ba-media', 'univen', 'humanities', 'BA (Media Studies)', 'degree'),
  ('univen-bsc-agric', 'univen', 'science', 'BSc Agriculture', 'degree'),
  ('univen-bsc-env', 'univen', 'science', 'BSc Environmental Sciences', 'degree'),
  ('univen-bsc-biochem', 'univen', 'science', 'BSc Biochemistry and Microbiology', 'degree'),
  ('univen-bsc-cs', 'univen', 'ict', 'BSc Computer Science', 'degree'),
  ('univen-burp', 'univen', 'engineering', 'Bachelor of Urban and Regional Planning', 'degree'),
  ('univen-bed-fp', 'univen', 'education', 'BEd (Foundation Phase Teaching)', 'degree'),
  ('univen-bed-sp', 'univen', 'education', 'BEd (Senior Phase and FET Teaching)', 'degree'),
  ('ump-bagric-ext', 'ump', 'science', 'Bachelor of Agriculture in Agricultural Extension and Rural Resource Management', 'degree'),
  ('ump-bsc-agric', 'ump', 'science', 'Bachelor of Science in Agriculture', 'degree'),
  ('ump-bsc-env', 'ump', 'science', 'Bachelor of Science in Environmental Science', 'degree'),
  ('ump-bcom', 'ump', 'commerce', 'Bachelor of Commerce', 'degree'),
  ('ump-bdev', 'ump', 'humanities', 'Bachelor of Development Studies', 'degree'),
  ('ump-ba', 'ump', 'humanities', 'Bachelor of Arts (General)', 'degree'),
  ('ump-bed-fp', 'ump', 'education', 'Bachelor of Education in Foundation Phase Teaching', 'degree'),
  ('ump-bict', 'ump', 'ict', 'Bachelor of Information and Communication Technology', 'degree'),
  ('ump-dip-ict', 'ump', 'ict', 'Diploma in ICT in Applications Development', 'diploma'),
  ('ump-dip-hosp', 'ump', 'commerce', 'Diploma in Hospitality Management', 'diploma'),
  ('ump-dip-nature', 'ump', 'science', 'Diploma in Nature Conservation', 'diploma'),
  ('ump-dip-plant', 'ump', 'science', 'Diploma in Plant Production', 'diploma'),
  ('ump-dip-animal', 'ump', 'science', 'Diploma in Animal Production', 'diploma'),
  ('ump-hc-agric', 'ump', 'science', 'Higher Certificate in Agriculture', 'hc'),
  ('ump-hc-ict', 'ump', 'ict', 'Higher Certificate in ICT (User Support)', 'hc'),
  ('spu-bed-fp', 'spu', 'education', 'BEd (Foundation Phase Teaching)', 'degree'),
  ('spu-bed-ip', 'spu', 'education', 'BEd (Intermediate Phase Teaching)', 'degree'),
  ('spu-bed-sp', 'spu', 'education', 'BEd (Senior Phase and FET Teaching)', 'degree'),
  ('spu-bsc', 'spu', 'science', 'Bachelor of Science', 'degree'),
  ('spu-bsc-ds', 'spu', 'ict', 'Bachelor of Science in Data Science', 'degree'),
  ('spu-bcom-acc', 'spu', 'commerce', 'Bachelor of Commerce in Accounting', 'degree'),
  ('spu-bcom-econ', 'spu', 'commerce', 'Bachelor of Commerce in Economics', 'degree'),
  ('spu-ba', 'spu', 'humanities', 'Bachelor of Arts', 'degree'),
  ('spu-dip-retail', 'spu', 'commerce', 'Diploma in Retail Business Management', 'diploma'),
  ('spu-dip-ict', 'spu', 'ict', 'Diploma in ICT in Applications Development', 'diploma'),
  ('spu-hc-heritage', 'spu', 'humanities', 'Higher Certificate in Heritage Studies', 'hc'),
  ('spu-hc-court', 'spu', 'humanities', 'Higher Certificate in Court Interpreting', 'hc'),
  ('smu-mbchb', 'smu', 'health', 'Bachelor of Medicine and Bachelor of Surgery (MBChB)', 'degree'),
  ('smu-bds', 'smu', 'health', 'Bachelor of Dental Surgery (BDS)', 'degree'),
  ('smu-bpharm', 'smu', 'health', 'Bachelor of Pharmacy (BPharm)', 'degree'),
  ('smu-bsc-physio', 'smu', 'health', 'Bachelor of Science in Physiotherapy', 'degree'),
  ('smu-bot', 'smu', 'health', 'Bachelor of Occupational Therapy', 'degree'),
  ('smu-bsc-diet', 'smu', 'health', 'Bachelor of Science in Dietetics', 'degree'),
  ('smu-bslpa', 'smu', 'health', 'Bachelor of Speech-Language Pathology and Audiology', 'degree'),
  ('smu-brad', 'smu', 'health', 'Bachelor of Diagnostic Radiography', 'degree'),
  ('smu-bnurs', 'smu', 'health', 'Bachelor of Nursing and Midwifery', 'degree'),
  ('smu-bdt', 'smu', 'health', 'Bachelor of Dental Therapy', 'degree'),
  ('smu-boh', 'smu', 'health', 'Bachelor of Oral Hygiene', 'degree'),
  ('smu-bsc', 'smu', 'science', 'Bachelor of Science (Physics, Chemistry, Biology or Mathematics majors)', 'degree'),
  ('smu-bsc-cs', 'smu', 'ict', 'Bachelor of Science in Computer Science', 'degree'),
  ('unisa-bcom-acc', 'unisa', 'commerce', 'BCom in Accounting Sciences', 'degree'),
  ('unisa-bcom-fin', 'unisa', 'commerce', 'BCom (Financial Management)', 'degree'),
  ('unisa-bcom-bm', 'unisa', 'commerce', 'BCom (Business Management)', 'degree'),
  ('unisa-bcom-econ', 'unisa', 'commerce', 'BCom (Economics)', 'degree'),
  ('unisa-bcom-hrm', 'unisa', 'commerce', 'BCom (Human Resource Management)', 'degree'),
  ('unisa-bcom-mkt', 'unisa', 'commerce', 'BCom (Marketing Management)', 'degree'),
  ('unisa-llb', 'unisa', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('unisa-bsc-computing', 'unisa', 'ict', 'BSc (Computing)', 'degree'),
  ('unisa-bsc-math', 'unisa', 'science', 'BSc (Mathematics and Statistics)', 'degree'),
  ('unisa-bsc-env', 'unisa', 'science', 'BSc (Environmental Management)', 'degree'),
  ('unisa-ba-psych', 'unisa', 'humanities', 'BA (Psychology)', 'degree'),
  ('unisa-ba-comm', 'unisa', 'humanities', 'BA (Communication Science)', 'degree'),
  ('unisa-bsw', 'unisa', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('unisa-bed-fp', 'unisa', 'education', 'BEd (Foundation Phase Teaching)', 'degree'),
  ('unisa-bed-sp', 'unisa', 'education', 'BEd (Senior Phase and FET Teaching)', 'degree'),
  ('unisa-dip-acc', 'unisa', 'commerce', 'Diploma in Accounting Sciences', 'diploma'),
  ('unisa-dip-law', 'unisa', 'law', 'Diploma in Law', 'diploma'),
  ('unisa-hc-acc', 'unisa', 'commerce', 'Higher Certificate in Accounting Sciences', 'hc'),
  ('unisa-hc-ems', 'unisa', 'commerce', 'Higher Certificate in Economic and Management Sciences', 'hc'),
  ('unisa-hc-law', 'unisa', 'law', 'Higher Certificate in Law', 'hc'),
  ('unizulu-bcom-acc', 'unizulu', 'commerce', 'BCom (Accounting)', 'degree'),
  ('unizulu-bcom-mgmt', 'unizulu', 'commerce', 'BCom (Management)', 'degree'),
  ('unizulu-bcom-econ', 'unizulu', 'commerce', 'BCom (Economics)', 'degree'),
  ('unizulu-badmin', 'unizulu', 'humanities', 'Bachelor of Administration', 'degree'),
  ('unizulu-llb', 'unizulu', 'law', 'Bachelor of Laws (LLB)', 'degree'),
  ('unizulu-bnurs', 'unizulu', 'health', 'Bachelor of Nursing Science', 'degree'),
  ('unizulu-bcs', 'unizulu', 'science', 'Bachelor of Consumer Science', 'degree'),
  ('unizulu-bsc-cs', 'unizulu', 'ict', 'BSc (Computer Science)', 'degree'),
  ('unizulu-bsc-hydro', 'unizulu', 'science', 'BSc (Hydrology)', 'degree'),
  ('unizulu-bsc-agric', 'unizulu', 'science', 'BSc (Agriculture)', 'degree'),
  ('unizulu-bsc-bio', 'unizulu', 'science', 'BSc (Biological Sciences)', 'degree'),
  ('unizulu-ba', 'unizulu', 'humanities', 'Bachelor of Arts', 'degree'),
  ('unizulu-ba-tourism', 'unizulu', 'humanities', 'BA (Tourism Studies)', 'degree'),
  ('unizulu-bsw', 'unizulu', 'humanities', 'Bachelor of Social Work', 'degree'),
  ('unizulu-bed-fp', 'unizulu', 'education', 'BEd (Foundation Phase Teaching)', 'degree'),
  ('unizulu-bed-sp', 'unizulu', 'education', 'BEd (Senior Phase and FET Teaching)', 'degree'),
  ('tut-bpharm', 'tut', 'health', 'Bachelor of Pharmacy', 'degree'),
  ('tut-bnurs', 'tut', 'health', 'Bachelor of Nursing', 'degree'),
  ('tut-dip-bio', 'tut', 'health', 'Diploma in Biomedical Technology', 'diploma'),
  ('tut-dip-somatology', 'tut', 'health', 'Diploma in Somatology', 'diploma'),
  ('tut-dip-vet-tech', 'tut', 'health', 'Diploma in Veterinary Technology', 'diploma'),
  ('tut-bengtech-civil', 'tut', 'engineering', 'BEngTech in Civil Engineering', 'degree'),
  ('tut-bengtech-elec', 'tut', 'engineering', 'BEngTech in Electrical Engineering', 'degree'),
  ('tut-bengtech-mech', 'tut', 'engineering', 'BEngTech in Mechanical Engineering', 'degree'),
  ('tut-bengtech-ind', 'tut', 'engineering', 'BEngTech in Industrial Engineering', 'degree'),
  ('tut-bengtech-chem', 'tut', 'engineering', 'BEngTech in Chemical Engineering', 'degree'),
  ('tut-dip-arch', 'tut', 'engineering', 'Diploma in Architecture', 'diploma'),
  ('tut-dip-bldg', 'tut', 'engineering', 'Diploma in Building Science', 'diploma'),
  ('tut-dip-it-sd', 'tut', 'ict', 'Diploma in Information Technology (Software Development)', 'diploma'),
  ('tut-dip-it-cs', 'tut', 'ict', 'Diploma in Computer Science', 'diploma'),
  ('tut-dip-acc', 'tut', 'commerce', 'Diploma in Accounting', 'diploma'),
  ('tut-dip-fin', 'tut', 'commerce', 'Diploma in Financial Accounting', 'diploma'),
  ('tut-dip-mkt', 'tut', 'commerce', 'Diploma in Marketing', 'diploma'),
  ('tut-dip-hrm', 'tut', 'commerce', 'Diploma in Human Resource Management', 'diploma'),
  ('tut-dip-logistics', 'tut', 'commerce', 'Diploma in Logistics', 'diploma'),
  ('tut-dip-journ', 'tut', 'humanities', 'Diploma in Journalism', 'diploma'),
  ('tut-dip-law', 'tut', 'law', 'Diploma in Legal Sciences', 'diploma'),
  ('tut-dip-policing', 'tut', 'humanities', 'Diploma in Policing', 'diploma'),
  ('tut-dip-fashion', 'tut', 'humanities', 'Diploma in Fashion Design and Technology', 'diploma'),
  ('tut-dip-envsci', 'tut', 'science', 'Diploma in Environmental Sciences', 'diploma'),
  ('tut-dip-agric', 'tut', 'science', 'Diploma in Agriculture', 'diploma'),
  ('tut-bed-fp', 'tut', 'education', 'BEd in Foundation Phase Teaching', 'degree'),
  ('tut-bed-sp', 'tut', 'education', 'BEd in Senior Phase and FET Teaching', 'degree'),
  ('cput-bnurs', 'cput', 'health', 'Bachelor of Nursing', 'degree'),
  ('cput-bemc', 'cput', 'health', 'Bachelor of Emergency Medical Care', 'degree'),
  ('cput-bsc-rad', 'cput', 'health', 'BSc in Medical Imaging and Therapeutic Sciences (Diagnostic Radiography)', 'degree'),
  ('cput-dip-dental-tech', 'cput', 'health', 'Diploma in Dental Technology', 'diploma'),
  ('cput-dip-envhealth', 'cput', 'health', 'Diploma in Environmental Health', 'diploma'),
  ('cput-dip-civil', 'cput', 'engineering', 'Diploma in Civil Engineering', 'diploma'),
  ('cput-dip-elec', 'cput', 'engineering', 'Diploma in Electrical Engineering', 'diploma'),
  ('cput-dip-mech', 'cput', 'engineering', 'Diploma in Mechanical Engineering', 'diploma'),
  ('cput-dip-chem', 'cput', 'engineering', 'Diploma in Chemical Engineering', 'diploma'),
  ('cput-bengtech-civil', 'cput', 'engineering', 'BEngTech in Civil Engineering', 'degree'),
  ('cput-bengtech-elec', 'cput', 'engineering', 'BEngTech in Electrical Engineering', 'degree'),
  ('cput-dip-arch', 'cput', 'engineering', 'Diploma in Architectural Technology', 'diploma'),
  ('cput-dip-ict-app', 'cput', 'ict', 'Diploma in ICT in Applications Development', 'diploma'),
  ('cput-dip-ict-comm', 'cput', 'ict', 'Diploma in ICT in Communication Networks', 'diploma'),
  ('cput-dip-acc', 'cput', 'commerce', 'Diploma in Accountancy', 'diploma'),
  ('cput-dip-mkt', 'cput', 'commerce', 'Diploma in Marketing', 'diploma'),
  ('cput-dip-retail', 'cput', 'commerce', 'Diploma in Retail Business Management', 'diploma'),
  ('cput-dip-tourism', 'cput', 'commerce', 'Diploma in Tourism Management', 'diploma'),
  ('cput-dip-food', 'cput', 'science', 'Diploma in Food Technology', 'diploma'),
  ('cput-dip-journ', 'cput', 'humanities', 'Diploma in Journalism', 'diploma'),
  ('cput-dip-graphic', 'cput', 'humanities', 'Diploma in Graphic Design', 'diploma'),
  ('cput-dip-fashion', 'cput', 'humanities', 'Diploma in Fashion', 'diploma'),
  ('cput-bed-fp', 'cput', 'education', 'BEd in Foundation Phase Teaching', 'degree'),
  ('cput-bed-sp', 'cput', 'education', 'BEd in Senior Phase and FET Teaching', 'degree'),
  ('cut-brad', 'cut', 'health', 'Bachelor of Health Sciences in Diagnostic Radiography', 'degree'),
  ('cut-bhs-clinical', 'cut', 'health', 'Bachelor of Health Sciences in Clinical Technology', 'degree'),
  ('cut-dip-envhealth', 'cut', 'health', 'Diploma in Environmental Health', 'diploma'),
  ('cut-dip-dental', 'cut', 'health', 'Diploma in Dental Assisting', 'diploma'),
  ('cut-dip-somatology', 'cut', 'health', 'Diploma in Somatology', 'diploma'),
  ('cut-dip-civil', 'cut', 'engineering', 'Diploma in Civil Engineering', 'diploma'),
  ('cut-dip-elec', 'cut', 'engineering', 'Diploma in Electrical Engineering', 'diploma'),
  ('cut-dip-mech', 'cut', 'engineering', 'Diploma in Mechanical Engineering', 'diploma'),
  ('cut-bengtech-civil', 'cut', 'engineering', 'BEngTech in Civil Engineering', 'degree'),
  ('cut-bengtech-elec', 'cut', 'engineering', 'BEngTech in Electrical Engineering', 'degree'),
  ('cut-bengtech-mech', 'cut', 'engineering', 'BEngTech in Mechanical Engineering', 'degree'),
  ('cut-dip-ict', 'cut', 'ict', 'Diploma in ICT (Software Development)', 'diploma'),
  ('cut-dip-acc', 'cut', 'commerce', 'Diploma in Accounting', 'diploma'),
  ('cut-dip-mkt', 'cut', 'commerce', 'Diploma in Marketing', 'diploma'),
  ('cut-dip-hosp', 'cut', 'commerce', 'Diploma in Hospitality Management', 'diploma'),
  ('cut-dip-agric', 'cut', 'science', 'Diploma in Agricultural Management', 'diploma'),
  ('cut-dip-design', 'cut', 'humanities', 'Diploma in Design and Studio Art', 'diploma'),
  ('cut-bed-fp', 'cut', 'education', 'BEd in Foundation Phase Teaching', 'degree'),
  ('cut-bed-sp', 'cut', 'education', 'BEd in Senior Phase and FET Teaching', 'degree'),
  ('vut-dip-chem', 'vut', 'engineering', 'Diploma in Chemical Engineering', 'diploma'),
  ('vut-dip-civil', 'vut', 'engineering', 'Diploma in Civil Engineering', 'diploma'),
  ('vut-dip-elec', 'vut', 'engineering', 'Diploma in Electrical Engineering', 'diploma'),
  ('vut-dip-ind', 'vut', 'engineering', 'Diploma in Industrial Engineering', 'diploma'),
  ('vut-dip-mech', 'vut', 'engineering', 'Diploma in Mechanical Engineering', 'diploma'),
  ('vut-dip-met', 'vut', 'engineering', 'Diploma in Metallurgical Engineering', 'diploma'),
  ('vut-bengtech-elec', 'vut', 'engineering', 'BEngTech in Electrical Engineering', 'degree'),
  ('vut-bengtech-mech', 'vut', 'engineering', 'BEngTech in Mechanical Engineering', 'degree'),
  ('vut-dip-it', 'vut', 'ict', 'Diploma in Information Technology', 'diploma'),
  ('vut-dip-analytical', 'vut', 'science', 'Diploma in Analytical Chemistry', 'diploma'),
  ('vut-dip-biotech', 'vut', 'science', 'Diploma in Biotechnology', 'diploma'),
  ('vut-dip-cma', 'vut', 'commerce', 'Diploma in Cost and Management Accounting', 'diploma'),
  ('vut-dip-fin', 'vut', 'commerce', 'Diploma in Financial Information Systems', 'diploma'),
  ('vut-dip-hrm', 'vut', 'commerce', 'Diploma in Human Resource Management', 'diploma'),
  ('vut-dip-logistics', 'vut', 'commerce', 'Diploma in Logistics and Supply Chain Management', 'diploma'),
  ('vut-dip-mkt', 'vut', 'commerce', 'Diploma in Marketing', 'diploma'),
  ('vut-dip-tourism', 'vut', 'commerce', 'Diploma in Tourism Management', 'diploma'),
  ('vut-dip-food', 'vut', 'commerce', 'Diploma in Food Service Management', 'diploma'),
  ('vut-dip-safety', 'vut', 'science', 'Diploma in Safety Management', 'diploma'),
  ('vut-dip-fashion', 'vut', 'humanities', 'Diploma in Fashion', 'diploma'),
  ('vut-dip-photo', 'vut', 'humanities', 'Diploma in Photography', 'diploma'),
  ('vut-dip-legal', 'vut', 'law', 'Diploma in Legal Assistance', 'diploma'),
  ('dut-bhs-emc', 'dut', 'health', 'Bachelor of Health Sciences in Emergency Medical Care', 'degree'),
  ('dut-bhs-chiro', 'dut', 'health', 'Bachelor of Health Sciences in Chiropractic', 'degree'),
  ('dut-bhs-homoeo', 'dut', 'health', 'Bachelor of Health Sciences in Homoeopathy', 'degree'),
  ('dut-bhs-rad', 'dut', 'health', 'Bachelor of Health Sciences in Medical Imaging and Radiation Sciences', 'degree'),
  ('dut-bhs-somatology', 'dut', 'health', 'Bachelor of Health Sciences in Somatology', 'degree'),
  ('dut-bnurs', 'dut', 'health', 'Bachelor of Nursing', 'degree'),
  ('dut-bhs-clinical', 'dut', 'health', 'Bachelor of Health Sciences in Clinical Technology', 'degree'),
  ('dut-dip-dental-tech', 'dut', 'health', 'Diploma in Dental Technology', 'diploma'),
  ('dut-dip-envhealth', 'dut', 'health', 'Diploma in Environmental Health', 'diploma'),
  ('dut-dip-civil', 'dut', 'engineering', 'Diploma in Civil Engineering', 'diploma'),
  ('dut-dip-elec', 'dut', 'engineering', 'Diploma in Electrical Engineering', 'diploma'),
  ('dut-dip-mech', 'dut', 'engineering', 'Diploma in Mechanical Engineering', 'diploma'),
  ('dut-dip-chem', 'dut', 'engineering', 'Diploma in Chemical Engineering', 'diploma'),
  ('dut-bengtech-civil', 'dut', 'engineering', 'BEngTech in Civil Engineering', 'degree'),
  ('dut-bengtech-elec', 'dut', 'engineering', 'BEngTech in Electrical Engineering', 'degree'),
  ('dut-dip-arch', 'dut', 'engineering', 'Diploma in Architectural Technology', 'diploma'),
  ('dut-dip-ict-app', 'dut', 'ict', 'Diploma in ICT in Applications Development', 'diploma'),
  ('dut-dip-ict-bus', 'dut', 'ict', 'Diploma in ICT in Business Analysis', 'diploma'),
  ('dut-dip-acc', 'dut', 'commerce', 'Diploma in Accounting', 'diploma'),
  ('dut-dip-mgt-acc', 'dut', 'commerce', 'Diploma in Management Accounting', 'diploma'),
  ('dut-dip-mkt', 'dut', 'commerce', 'Diploma in Marketing', 'diploma'),
  ('dut-dip-hrm', 'dut', 'commerce', 'Diploma in Human Resource Management', 'diploma'),
  ('dut-dip-food', 'dut', 'science', 'Diploma in Food and Nutrition', 'diploma'),
  ('dut-dip-biotech', 'dut', 'science', 'Diploma in Biotechnology', 'diploma'),
  ('dut-dip-journ', 'dut', 'humanities', 'Diploma in Journalism', 'diploma'),
  ('dut-dip-lang', 'dut', 'humanities', 'Diploma in Language Practice', 'diploma'),
  ('dut-dip-fashion', 'dut', 'humanities', 'Diploma in Fashion Design', 'diploma'),
  ('mut-dip-chem', 'mut', 'engineering', 'Diploma in Chemical Engineering', 'diploma'),
  ('mut-dip-civil', 'mut', 'engineering', 'Diploma in Civil Engineering', 'diploma'),
  ('mut-dip-elec', 'mut', 'engineering', 'Diploma in Electrical Engineering', 'diploma'),
  ('mut-dip-mech', 'mut', 'engineering', 'Diploma in Mechanical Engineering', 'diploma'),
  ('mut-dip-survey', 'mut', 'engineering', 'Diploma in Surveying', 'diploma'),
  ('mut-dip-bldg', 'mut', 'engineering', 'Diploma in Building', 'diploma'),
  ('mut-dip-ict', 'mut', 'ict', 'Diploma in Information and Communication Technology', 'diploma'),
  ('mut-dip-acc', 'mut', 'commerce', 'Diploma in Accounting', 'diploma'),
  ('mut-dip-cma', 'mut', 'commerce', 'Diploma in Cost and Management Accounting', 'diploma'),
  ('mut-dip-hrm', 'mut', 'commerce', 'Diploma in Human Resource Management', 'diploma'),
  ('mut-dip-mkt', 'mut', 'commerce', 'Diploma in Marketing', 'diploma'),
  ('mut-dip-public', 'mut', 'commerce', 'Diploma in Public Management', 'diploma'),
  ('mut-dip-office', 'mut', 'commerce', 'Diploma in Office Management and Technology', 'diploma'),
  ('mut-dip-analytical', 'mut', 'science', 'Diploma in Analytical Chemistry', 'diploma'),
  ('mut-dip-nature', 'mut', 'science', 'Diploma in Nature Conservation', 'diploma'),
  ('mut-dip-agric', 'mut', 'science', 'Diploma in Agriculture', 'diploma'),
  ('mut-dip-envhealth', 'mut', 'health', 'Diploma in Environmental Health', 'diploma'),
  ('mut-dip-community', 'mut', 'humanities', 'Diploma in Community Extension', 'diploma')
on conflict (id) do update set institution_id = excluded.institution_id, field = excluded.field, name = excluded.name, qual = excluded.qual;

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
  choice1 text not null references public.programmes,
  choice2 text references public.programmes,
  status text not null check (status in ('awaiting_payment', 'submitted', 'under_review', 'docs_requested', 'waitlisted',
    'offer', 'declined', 'accepted', 'offer_declined', 'withdrawn')),
  fee int not null default 0,
  cao_group uuid,
  payment_ref text,
  paid_at timestamptz,
  offer_choice text references public.programmes,
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
alter table public.programmes enable row level security;
alter table public.settings enable row level security;
alter table public.profiles enable row level security;
alter table public.documents enable row level security;
alter table public.applications enable row level security;
alter table public.application_events enable row level security;

drop policy if exists institutions_read on public.institutions;
create policy institutions_read on public.institutions for select to anon, authenticated using (true);
drop policy if exists institutions_write on public.institutions;
create policy institutions_write on public.institutions for update to authenticated using (is_admin()) with check (is_admin());
drop policy if exists programmes_read on public.programmes;
create policy programmes_read on public.programmes for select to anon, authenticated using (true);
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
  me profiles; cfg settings; it jsonb; inst institutions; c1 programmes; c2 programmes; app applications;
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
    select * into c1 from programmes where id = it ->> 'choice1';
    if c1.id is null or c1.institution_id <> inst.id then raise exception '% does not offer your first choice', inst.short; end if;
    c2 := null;
    if coalesce(it ->> 'choice2', '') <> '' then
      select * into c2 from programmes where id = it ->> 'choice2';
      if c2.id is null or c2.institution_id <> inst.id then raise exception '% does not offer your second choice', inst.short; end if;
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
revoke insert, update, delete on public.institutions, public.programmes, public.settings from anon;
revoke all on public.profiles, public.documents from anon;

revoke all on function public.submit_applications(jsonb) from anon;
revoke all on function public.student_action(uuid, text, text, text) from anon;
revoke all on function public.officer_action(uuid, text, text, text) from anon;
revoke all on function public.set_role(uuid, text, text) from anon;
