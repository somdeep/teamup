// TeamUp seed script: loads data/*.csv, merges duplicate people, and uploads to Supabase.
// Run from the repo root:  npm run seed           (uploads)
//                          npm run seed -- --dry-run   (merges and scores only, uploads nothing)
//                          npm run seed -- --event-assignments-only   (backfills existing events)
// Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local. No extra packages.
import { readFileSync } from 'node:fs';
import { randomUUID, createHash } from 'node:crypto';

const DRY = process.argv.includes('--dry-run');
const DATA = new URL('../data/', import.meta.url);

// ---------- CSV + text helpers ----------
function parseCSV(text) {
  const rows = []; let row = [], f = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"') { if (text[i + 1] === '"') { f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ',') { row.push(f); f = ''; }
    else if (c === '\n') { row.push(f); rows.push(row); row = []; f = ''; }
    else if (c !== '\r') f += c;
  }
  if (f || row.length) { row.push(f); rows.push(row); }
  const [h, ...rest] = rows;
  return rest.map(r => Object.fromEntries(h.map((k, i) => [k, r[i] ?? ''])));
}
const load = name => parseCSV(readFileSync(new URL(name + '.csv', DATA), 'utf8'));
const json = s => { try { return JSON.parse(s); } catch { return null; } };
const t = s => (s ?? '').trim();
const nName = s => t(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z]/g, '');
const nEmail = s => t(s).toLowerCase();
const nPhone = s => { const d = (s ?? '').replace(/\D/g, ''); return d.length >= 10 ? d.slice(-10) : ''; };
const hash = s => createHash('sha256').update(s).digest();
const mode = arr => { const m = new Map(); for (const v of arr) if (v) m.set(v, (m.get(v) || 0) + 1); let b = null, n = 0; for (const [v, c] of m) if (c > n) { b = v; n = c; } return b; };
const niceCase = vals => mode(vals.filter(v => v && v !== v.toUpperCase())) || mode(vals);

const hPrograms = load('harmony_programs');
const hPeople = load('harmony_program_people');
const rgPrograms = load('retreat_guru_programs');
const harmonyProgramIds = new Map(hPrograms.map(p => [p.source_record_id, p.program_id]));
const harmonyRoles = new Map([
  ['Organizer', 'organizer'], ['Co-Organizer', 'co_organizer'], ['Coordinator', 'coordinator'],
  ['Teacher', 'teacher'], ['Co-Teacher', 'co_teacher'],
]);
const eventAssignments = hPeople.map(p => {
  const role = harmonyRoles.get(t(p.role));
  const eventId = harmonyProgramIds.get(p.program_source_record_id);
  if (!role || !eventId || !p.contact_id) throw new Error('A Harmony assignment has an invalid role or source link.');
  return {
    source_system: 'harmony', event_source_id: eventId, source_table: 'harmony_program_people',
    person_external_id: p.contact_id, role,
  };
});
for (const program of rgPrograms) {
  for (const teacherId of json(program.program_info)?.teachers ?? []) {
    eventAssignments.push({
      source_system: 'retreat_guru', event_source_id: program.program_id, source_table: 'retreat_guru_teachers',
      person_external_id: teacherId, role: 'teacher',
    });
  }
}

if (process.argv.includes('--event-assignments-json')) {
  console.log(JSON.stringify(eventAssignments));
  process.exit(0);
}
if (process.argv.includes('--event-assignments-only')) {
  if (DRY) console.log(`Event assignments: ${eventAssignments.length}. Dry run: nothing uploaded.`);
  else await uploadEventAssignments();
  process.exit(0);
}

const TZ = { atlanta: 'America/New_York', austin: 'America/Chicago', boone: 'America/New_York', boston: 'America/New_York', brampton: 'America/Toronto', calgary: 'America/Edmonton', chicago: 'America/Chicago', denver: 'America/Denver', detroit: 'America/Detroit', edmonton: 'America/Edmonton', halifax: 'America/Halifax', mississauga: 'America/Toronto', montreal: 'America/Toronto', 'new york': 'America/New_York', ottawa: 'America/Toronto', phoenix: 'America/Phoenix', 'quebec city': 'America/Toronto', raleigh: 'America/New_York', 'san jose': 'America/Los_Angeles', seattle: 'America/Los_Angeles', toronto: 'America/Toronto', vancouver: 'America/Vancouver', victoria: 'America/Vancouver', winnipeg: 'America/Winnipeg', online: null };
const CITY = Object.fromEntries(Object.keys(TZ).map(k => [k, k.replace(/\b\w/g, c => c.toUpperCase())]));
const city = s => CITY[t(s).toLowerCase()] || (t(s) || null);
const tzFor = c => TZ[(c || '').toLowerCase()] || 'America/Toronto';

// ---------- 1. Collect person records from every source ----------
const recs = []; // { system, table, ext, first, last, email, phone, city, keys[], volunteer, teacher, course }
const add = r => recs.push({ keys: [], volunteer: false, teacher: false, ...r });

const ebEvents = new Map(load('eventbrite_events').map(e => [e.event_id, e]));
const answers = new Map();
for (const a of load('eventbrite_attendee_answers')) {
  const m = answers.get(a.attendee_source_record_id) || {}; m[a.question_id] = a.answer; answers.set(a.attendee_source_record_id, m);
}
for (const a of load('eventbrite_attendees')) {
  const ans = answers.get(a.source_record_id) || {}, ev = ebEvents.get(a.event_id);
  add({ system: 'eventbrite', table: 'eventbrite_attendees', ext: a.attendee_id, first: a.first_name, last: a.last_name, email: a.email, phone: ans.q_phone, city: ans.q_city,
        course: a.cancelled !== 'True' && ev ? { name: ev.name, date: ev.starts_at_local.slice(0, 10) } : null });
}

const hProg = new Map(hPrograms.map(p => [p.program_id, p]));
for (const p of load('harmony_program_participants')) {
  const prog = hProg.get(p.program_id), attended = ['Attended', 'Partial'].includes(p.attendance_status);
  add({ system: 'harmony', table: 'harmony_program_participants', ext: p.registration_id, first: p.first_name, last: p.last_name, email: p.primary_email, phone: p.mobile_phone, city: p.city,
        keys: ['hc:' + p.contact_id],
        volunteer: ['Volunteer', 'Staff'].includes(p.participant_type) || (prog?.type === 'VTP' && attended),
        course: attended && prog ? { name: prog.product_name, date: prog.start_date } : null });
}

for (const p of load('retreat_guru_people'))
  add({ system: 'retreat_guru', table: 'retreat_guru_people', ext: p.person_id, first: p.first_name, last: p.last_name, email: p.email, phone: p.phone, city: p.city, keys: ['rg:' + p.person_id] });
for (const r of load('retreat_guru_registrations'))
  add({ system: 'retreat_guru', table: 'retreat_guru_registrations', ext: r.registration_id, first: r.first_name, last: r.last_name, email: r.email, phone: r.phone, keys: ['rg:' + r.person_id],
        course: r.status === 'completed' ? { name: r.program_name, date: r.start_date } : null });

// Teachers and organizers (not in the answer key, merged by email and name)
const seenContact = new Set();
for (const p of hPeople) {
  if (seenContact.has(p.contact_id)) continue; seenContact.add(p.contact_id);
  const [first, ...rest] = t(p.name).split(' ');
  add({ system: 'harmony', table: 'harmony_program_people', ext: p.contact_id, first, last: rest.join(' '), email: p.email, phone: p.mobile_phone, keys: ['hc:' + p.contact_id, 'tn:' + nName(p.name)], teacher: true });
}
for (const p of load('retreat_guru_teachers')) {
  const [first, ...rest] = t(p.name).split(' ');
  add({ system: 'retreat_guru', table: 'retreat_guru_teachers', ext: p.teacher_id, first, last: rest.join(' '), email: p.email, phone: p.phone, keys: ['tn:' + nName(p.name)], teacher: true });
}

// ---------- 2. Merge duplicates (union-find over shared keys) ----------
const parent = recs.map((_, i) => i);
const find = i => (parent[i] === i ? i : (parent[i] = find(parent[i])));
const owner = new Map();
const canon = e => { const [l, d] = e.split('@'); return d ? l.split('+')[0].replace(/\./g, '') : ''; };
recs.forEach((r, i) => {
  const email = nEmail(r.email), local = canon(email), phone = nPhone(r.phone), c = city(r.city);
  const first = nName(t(r.first).split(' ')[0]), last = nName(r.last);
  const nk = first && last ? [first, last].sort().join('|') : ''; // order-free, so "Ho Huong" = "Huong Ho"
  if (email) r.keys.push('e:' + local + '@' + email.split('@')[1]);
  if (local && nk) {
    r.keys.push('l:' + local + '|' + nk); // same inbox name, different domain, dots or +tag
    if (/\d$/.test(local)) r.keys.push('l:' + local.slice(0, -1) + '|' + nk); // one extra digit typed
  }
  if (phone && nk) r.keys.push('p:' + phone + '|' + nk);
  if (c && c !== 'Online' && nk) r.keys.push('n:' + nk + '|' + c);
  for (const k of r.keys) { if (owner.has(k)) parent[find(i)] = find(owner.get(k)); else owner.set(k, i); }
});
const clusters = new Map();
recs.forEach((r, i) => { const c = find(i); if (!clusters.has(c)) clusters.set(c, []); clusters.get(c).push(r); });

// ---------- 3. Score against the answer key (never used for merging) ----------
const truth = new Map(load('_identity_ground_truth').map(g => [g.source_table + ':' + g.external_id, g.true_person_id]));
const pairs = n => (n * (n - 1)) / 2;
const predSize = new Map(), trueSize = new Map(), both = new Map();
recs.forEach((r, i) => {
  const tid = truth.get(r.table + ':' + r.ext); if (!tid) return;
  const c = find(i);
  predSize.set(c, (predSize.get(c) || 0) + 1); trueSize.set(tid, (trueSize.get(tid) || 0) + 1);
  both.set(c + '|' + tid, (both.get(c + '|' + tid) || 0) + 1);
});
const sum = m => [...m.values()].reduce((s, n) => s + pairs(n), 0);
const tp = sum(both), precision = tp / sum(predSize), recall = tp / sum(trueSize);

// ---------- 4. Build rows ----------
const SKILLS = ['Registration desk', 'Setup & logistics', 'Kitchen seva', 'Photography', 'Social media', 'Music & bhajans', 'Tech & AV', 'Greeting & hospitality', 'Kids activities', 'Translation', 'Driving', 'Decor'];
const SLOTS = [['18:00', '21:30'], ['09:00', '13:00'], ['13:00', '18:00'], ['10:00', '16:00']];
const pick = (seed, list, n) => { const h = hash(seed), out = []; for (let i = 0; out.length < n && i < 32; i++) { const v = list[h[i] % list.length]; if (!out.includes(v)) out.push(v); } return out; };

const people = [], sources = [], vols = [], avail = [], personOf = new Map();
for (const group of clusters.values()) {
  const id = randomUUID(), courses = group.map(r => r.course).filter(Boolean).sort((a, b) => b.date.localeCompare(a.date));
  const c = mode(group.map(r => city(r.city)).filter(x => x && x !== 'Online'));
  const p = { id, origin: 'seed', full_name: `${niceCase(group.map(r => t(r.first)))} ${niceCase(group.map(r => t(r.last)))}`.trim(),
    email: mode(group.map(r => nEmail(r.email))), phone: mode(group.map(r => t(r.phone))), city: c, timezone: tzFor(c),
    is_volunteer: group.some(r => r.volunteer), is_teacher: group.some(r => r.teacher),
    last_course: courses[0]?.name ?? null, last_course_date: courses[0]?.date ?? null, courses_count: courses.length };
  people.push(p);
  for (const r of group) { sources.push({ person_id: id, source_system: r.system, source_table: r.table, external_id: r.ext }); personOf.set(r.table + ':' + r.ext, id); }
  if (p.is_volunteer) {
    const h = hash(p.email || id);
    vols.push({ person_id: id, skills: pick(id + 'skills', SKILLS, 2 + (h[0] % 3)), emergency_seva: h[1] % 3 === 0, is_simulated: true });
    for (const [i, day] of pick(id + 'days', [0, 1, 2, 3, 4, 5, 6], 1 + (h[2] % 3)).entries()) {
      const [s, e] = SLOTS[h[3 + i] % SLOTS.length];
      avail.push({ person_id: id, day_of_week: day, start_time: s, end_time: e, timezone: p.timezone, is_simulated: true });
    }
  }
}

const status = s => ({ live: 'scheduled', open: 'scheduled', scheduled: 'scheduled', canceled: 'cancelled', cancelled: 'cancelled' })[s.toLowerCase()] || 'completed';
const needs = key => { const h = hash(key); return { required_skills: pick(key, SKILLS, 2 + (h[0] % 2)), volunteers_needed: 3 + (h[1] % 6), is_simulated_needs: true }; };
const ebVenues = new Map(load('eventbrite_venues').map(v => [v.venue_id, v]));
const rgVenues = new Map(load('retreat_guru_venues').map(v => [v.venue_id, v]));
const hOrganizer = new Map();
for (const p of hPeople) if (p.role === 'Organizer' || (p.role === 'Teacher' && !hOrganizer.has(p.program_source_record_id))) hOrganizer.set(p.program_source_record_id, personOf.get('harmony_program_people:' + p.contact_id));

const events = [];
for (const e of ebEvents.values()) {
  const v = ebVenues.get(e.venue_id);
  events.push({ source_system: 'eventbrite', source_id: e.event_id, title: e.name, status: status(e.status), city: city(v?.city), venue_name: v?.name ?? null,
    starts_local: e.starts_at_local, ends_local: e.ends_at_local, timezone: e.timezone, ...needs(e.event_id) });
}
for (const p of hPrograms) {
  const sched = json(p.program_schedules) || [], c = city(p.city);
  events.push({ source_system: 'harmony', source_id: p.program_id, title: p.product_name, category: p.category, status: status(p.status), city: c, venue_name: p.center_name,
    starts_local: `${p.start_date}T${sched[0]?.start || '09:00'}`, ends_local: `${p.end_date}T${sched.at(-1)?.end || '17:00'}`, timezone: tzFor(c), schedule: sched,
    organizer_person_id: hOrganizer.get(p.source_record_id) ?? null, ...needs(p.program_id) });
}
for (const p of rgPrograms) {
  const info = json(p.program_info) || {}, v = rgVenues.get(info.venue_id), c = city(v?.city);
  events.push({ source_system: 'retreat_guru', source_id: p.program_id, title: p.name, category: (json(p.categories) || [])[0]?.name ?? null, status: status(p.status), city: c, venue_name: v?.name ?? null,
    starts_local: `${p.start_date}T09:00`, ends_local: `${p.end_date}T17:00`, timezone: tzFor(c),
    organizer_person_id: personOf.get('retreat_guru_teachers:' + (info.teachers || [])[0]) ?? null, ...needs(p.program_id) });
}
// Every row needs the same keys for a bulk insert
const EV_KEYS = ['source_system', 'source_id', 'title', 'category', 'status', 'city', 'venue_name', 'starts_local', 'ends_local', 'timezone', 'schedule', 'organizer_person_id', 'required_skills', 'volunteers_needed', 'is_simulated_needs'];
for (const [i, e] of events.entries()) events[i] = Object.fromEntries(EV_KEYS.map(k => [k, e[k] ?? null]));
const courses = load('courses').map(c => ({ name: c.course_name, mctypes: c.mctypes }));

// ---------- 5. Report ----------
const pct = x => (x * 100).toFixed(1) + '%';
console.log(`Person records loaded:     ${recs.length}`);
console.log(`Unique people after merge: ${people.length}  (answer key: 9970 + teachers)`);
console.log(`Merge accuracy:            precision ${pct(precision)}, recall ${pct(recall)}`);
console.log(`Volunteers: ${vols.length}  Teachers: ${people.filter(p => p.is_teacher).length}`);
console.log(`Events: ${events.length}  (upcoming: ${events.filter(e => e.status === 'scheduled').length})  Courses: ${courses.length}`);
console.log(`Event assignments: ${eventAssignments.length}`);
if (DRY) { console.log('\nDry run: nothing uploaded.'); process.exit(0); }

// ---------- 6. Upload ----------
async function call(path, body, prefer = 'return=minimal') {
  const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!URL_ || !KEY) throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  const headers = { apikey: KEY, 'Content-Type': 'application/json', Prefer: prefer, ...(KEY.startsWith('eyJ') ? { Authorization: `Bearer ${KEY}` } : {}) };
  const res = await fetch(`${URL_}/rest/v1/${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res;
}
async function uploadEventAssignments() {
  const response = await call('rpc/teamup_import_event_assignments', { p_assignments: eventAssignments }, 'return=representation');
  console.log(`  ✓ event_assignments: ${await response.json()} added from ${eventAssignments.length} source rows`);
}
async function insert(table, rows) {
  for (let i = 0; i < rows.length; i += 1000) await call(table, rows.slice(i, i + 1000));
  console.log(`  ✓ ${table}: ${rows.length}`);
}
console.log('\nUploading to Supabase...');
await call('rpc/reset_seed_data', {});
await insert('people', people);
await insert('person_sources', sources);
await insert('volunteer_profiles', vols);
await insert('availability', avail);
await insert('events', events);
await uploadEventAssignments();
await insert('courses', courses);
await call('rpc/relink_profiles', {});
console.log('Done.');
