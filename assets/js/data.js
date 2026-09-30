/* ImbizoConnect — reference data for the 2027 intake.
 *
 * Fees and closing dates were checked against university sites and public
 * application guides in September 2026. Where sources disagree the entry
 * carries `verify: true` and a note, and the UI tells students to confirm
 * with the university. Prospectus links point at each university's own
 * website; files in /prospectuses are mirrored copies of those PDFs.
 */

const DATA_VERIFIED = '30 September 2026';
const INTAKE_YEAR = 2027;

/* Central Applications Office (KwaZulu-Natal). One fee covers up to six
 * programme choices across UKZN, DUT, MUT and UNIZULU. */
const CAO = {
  name: 'Central Applications Office (CAO)',
  fee: 250,
  feeIntl: 300,
  lateFee: 470,
  maxChoices: 6,
  url: 'https://www.cao.ac.za/',
  closes: '2026-09-30',
  note: 'One R250 fee covers up to six choices across UKZN, DUT, MUT and UNIZULU. Late applications after 1 November cost R470.',
};

const FIELDS = {
  health:      { label: 'Health Sciences',              icon: '🩺' },
  engineering: { label: 'Engineering & Built Env.',     icon: '🏗️' },
  science:     { label: 'Natural & Agricultural Sci.',  icon: '🔬' },
  commerce:    { label: 'Commerce & Management',        icon: '📊' },
  law:         { label: 'Law',                          icon: '⚖️' },
  humanities:  { label: 'Humanities & Social Sciences', icon: '🧠' },
  education:   { label: 'Education',                    icon: '📚' },
  ict:         { label: 'Computing & ICT',              icon: '💻' },
};

const TYPES = {
  traditional:   'Traditional university',
  comprehensive: 'Comprehensive university',
  technology:    'University of Technology',
  distance:      'Distance learning',
};

/* fee: SA applicant fee in rand (0 = free). selectivity: added to a course's
 * baseline APS to estimate that institution's cut-off. */
const INSTITUTIONS = [
  { id:'uct', short:'UCT', name:'University of Cape Town', city:'Cape Town', province:'Western Cape', type:'traditional',
    fee:100, feeIntl:300, closes:'2026-07-31', earlyNote:'All undergraduate programmes closed 31 July 2026.',
    selectivity:6, apsNote:'UCT ranks applicants on a Faculty Points Score (FPS) out of 600, plus the NBT for most faculties.',
    fields:['health','engineering','science','commerce','law','humanities','ict'],
    web:'https://uct.ac.za/', apply:'https://uct.ac.za/students/applications-apply-undergraduate-qualifications/application-procedure',
    prospectus:{ year:2027, pdf:'https://uct.ac.za/sites/default/files/media/documents/2027-uct-undergraduate-prospectus-24-march-2026.pdf' } },

  { id:'wits', short:'Wits', name:'University of the Witwatersrand', city:'Johannesburg', province:'Gauteng', type:'traditional',
    fee:100, closes:'2026-09-30', earlyNote:'Health Sciences, Architecture, Audiology, Speech-Language Pathology and BA Film & TV closed 30 June 2026.',
    selectivity:5, apsNote:'Wits uses its own APS scale (up to 8 points per subject, with Maths and English weighted in some faculties).',
    fields:['health','engineering','science','commerce','law','humanities','education','ict'],
    web:'https://www.wits.ac.za/', apply:'https://www.wits.ac.za/',
    prospectus:{ year:2027, page:'https://www.wits.ac.za/undergraduate/' } },

  { id:'up', short:'UP', name:'University of Pretoria', city:'Pretoria', province:'Gauteng', type:'traditional',
    fee:300, closes:'2026-06-30', earlyNote:'Applications for all undergraduate programmes closed 30 June 2026.',
    selectivity:3, apsNote:'UP uses the standard 7-point APS, excluding Life Orientation.',
    fields:['health','engineering','science','commerce','law','humanities','education','ict'],
    web:'https://www.up.ac.za/', apply:'https://www.up.ac.za/',
    prospectus:{ year:2027, pdf:'https://drupalwebprod-files.up.ac.za/Public/2026-01/UP_UG%20Prospectus%202027_NSC-IEB_DevV5_web_0.pdf' } },

  { id:'su', short:'SU', name:'Stellenbosch University', city:'Stellenbosch', province:'Western Cape', type:'traditional',
    fee:100, feeIntl:400, closes:'2026-07-31', earlyNote:'All undergraduate programmes closed 31 July 2026.',
    selectivity:5, apsNote:'SU uses an average-percentage admission score (excluding Life Orientation) rather than APS.',
    fields:['health','engineering','science','commerce','law','humanities','education','ict'],
    web:'https://www.su.ac.za/', apply:'https://www.su.ac.za/en/apply',
    prospectus:{ year:2027, pdf:'https://files.su.ac.za/public/undergraduate-maties/documents/2026-01/su-admissions-booklet-2027.pdf' } },

  { id:'uj', short:'UJ', name:'University of Johannesburg', city:'Johannesburg', province:'Gauteng', type:'comprehensive',
    fee:0, feeNote:'Free online; paper applications may be charged.', closes:'2026-10-31',
    selectivity:1, apsNote:'UJ uses the standard 7-point APS, excluding Life Orientation.',
    fields:['health','engineering','science','commerce','law','humanities','education','ict'],
    web:'https://www.uj.ac.za/', apply:'https://www.uj.ac.za/',
    prospectus:{ year:2027, page:'https://www.uj.ac.za/study-uj-and-aid/undergraduate/undergraduate-prospectus-downloadable/' } },

  { id:'ukzn', short:'UKZN', name:'University of KwaZulu-Natal', city:'Durban', province:'KwaZulu-Natal', type:'traditional',
    cao:true, fee:250, closes:'2026-09-30',
    selectivity:2, apsNote:'Apply through the CAO. UKZN uses APS including a Life Orientation contribution for some programmes.',
    fields:['health','engineering','science','commerce','law','humanities','education','ict'],
    web:'https://ukzn.ac.za/', apply:'https://www.cao.ac.za/',
    prospectus:{ year:2027, page:'https://ukzn.ac.za/' } },

  { id:'nwu', short:'NWU', name:'North-West University', city:'Potchefstroom', province:'North West', type:'traditional',
    fee:0, closes:'2026-09-30', verify:true, earlyNote:'Some selection programmes close earlier. Check the NWU fields-of-study pages.',
    selectivity:1, apsNote:'NWU uses the standard 7-point APS, excluding Life Orientation.',
    fields:['health','engineering','science','commerce','law','humanities','education','ict'],
    web:'https://www.nwu.ac.za/', apply:'https://studies.nwu.ac.za/',
    prospectus:{ year:2027, page:'https://studies.nwu.ac.za/undergraduate-studies/fields-study-2027' } },

  { id:'ufs', short:'UFS', name:'University of the Free State', city:'Bloemfontein', province:'Free State', type:'traditional',
    fee:0, feeNote:'Free for SA citizens.', closes:'2026-09-30',
    selectivity:1, apsNote:'UFS uses the standard 7-point APS, excluding Life Orientation.',
    fields:['health','engineering','science','commerce','law','humanities','education','ict'],
    web:'https://www.ufs.ac.za/', apply:'https://www.ufs.ac.za/',
    prospectus:{ year:2027, pdf:'https://www.ufs.ac.za/docs/librariesprovider44/prospectus/ug-prospectus-2027.pdf' } },

  { id:'ru', short:'Rhodes', name:'Rhodes University', city:'Makhanda', province:'Eastern Cape', type:'traditional',
    fee:100, closes:'2026-09-30',
    selectivity:2, apsNote:'Rhodes uses a points system similar to APS, including a Life Orientation contribution.',
    fields:['health','science','commerce','law','humanities','education','ict'],
    web:'https://www.ru.ac.za/', apply:'https://www.ru.ac.za/admissiongateway/application/',
    prospectus:{ year:2027, pdf:'https://www.ru.ac.za/media/rhodesuniversity/content/registrar/documents/information/studentrecruitment/RU_READY_Undergraduate_Prospectus_2026_DIGITAL_A5_Landscape_24pp_18Mar2026.pdf' } },

  { id:'nmu', short:'NMU', name:'Nelson Mandela University', city:'Gqeberha', province:'Eastern Cape', type:'comprehensive',
    fee:0, closes:'2026-09-30',
    selectivity:0, apsNote:'NMU uses its own Admission Points Score based on percentages.',
    fields:['health','engineering','science','commerce','law','humanities','education','ict'],
    web:'https://www.mandela.ac.za/', apply:'https://www.mandela.ac.za/',
    prospectus:{ year:2027, page:'https://www.mandela.ac.za/' } },

  { id:'uwc', short:'UWC', name:'University of the Western Cape', city:'Bellville', province:'Western Cape', type:'traditional',
    fee:0, feeNote:'Free when applying online.', closes:'2026-09-30',
    selectivity:1, apsNote:'UWC uses its own points scale that includes Life Orientation.',
    fields:['health','science','commerce','law','humanities','education','ict'],
    web:'https://www.uwc.ac.za/', apply:'https://www.uwc.ac.za/',
    prospectus:{ year:2027, page:'https://www.uwc.ac.za/' } },

  { id:'ufh', short:'UFH', name:'University of Fort Hare', city:'Alice', province:'Eastern Cape', type:'traditional',
    fee:120, feeIntl:500, closes:'2026-10-31', verify:true,
    selectivity:0, apsNote:'UFH uses the standard 7-point APS, excluding Life Orientation.',
    fields:['health','science','commerce','law','humanities','education','ict'],
    web:'https://www.ufh.ac.za/', apply:'https://www.ufh.ac.za/apply/apply-undergraduate',
    prospectus:{ year:2027, page:'https://www.ufh.ac.za/admission' } },

  { id:'wsu', short:'WSU', name:'Walter Sisulu University', city:'Mthatha', province:'Eastern Cape', type:'comprehensive',
    fee:100, closes:'2026-10-31', verify:true, feeNote:'Some guides list online applications as free. Confirm on wsu.ac.za.',
    selectivity:-1, apsNote:'WSU uses the standard 7-point APS, excluding Life Orientation.',
    fields:['health','engineering','science','commerce','law','humanities','education','ict'],
    web:'https://www.wsu.ac.za/', apply:'https://www.wsu.ac.za/',
    prospectus:{ year:2027, pdf:'https://wsu.ac.za/media/attachments/2026/05/27/2027-information-brochure-admission-requirements.pdf' } },

  { id:'ul', short:'UL', name:'University of Limpopo', city:'Polokwane', province:'Limpopo', type:'traditional',
    fee:200, closes:'2026-09-30',
    selectivity:0, apsNote:'UL uses the standard 7-point APS, excluding Life Orientation.',
    fields:['health','science','commerce','law','humanities','education','ict'],
    web:'https://www.ul.ac.za/', apply:'https://www.ul.ac.za/',
    prospectus:{ year:2027, pdf:'https://www.ul.ac.za/wp-content/uploads/2025/03/Undergraduate-Prospectus-2027.pdf' } },

  { id:'univen', short:'UNIVEN', name:'University of Venda', city:'Thohoyandou', province:'Limpopo', type:'comprehensive',
    fee:0, closes:'2026-09-26',
    selectivity:-1, apsNote:'UNIVEN uses the standard 7-point APS, excluding Life Orientation.',
    fields:['health','science','commerce','law','humanities','education','ict'],
    web:'https://www.univen.ac.za/', apply:'https://www.univen.ac.za/',
    prospectus:{ year:2027, pdf:'https://www.univen.ac.za/wp-content/uploads/2026/03/2027-Univen-Undergraduate-Prospectus.pdf' } },

  { id:'ump', short:'UMP', name:'University of Mpumalanga', city:'Mbombela', province:'Mpumalanga', type:'comprehensive',
    fee:200, closes:'2026-11-30', verify:true, feeNote:'Some guides list online applications as free. Confirm on ump.ac.za.',
    selectivity:-1, apsNote:'UMP uses the standard 7-point APS, excluding Life Orientation.',
    fields:['science','commerce','humanities','education','ict'],
    web:'https://www.ump.ac.za/', apply:'https://www.ump.ac.za/',
    prospectus:{ year:2027, page:'https://www.ump.ac.za/' } },

  { id:'spu', short:'SPU', name:'Sol Plaatje University', city:'Kimberley', province:'Northern Cape', type:'comprehensive',
    fee:0, closes:'2026-11-30',
    selectivity:-1, apsNote:'SPU uses the standard 7-point APS, excluding Life Orientation.',
    fields:['science','commerce','humanities','education','ict'],
    web:'https://www.spu.ac.za/', apply:'https://www.spu.ac.za/index.php/how-to-apply/',
    prospectus:{ year:2026, page:'https://www.spu.ac.za/index.php/prospectus-2026/' } },

  { id:'smu', short:'SMU', name:'Sefako Makgatho Health Sciences University', city:'Ga-Rankuwa', province:'Gauteng', type:'traditional',
    fee:300, closes:'2026-07-31', earlyNote:'All undergraduate programmes closed 31 July 2026.',
    selectivity:2, apsNote:'SMU applies subject minimums per programme, weighted heavily towards Maths and Science.',
    fields:['health','science'],
    web:'https://www.smu.ac.za/', apply:'https://www.smu.ac.za/',
    prospectus:{ year:2027, page:'https://www.smu.ac.za/' } },

  { id:'unisa', short:'UNISA', name:'University of South Africa', city:'Pretoria (distance)', province:'National', type:'distance',
    fee:150, closes:'2026-10-09', verify:true, feeNote:'Non-refundable. The application window is short, usually mid-August to early October.',
    selectivity:-3, apsNote:'UNISA admits on NSC admission type (Bachelor, Diploma or Higher Certificate pass) plus subject minimums.',
    fields:['science','commerce','law','humanities','education','ict'],
    web:'https://www.unisa.ac.za/', apply:'https://www.unisa.ac.za/',
    prospectus:{ year:2027, page:'https://www.unisa.ac.za/' } },

  { id:'unizulu', short:'UNIZULU', name:'University of Zululand', city:'KwaDlangezwa', province:'KwaZulu-Natal', type:'comprehensive',
    cao:true, fee:250, closes:'2026-09-30',
    selectivity:-1, apsNote:'Apply through the CAO. UNIZULU uses the standard 7-point APS.',
    fields:['health','science','commerce','law','humanities','education','ict'],
    web:'https://www.unizulu.ac.za/', apply:'https://www.cao.ac.za/',
    prospectus:{ year:2027, page:'https://www.unizulu.ac.za/' } },

  { id:'tut', short:'TUT', name:'Tshwane University of Technology', city:'Pretoria', province:'Gauteng', type:'technology',
    fee:240, closes:'2026-09-30',
    selectivity:-3, apsNote:'TUT uses the standard APS. Most qualifications are diplomas with lower cut-offs.',
    fields:['health','engineering','science','commerce','humanities','education','ict'],
    web:'https://www.tut.ac.za/', apply:'https://www.tut.ac.za/',
    prospectus:{ year:2027, page:'https://www.tut.ac.za/' } },

  { id:'cput', short:'CPUT', name:'Cape Peninsula University of Technology', city:'Cape Town', province:'Western Cape', type:'technology',
    fee:0, closes:'2026-09-30', earlyNote:'Some programmes (e.g. Health & Wellness) closed earlier.',
    selectivity:-3, apsNote:'CPUT uses its own points calculation per faculty.',
    fields:['health','engineering','science','commerce','humanities','education','ict'],
    web:'https://www.cput.ac.za/', apply:'https://www.cput.ac.za/',
    prospectus:{ year:2027, page:'https://www.cput.ac.za/' } },

  { id:'cut', short:'CUT', name:'Central University of Technology', city:'Bloemfontein', province:'Free State', type:'technology',
    fee:0, feeNote:'Free online.', closes:'2026-09-30',
    selectivity:-3, apsNote:'CUT uses the standard APS. Most qualifications are diplomas.',
    fields:['health','engineering','science','commerce','education','ict'],
    web:'https://www.cut.ac.za/', apply:'https://www.cut.ac.za/',
    prospectus:{ year:2027, page:'https://www.cut.ac.za/' } },

  { id:'vut', short:'VUT', name:'Vaal University of Technology', city:'Vanderbijlpark', province:'Gauteng', type:'technology',
    fee:100, closes:'2026-09-30',
    selectivity:-4, apsNote:'VUT uses the standard APS. Most qualifications are diplomas.',
    fields:['engineering','science','commerce','humanities','ict'],
    web:'https://www.vut.ac.za/', apply:'https://www.vut.ac.za/',
    prospectus:{ year:2027, page:'https://www.vut.ac.za/' } },

  { id:'dut', short:'DUT', name:'Durban University of Technology', city:'Durban', province:'KwaZulu-Natal', type:'technology',
    cao:true, fee:250, closes:'2026-09-30',
    selectivity:-3, apsNote:'Apply through the CAO. DUT uses the standard APS.',
    fields:['health','engineering','science','commerce','humanities','ict'],
    web:'https://www.dut.ac.za/', apply:'https://www.cao.ac.za/',
    prospectus:{ year:2027, page:'https://www.dut.ac.za/' } },

  { id:'mut', short:'MUT', name:'Mangosuthu University of Technology', city:'Umlazi', province:'KwaZulu-Natal', type:'technology',
    cao:true, fee:250, closes:'2026-09-30',
    selectivity:-4, apsNote:'Apply through the CAO. MUT uses the standard APS.',
    fields:['engineering','science','commerce','ict'],
    web:'https://www.mut.ac.za/', apply:'https://www.cao.ac.za/',
    prospectus:{ year:2027, page:'https://www.mut.ac.za/' } },
];

/* Courses carry a baseline APS (7-point scale, LO excluded) for a mid-tier
 * traditional university. Institution selectivity shifts it up or down.
 * req keys are minimum percentages: math (Pure/Technical Maths), mathOrLit,
 * sci (Physical Sciences), life (Life Sciences), eng (English). */
const COURSES = [
  { id:'mbchb',   field:'health', name:'MBChB (Medicine)',            years:6, aps:36, req:{ math:60, sci:60, eng:60 } },
  { id:'bpharm',  field:'health', name:'BPharm (Pharmacy)',           years:4, aps:32, req:{ math:60, sci:60 } },
  { id:'nursing', field:'health', name:'Bachelor of Nursing',         years:4, aps:26, req:{ mathOrLit:50, life:50, eng:50 } },
  { id:'physio',  field:'health', name:'BSc Physiotherapy',           years:4, aps:32, req:{ math:50, sci:50, life:50 } },
  { id:'radio',   field:'health', name:'Diagnostic Radiography',      years:4, aps:28, req:{ math:50, sci:50 } },
  { id:'ot',      field:'health', name:'BSc Occupational Therapy',    years:4, aps:30, req:{ math:50, life:50 } },

  { id:'civil',   field:'engineering', name:'BEng Civil Engineering',      years:4, aps:32, req:{ math:70, sci:60 } },
  { id:'elec',    field:'engineering', name:'BEng Electrical Engineering', years:4, aps:32, req:{ math:70, sci:60 } },
  { id:'mech',    field:'engineering', name:'BEng Mechanical Engineering', years:4, aps:32, req:{ math:70, sci:60 } },
  { id:'chem',    field:'engineering', name:'BEng Chemical Engineering',   years:4, aps:34, req:{ math:70, sci:70 } },
  { id:'arch',    field:'engineering', name:'BAS Architecture',            years:3, aps:30, req:{ math:60 } },

  { id:'bsc',     field:'science', name:'BSc Biological Sciences',    years:3, aps:28, req:{ math:50, sci:50 } },
  { id:'actsci',  field:'science', name:'BSc Actuarial Science',      years:3, aps:36, req:{ math:80 } },
  { id:'agri',    field:'science', name:'BSc Agriculture',            years:4, aps:26, req:{ math:50, sci:50 } },
  { id:'envsci',  field:'science', name:'BSc Environmental Science',  years:3, aps:26, req:{ math:50 } },

  { id:'acc',     field:'commerce', name:'BCom Accounting (CA stream)', years:3, aps:32, req:{ math:60, eng:50 } },
  { id:'fin',     field:'commerce', name:'BCom Finance',                years:3, aps:30, req:{ math:60 } },
  { id:'econ',    field:'commerce', name:'BCom Economics',              years:3, aps:28, req:{ math:50 } },
  { id:'mgmt',    field:'commerce', name:'BCom Business Management',    years:3, aps:26, req:{ mathOrLit:50, eng:50 } },
  { id:'hr',      field:'commerce', name:'BCom Human Resource Mgmt',    years:3, aps:26, req:{ mathOrLit:50, eng:50 } },
  { id:'mkt',     field:'commerce', name:'BCom Marketing Management',   years:3, aps:26, req:{ mathOrLit:50, eng:50 } },

  { id:'llb',     field:'law', name:'LLB (Bachelor of Laws)', years:4, aps:32, req:{ eng:60 } },
  { id:'balaw',   field:'law', name:'BA Law',                 years:3, aps:30, req:{ eng:60 } },
  { id:'bcomlaw', field:'law', name:'BCom Law',               years:3, aps:30, req:{ math:50, eng:60 } },

  { id:'psych',   field:'humanities', name:'BA Psychology',         years:3, aps:28, req:{ eng:60 } },
  { id:'bsw',     field:'humanities', name:'Bachelor of Social Work', years:4, aps:26, req:{ eng:50 } },
  { id:'media',   field:'humanities', name:'BA Media & Communication', years:3, aps:28, req:{ eng:60 } },
  { id:'polsci',  field:'humanities', name:'BA Politics & Intl Relations', years:3, aps:28, req:{ eng:60 } },

  { id:'bedfp',   field:'education', name:'BEd Foundation Phase',          years:4, aps:26, req:{ mathOrLit:40, eng:50 } },
  { id:'bedsp',   field:'education', name:'BEd Senior Phase & FET',        years:4, aps:26, req:{ eng:50 } },
  { id:'bedmath', field:'education', name:'BEd FET Maths & Science',       years:4, aps:28, req:{ math:50, sci:50 } },

  { id:'cs',      field:'ict', name:'BSc Computer Science',    years:3, aps:30, req:{ math:60 } },
  { id:'it',      field:'ict', name:'BSc Information Technology', years:3, aps:28, req:{ math:50 } },
  { id:'ds',      field:'ict', name:'BSc Data Science',        years:3, aps:32, req:{ math:70 } },
  { id:'is',      field:'ict', name:'BCom Information Systems', years:3, aps:28, req:{ math:50 } },
];

const SUBJECTS = [
  'Afrikaans Home Language','Afrikaans First Additional Language',
  'English Home Language','English First Additional Language',
  'IsiZulu Home Language','IsiZulu First Additional Language',
  'IsiXhosa Home Language','IsiXhosa First Additional Language',
  'Sepedi Home Language','Sepedi First Additional Language',
  'Setswana Home Language','Setswana First Additional Language',
  'Sesotho Home Language','Sesotho First Additional Language',
  'Xitsonga Home Language','Siswati Home Language','Tshivenda Home Language','IsiNdebele Home Language',
  'Mathematics','Mathematical Literacy','Technical Mathematics',
  'Physical Sciences','Technical Sciences','Life Sciences','Agricultural Sciences','Marine Sciences',
  'Accounting','Business Studies','Economics','Tourism',
  'History','Geography','Religion Studies',
  'Visual Arts','Music','Dramatic Arts','Dance Studies','Design',
  'Computer Applications Technology','Information Technology',
  'Engineering Graphics & Design',
  'Agricultural Management Practices','Agricultural Technology',
  'Consumer Studies','Hospitality Studies',
  'Civil Technology','Mechanical Technology','Electrical Technology',
  'Life Orientation',
].sort();

const SAMPLE_RESULTS = [
  { s:'English Home Language', m:72 },
  { s:'IsiZulu First Additional Language', m:78 },
  { s:'Mathematics', m:65 },
  { s:'Physical Sciences', m:58 },
  { s:'Accounting', m:68 },
  { s:'Business Studies', m:71 },
  { s:'Life Orientation', m:80 },
];

/* Career guide. Salaries are indicative ranges for early-to-mid career in
 * South Africa; they vary widely by employer and region. */
const CAREERS = [
  { title:'Medical Doctor', course:'mbchb', icon:'🩺', salary:'R850k – R1.6m', note:'Two years of internship and one year of community service after the degree.' ,
    description:'Diagnose and treat illness, perform procedures and lead patient care in hospitals and clinics.' },
  { title:'Pharmacist', course:'bpharm', icon:'💊', salary:'R450k – R750k', note:'Includes a one-year internship and community service.',
    description:'Dispense medicine, counsel patients on safe use and manage pharmaceutical supply in retail, hospital and industry.' },
  { title:'Registered Nurse', course:'nursing', icon:'🏥', salary:'R280k – R480k', note:'Registered with the South African Nursing Council.',
    description:'Deliver frontline patient care, administer treatment and coordinate care across hospitals and clinics.' },
  { title:'Physiotherapist', course:'physio', icon:'🦴', salary:'R350k – R650k', note:'Community service year required.',
    description:'Help patients recover movement and manage pain after injury, surgery or illness.' },
  { title:'Civil Engineer', course:'civil', icon:'🏗️', salary:'R450k – R950k', note:'Professional registration with ECSA after supervised experience.',
    description:'Design and manage roads, bridges, water systems and buildings.' },
  { title:'Electrical Engineer', course:'elec', icon:'⚡', salary:'R500k – R1m', note:'High demand in energy and renewable projects.',
    description:'Design power systems, electronics and control systems for industry and infrastructure.' },
  { title:'Actuary', course:'actsci', icon:'📐', salary:'R700k – R1.8m', note:'Qualification continues through ASSA board exams after the degree.',
    description:'Use maths and statistics to price risk for insurers, pension funds and banks.' },
  { title:'Chartered Accountant', course:'acc', icon:'📊', salary:'R600k – R1.3m', note:'BCom, then a CTA/PGDA, three years of training contract and SAICA board exams.',
    description:'Audit, advise and lead finance functions. One of the most in-demand professional designations in SA.' },
  { title:'Software Developer', course:'cs', icon:'💻', salary:'R350k – R900k', note:'Portfolio projects matter as much as marks.',
    description:'Build software, web and mobile applications, and the systems behind them.' },
  { title:'Data Scientist', course:'ds', icon:'🔬', salary:'R550k – R1.1m', note:'Honours or Masters is common.',
    description:'Turn large datasets into insights and predictive models for business and research.' },
  { title:'Attorney', course:'llb', icon:'⚖️', salary:'R350k – R950k', note:'LLB, then practical vocational training and the Legal Practice Council board exams.',
    description:'Advise clients, draft contracts and represent people and businesses in court.' },
  { title:'Business Manager', course:'mgmt', icon:'📈', salary:'R300k – R700k', note:'Many graduates start in trainee or graduate programmes.',
    description:'Run operations, teams and strategy, or launch your own venture.' },
  { title:'Teacher', course:'bedsp', icon:'📚', salary:'R260k – R450k', note:'Funza Lushaka bursaries cover teaching degrees in priority subjects.',
    description:'Teach and mentor learners at primary or high school level.' },
  { title:'Social Worker', course:'bsw', icon:'🤝', salary:'R220k – R420k', note:'Registered with the SACSSP.',
    description:'Support individuals, families and communities through crisis and connect them to services.' },
  { title:'Psychologist', course:'psych', icon:'🧠', salary:'R350k – R800k', note:'Registration needs Honours, a Masters and an internship.',
    description:'Assess and treat mental health, or apply psychology in organisations and schools.' },
];

const DOCUMENTS = [
  { id:'id',    icon:'🪪', name:'Certified copy of SA ID or smart card', hint:'Both sides · PDF or JPG · max 5 MB', required:true },
  { id:'gr11',  icon:'📋', name:'Grade 11 final results', hint:'Used for conditional offers while you finish Grade 12 · PDF', required:true },
  { id:'gr12',  icon:'🎓', name:'Grade 12 June / trial results', hint:'Upload as soon as they are available · PDF', required:false },
  { id:'res',   icon:'🏠', name:'Proof of residence', hint:'Not older than 3 months · utility bill or affidavit · PDF', required:false },
  { id:'photo', icon:'📸', name:'Passport-size photograph', hint:'Recent, plain background · JPG or PNG · max 2 MB', required:false },
  { id:'guard', icon:'👪', name:'Parent / guardian ID', hint:'Needed for NSFAS and some residence applications', required:false },
];

/* Brand palettes used for each university's artwork.
 * c = main brand colour (buildings, monogram), w = accent that lights the
 * windows on hover, s = sun / secondary accent. Based on each university's
 * published colours; entries marked `approx` could not be confirmed from an
 * official source and use the dominant colours of the crest. */
const BRAND = {
  uct:     { c:'#003B71', w:'#7FC8F8', s:'#7FC8F8' },             // dark blue, light blue
  wits:    { c:'#003E7E', w:'#E3B45A', s:'#E3B45A' },             // blue, gold
  up:      { c:'#005BAA', w:'#D6A844', s:'#D2232A' },             // blue, gold, red
  su:      { c:'#61223B', w:'#C5A45A', s:'#C5A45A' },             // maroon, gold
  uj:      { c:'#E8611A', w:'#FFD200', s:'#FFD200' },             // orange, yellow
  ukzn:    { c:'#1E1E1E', w:'#E0303F', s:'#E0303F' },             // black, red
  nwu:     { c:'#512C85', w:'#36C0C9', s:'#9AA4AE' },             // purple, turquoise, grey
  ufs:     { c:'#0F204B', w:'#F2A900', s:'#C8102E', approx:true }, // navy, gold, red
  ru:      { c:'#5B2A86', w:'#FFFFFF', s:'#C9B8E0' },             // purple, white
  nmu:     { c:'#002B5C', w:'#FFC72C', s:'#FFC72C' },             // blue, yellow
  uwc:     { c:'#1D3C8F', w:'#F5B21B', s:'#F5B21B' },             // blue, gold (crest)
  ufh:     { c:'#0D3B8C', w:'#FFD100', s:'#FFD100' },             // blue, yellow
  wsu:     { c:'#161616', w:'#FFFFFF', s:'#D9D9D9' },             // black, white
  ul:      { c:'#004B8D', w:'#8DC63F', s:'#F2B632', approx:true }, // blue, green, gold
  univen:  { c:'#00613A', w:'#F7B500', s:'#F7B500', approx:true }, // green, gold
  ump:     { c:'#00467F', w:'#F7941D', s:'#6DB33F', approx:true }, // blue, orange, green
  spu:     { c:'#C8202F', w:'#F7941D', s:'#F7941D' },             // red, orange
  smu:     { c:'#00529B', w:'#F7941D', s:'#F7941D' },             // blue, orange
  unisa:   { c:'#7A1F3D', w:'#FFFFFF', s:'#1B2A4A' },             // maroon, white, navy
  unizulu: { c:'#003A80', w:'#E0B84C', s:'#E0B84C' },             // blue, gold
  tut:     { c:'#003A80', w:'#F2B632', s:'#D2232A' },             // blue, gold, red
  cput:    { c:'#004B93', w:'#6CC4EE', s:'#A7DDF6' },             // three blues
  cut:     { c:'#004C97', w:'#FFD100', s:'#D2232A' },             // blue, yellow, red
  vut:     { c:'#0F52BA', w:'#F0E130', s:'#D4AF37' },             // sapphire, dandelion, gold
  dut:     { c:'#5B2C83', w:'#89CFF0', s:'#3FA34D' },             // purple, baby blue, green
  mut:     { c:'#800020', w:'#E0B84C', s:'#E0B84C' },             // maroon, gold
};
