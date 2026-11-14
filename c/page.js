// The class page (view only). The link is https://myglck.github.io/c/#KEY. The data is what the faculty and the Class
// Teacher published (PublicPage.gs), fetched without any Google sign-in, so a browser signed in to several Google accounts
// still opens it. Everything is shown as text (esc); nothing from the data becomes HTML or script.
// v1.29.0: opens on a list of subjects (full names, greyed until published); each subject and Consolidated by month,
// the current month first, then the whole term.
'use strict';
// Keep the same address as pwa/index.html.
const APP_URL = 'https://script.google.com/macros/s/AKfycbzfFLI2q79URWbBB2annmTCSr50Jc3dA8zTMss1hODTpRg4u5ukDri7m-wZx3_i6Mj6Ng/exec';
const DEV = location.hostname === 'localhost', qs = new URLSearchParams(location.search);
const API = DEV && /^http:\/\/localhost:\d+\/$/.test(qs.get('api') || '') ? qs.get('api') : APP_URL;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const day = iso => { const m = String(iso || '').match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? `${+m[3]} ${MON[m[2] - 1]} ${m[1]}` : ''; };
const when = s => {
  const m = String(s || '').match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/);
  if (!m) return day(s);
  const h = +m[4], ap = h >= 12 ? 'pm' : 'am';
  return `${day(s)}, ${h % 12 || 12}:${m[5]} ${ap}`;
};
const mName = ym => MONTH[+ym.slice(5, 7) - 1] || ym, mShort = ym => MON[+ym.slice(5, 7) - 1] || ym;
const num = v => (v === '' || v == null ? '—' : String(v));
const pct = v => (v === '' || v == null ? '—' : Number(v).toFixed(2).replace(/\.00$/, '') + '%');
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };
const pad = n => String(n).padStart(2, '0');
const now = new Date(), THIS = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
const nextM = ym => { const y = +ym.slice(0, 4), m = +ym.slice(5, 7); return m === 12 ? `${y + 1}-01` : `${y}-${pad(m + 1)}`; };

// Rows below the minimum, by how far: up to 5 points, 5 to 15, more than 15.
const band = (p, thr) => { if (p === '' || p == null || !(thr > 0)) return ''; const g = thr - p; return g <= 0 ? '' : g <= 5 ? 'b1' : g <= 15 ? 'b2' : 'b3'; };
const legend = thr => `<div class="legend" aria-label="Colours"><span><i style="background:var(--b1);border:1px solid #E8B93A"></i>Up to 5% below ${esc(thr)}%</span>
  <span><i style="background:var(--b2);border:1px solid #E58B2B"></i>5% to 15% below</span><span><i style="background:var(--b3);border:1px solid #D2463A"></i>More than 15% below</span></div>`;

const key = (location.hash.slice(1) || qs.get('k') || '').trim().toUpperCase();
// view: 'list', 'cons' or a subject's index; per: a month (yyyy-MM), 'term' or 'marks'
let D = null, view = 'list', per = '', open = new Set(), pushed = false, meRoll = store.get('cp-roll:' + key) || '';

function fail(text) {
  $('#title').textContent = 'Class page';
  $('#main').innerHTML = `<p class="msg">${esc(text)}</p>`;
}

async function load() {
  if (!/^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{8}$/.test(key)) return fail('This link is not complete. Please open the link exactly as it was shared.');
  try {
    const r = await fetch(API + '?pub=' + encodeURIComponent(key), { credentials: 'omit', cache: 'no-store', redirect: 'follow' });
    const d = await r.json();
    if (!d || d.error) return fail((d && d.error) || 'The page could not be opened just now. Please try again in a minute.');
    D = d;
  } catch (e) {
    return fail(navigator.onLine === false ? 'You are offline. Connect to the internet and open the link again.' : 'The page could not be opened just now. Please try again in a minute.');
  }
  D.subjects.forEach(s => { s.months = s.months || []; });
  D.consMonths = D.consMonths || [];
  const st = history.state;
  if (st && st.view != null) { view = st.view; per = st.per || ''; }
  if (view !== 'list' && view !== 'cons' && !D.subjects[+view]) view = 'list';
  if (view === 'cons' && !D.cons) view = 'list';
  render();
}

/** One subject (or Consolidated) as { pub: whole term, months: newest first, marks }. */
const unit = v => (v === 'cons' ? { pub: D.cons, months: D.consMonths, marks: null } : D.subjects[+v]);
const live = u => !!(u && (u.pub || u.marks));
/** The term's months up to now, newest first (the current month first), plus any month published. */
function termMonths(u) {
  const out = new Set();
  const start = D.term && D.term.start ? D.term.start.slice(0, 7) : '', end = D.term && D.term.end ? D.term.end.slice(0, 7) : '';
  if (start) for (let m = start; m <= THIS && (!end || m <= end); m = nextM(m)) out.add(m);
  u.months.forEach(x => out.add(x.month));
  if (u.pub && u.pub.month) out.add(u.pub.month);
  return [...out].sort().reverse();
}
const monthOf = (u, m) => u.months.find(x => x.month === m) || null;
/** Where a subject opens: its newest published month, else the whole term, else marks, else the current month. */
function firstPer(u) {
  if (u.months.length) return u.months[0].month;
  if (u.pub) return 'term';
  if (u.marks) return 'marks';
  return termMonths(u)[0] || 'term';
}

function go(v, p, push) {
  view = v; per = p || (v === 'list' ? '' : firstPer(unit(v))); open = new Set();
  const st = { view, per };
  try { push ? history.pushState(st, '') : history.replaceState(st, ''); } catch (e) {}
  render(); window.scrollTo({ top: 0 });
}

function render() {
  $('#title').textContent = D.cls.name || 'Class';
  $('#sub').textContent = [D.cls.programme, D.ct ? 'Class Teacher: ' + D.ct : ''].filter(Boolean).join(' · ');
  document.title = `${D.cls.name} · Class attendance · MyGLCK`;
  $('#main').innerHTML = view === 'list' ? listHtml() : detailHtml();
  $('#foot').hidden = false;
  $('#foot').innerHTML = `These are the figures as published by the faculty and the Class Teacher. Page updated ${esc(when(D.at))}.<br>
    Students and parents with a MyGLCK code see their own figures and raise claims in the app: <a href="../" rel="noopener">myglck.github.io</a>`;
  const bar = $('.bar'); document.documentElement.style.setProperty('--tabs', (bar ? bar.offsetHeight : 0) + 'px');
  const sel = $('.codes [aria-current="true"]'); if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  markMe(false);
}

/* ---------- The list: Consolidated first, then every subject with its full name ---------- */

/** The latest thing published for a subject: { at, what }, or null. */
function lastUpd(u) {
  const ev = (u.months || []).map(m => ({ at: m.at, what: mName(m.month) + ' published' }));
  if (u.pub && !ev.some(e => e.at === u.pub.at)) ev.push({ at: u.pub.at, what: 'Whole term to ' + mName(u.pub.month) + ' published' });
  if (u.marks && u.marks.at) ev.push({ at: u.marks.at, what: 'Internal marks shown' });
  return ev.filter(e => e.at).sort((a, b) => (a.at < b.at ? 1 : -1))[0] || null;
}
// "New" for 7 days; the times are India time (yyyy-MM-dd HH:mm).
const isNew = at => { const m = String(at).match(/^(\d{4})-(\d\d)-(\d\d)/); return !!m && (now - new Date(+m[1], m[2] - 1, +m[3])) / 864e5 < 7; };
function upto(u) { const m = u.pub && u.pub.month; return m ? 'Published to ' + mName(m) : u.marks ? 'Internal marks shown' : ''; }
function listHtml() {
  const row = (v, code, name, who, u) => {
    const on = live(u), st = on ? upto(u) : 'Not published yet', l = lastUpd(u);
    return `<li><button class="srow${on ? '' : ' off'}" data-v="${v}"><span class="sc">${esc(code)}${l && isNew(l.at) ? '<b class="new">New</b>' : ''}</span><span class="sn">${esc(name)}</span>
      ${who ? `<span class="sf">${esc(who)}</span>` : ''}<span class="ss">${on ? '<i class="ok" aria-hidden="true">✓</i>' : ''}${esc(st)}${u.pub && u.pub.changed ? ' · being corrected' : ''}</span>
      ${l ? `<span class="su">Updated ${esc(when(l.at))} · ${esc(l.what)}</span>` : ''}</button></li>`;
  };
  // The latest updates first; subjects with nothing published after them, in code order.
  const order = D.subjects.map((s, i) => ({ s, i, l: lastUpd(s) })).sort((a, b) => (a.l && b.l ? (a.l.at < b.l.at ? 1 : a.l.at > b.l.at ? -1 : a.i - b.i) : a.l ? -1 : b.l ? 1 : a.i - b.i));
  const cons = { pub: D.cons, months: D.consMonths };
  return `<div class="card">${findHtml(true)}<p class="note" style="margin:6px 0 0">Your roll number is remembered on this phone and marked in every list.</p></div>
    <h2 class="sec">All subjects together</h2>
    <ul class="slist">${row('cons', 'Consolidated', 'Every subject together' + (D.aggregate ? ' (the LL.M. minimum is on this)' : ''), D.ct ? 'Class Teacher: ' + D.ct : '', cons)}</ul>
    <h2 class="sec">Subjects</h2>
    <ul class="slist">${order.map(({ s, i }) => row(String(i), s.code + (s.practical ? ' · Practical' : ''), s.name, s.faculty.join(', '), s)).join('')}</ul>
    <p class="note">The latest updates come first. Greyed: not published yet; you can still open it.</p>`;
}

/* ---------- One subject or Consolidated ---------- */

function detailHtml() {
  const u = unit(view), isCons = view === 'cons';
  const codes = [`<button class="back" data-v="list">← All subjects</button>`]
    .concat([`<button data-v="cons" class="${D.cons ? '' : 'off'}" aria-current="${isCons}">Consolidated</button>`])
    .concat(D.subjects.map((s, i) => `<button data-v="${i}" class="${live(s) ? '' : 'off'}" aria-current="${view === String(i)}">${esc(s.code)}</button>`)).join('');
  const s = isCons ? null : u;
  const head = `<div class="card"><h2><span class="code">${isCons ? 'Consolidated' : esc(s.code) + (s.practical ? ' · Practical' : '')}</span>${isCons ? 'All subjects together' : esc(s.name)}</h2>
    <dl><dt>${isCons ? 'Class Teacher' : 'Faculty'}</dt><dd>${esc(isCons ? (D.ct || (D.cons && D.cons.by) || '—') : (s.faculty.join(', ') || '—'))}</dd>
    ${u && u.pub ? `<dt>Minimum</dt><dd>${esc(u.pub.thr)}%${!isCons && s.practical ? ' (a practical, on its own)' : !isCons && D.aggregate ? ' for all subjects together' : ''}</dd>` : ''}</dl></div>`;
  const months = termMonths(u || { months: [] });
  const chips = months.map((m, i) => {
    const has = !!monthOf(u, m) || (u.pub && u.pub.month === m && !u.months.length);
    return `<button data-p="${m}" class="${has ? '' : 'off'}${i === 0 ? ' now' : ''}" aria-pressed="${per === m}">${i === 0 ? esc(mName(m)) + (m === THIS ? '<small>this month</small>' : '<small>latest</small>') : esc(mShort(m))}</button>`;
  }).concat([`<button data-p="term" class="term${u && u.pub ? '' : ' off'}" aria-pressed="${per === 'term'}">Whole term</button>`])
    .concat(u && u.marks ? [`<button data-p="marks" aria-pressed="${per === 'marks'}">Internal marks</button>`] : []).join('');
  const body = per === 'marks' && u.marks ? marksHtml(u.marks) : per === 'term' ? termHtml(u, isCons) : monthHtml(u, per, isCons);
  return `<nav class="bar"><div class="codes" aria-label="Subjects">${codes}</div></nav>${head}
    <div class="months" role="group" aria-label="Month">${chips}</div>${body}`;
}

function notYet(u, m, isCons) {
  const who = isCons ? 'The Class Teacher' : 'The faculty', last = u && u.pub && u.pub.month;
  if (!last && !(u && u.months.length)) return `<div class="card empty"><b>Nothing is published here yet.</b><br>${who} publishes the attendance month by month. Each month appears here once it is published.</div>`;
  if (m === THIS) return `<div class="card empty"><b>${esc(mName(m))} is not over yet.</b><br>${who} publishes each month after it ends.${last ? ` The latest published is ${esc(mName(last))}.` : ''}</div>`;
  return `<div class="card empty"><b>${esc(mName(m))} is not published yet.</b><br>${who} will publish it.${last ? ` The latest published is ${esc(mName(last))}.` : ''}</div>`;
}

function monthHtml(u, m, isCons) {
  const x = monthOf(u, m);
  if (!x) {
    if (u && u.pub && u.pub.month === m) return `<div class="card empty">${esc(mName(m))} was published before months were kept one by one. See <button class="link" data-p="term">Whole term</button>.</div>`;
    return notYet(u, m, isCons);
  }
  const thr = x.thr, hl = isCons || !D.aggregate;
  const top = `<p class="sum"><b>${esc(mName(m))}</b>${x.held != null ? ` · ${esc(x.held)} class${x.held === 1 ? '' : 'es'} held` : ''}<br><small>Published ${esc(when(x.at))} by ${esc(x.by)}</small></p>
    ${x.changed ? `<p class="warn">The attendance was corrected after this was published. ${isCons ? 'The Class Teacher' : 'The faculty'} will publish it again.</p>` : ''}`;
  const rows = x.rows.map((r, i) => {
    const id = 'm' + i, b = hl ? band(r[4], thr) : '', isOpen = open.has(id);
    const det = isCons ? `<ul class="subs st">${x.subjects.map((s, j) => { const v = r[5][j]; return `<li><span><b>${esc(s[0])}</b> <small>${esc(s[1])}</small></span><span class="v">${v ? `${esc(v[0])} present · ${esc(v[1])} absent · <b>${pct(v[2])}</b>` : '<small>no class held</small>'}</span></li>`; }).join('')}</ul>`
      : `<div class="facts"><div><span>Late</span><b>${num(r[5])}</b></div></div>
        <div class="dates"><b>Absent in ${esc(mName(m))}</b>${r[6].length ? r[6].map(a => `<span class="chip${a[2] ? ' c' : ''}">${esc(a[0])} · ${esc(a[1])}${a[2] ? ' · claim approved' : ''}</span>`).join('') : '<span class="note">None</span>'}</div>`;
    return `<tr class="${b}" data-roll="${esc(r[0])}"><td class="roll">${esc(r[0])}</td><td class="nm"><button class="rb" data-o="${id}" aria-expanded="${isOpen}" aria-controls="d-${id}">Details</button></td>
      <td class="n">${num(r[2])}</td><td class="n">${num(r[3])}</td><td class="n pc">${pct(r[4])}</td></tr>
      <tr class="det" id="d-${id}"${isOpen ? '' : ' hidden'}><td></td><td colspan="4">${det}</td></tr>`;
  }).join('');
  return `<div class="card">${top}${hl ? legend(thr) : `<p class="note" style="margin:0 0 10px">For LL.M. the minimum (${esc(thr)}%) is for all subjects together: see Consolidated.</p>`}${findHtml()}
    <table>${COLS}<thead><tr><th class="roll">Roll</th><th></th><th class="n">Present</th><th class="n">Absent</th><th class="n">%</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">${esc(mName(m))} on its own. Present includes approved claims; absent includes lates counted as absent. ${isCons ? 'Tap Details for each subject.' : 'Tap Details for the absent dates.'}</p></div>`;
}

function termHtml(u, isCons) {
  const p = u && u.pub;
  if (!p) return `<div class="card empty"><b>Not published yet.</b><br>${isCons ? 'The Class Teacher' : 'The faculty'} publishes the attendance month by month.</div>`;
  const thr = p.thr, hl = isCons || !D.aggregate;
  const top = `<p class="sum"><b>Whole term</b> · ${esc(day(p.from || (D.term && D.term.start)))} to ${esc(day(p.upto))}${p.held != null ? ` · ${esc(p.held)} class${p.held === 1 ? '' : 'es'} held` : ''}<br>
    <small>Up to ${esc(p.label)}, published ${esc(when(p.at))} by ${esc(p.by)}</small></p>
    ${p.note ? `<p class="note" style="margin:0 0 10px">${esc(p.note)}</p>` : ''}
    ${p.changed ? `<p class="warn">The attendance was corrected after this was published. ${isCons ? 'The Class Teacher' : 'The faculty'} will publish it again.</p>` : ''}
    ${p.error ? '<p class="warn">This register could not be read when it was published.</p>' : ''}`;
  const rows = p.rows.map((r, i) => {
    const id = 't' + i, b = hl ? band(r[4], thr) : '', isOpen = open.has(id);
    const det = isCons ? `<ul class="subs st">${p.subjects.map((s, j) => { const v = r[5][j]; return `<li><span><b>${esc(s[0])}</b> <small>${esc(s[1])}</small></span><span class="v">${v ? `${esc(v[0])} present · ${esc(v[1])} absent · <b>${pct(v[2])}</b>` : '<small>no class held</small>'}</span></li>`; }).join('')}</ul>`
      : `<div class="facts"><div><span>Present</span><b>${num(r[5])}</b></div><div><span>Late</span><b>${num(r[6])}</b></div>
        <div><span>Lates counted absent</span><b>${num(r[7])}</b></div><div><span>Approved claims</span><b>${num(r[8])}</b></div><div><span>Absent</span><b>${num(r[9])}</b></div></div>`;
    return `<tr class="${b}" data-roll="${esc(r[0])}"><td class="roll">${esc(r[0])}</td><td class="nm"><button class="rb" data-o="${id}" aria-expanded="${isOpen}" aria-controls="d-${id}">Details</button></td>
      <td class="n">${num(r[2])}</td><td class="n">${num(r[3])}</td><td class="n pc">${pct(r[4])}</td></tr>
      <tr class="det" id="d-${id}"${isOpen ? '' : ' hidden'}><td></td><td colspan="4">${det}</td></tr>`;
  }).join('');
  return `<div class="card">${top}${hl ? legend(thr) : `<p class="note" style="margin:0 0 10px">For LL.M. the minimum (${esc(thr)}%) is for all subjects together: see Consolidated.</p>`}${findHtml()}
    <table>${COLS}<thead><tr><th class="roll">Roll</th><th></th><th class="n">Present</th><th class="n">Absent</th><th class="n">%</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">The term so far: this is the % the minimum is judged on. ${isCons ? 'Tap Details for each subject.' : 'Tap Details for the full count; each month shows its absent dates.'}</p></div>`;
}

function marksHtml(m) {
  // Up to three mark columns fit a phone; with more, the table shows the total and a tap shows each part.
  const compact = !!m.total && m.parts.length + 1 > 3, cols = compact ? [] : m.parts;
  const head = cols.map(p => `<th class="n mh">${esc(p.label)}<br>/${esc(p.max)}</th>`).join('') + (m.total ? `<th class="n mh">Total<br>/${esc(m.total.max)}</th>` : '');
  const rows = m.rows.map((r, i) => {
    const id = 'k' + i, isOpen = open.has(id);
    const name = compact ? `<button class="rb" data-o="${id}" aria-expanded="${isOpen}" aria-controls="d-${id}">Details</button>` : '';
    const det = compact ? `<tr class="det" id="d-${id}"${isOpen ? '' : ' hidden'}><td></td><td colspan="2"><ul class="subs">${m.parts.map((p, j) => `<li><span>${esc(p.label)}</span><span class="v"><b>${num(r[2][j])}</b> / ${esc(p.max)}</span></li>`).join('')}</ul></td></tr>` : '';
    return `<tr data-roll="${esc(r[0])}"><td class="roll">${esc(r[0])}</td><td class="nm">${name}</td>${cols.map((p, j) => `<td class="n">${num(r[2][j])}</td>`).join('')}${m.total ? `<td class="n pc">${num(r[3])}</td>` : ''}</tr>${det}`;
  }).join('');
  const colg = `<colgroup><col class="c-roll"><col>${cols.map(() => '<col class="c-m">').join('')}${m.total ? '<col class="c-m">' : ''}</colgroup>`;
  return `<div class="card"><p class="sum"><b>Internal marks</b><br><small>Shown ${esc(when(m.at))}${m.by ? ' by ' + esc(m.by) : ''}</small></p>${findHtml()}
    <table style="margin-top:10px">${colg}<thead><tr><th class="roll">Roll</th><th></th>${head}</tr></thead><tbody>${rows}</tbody></table>
    ${compact ? '<p class="note">Tap Details for each part.</p>' : ''}
    ${m.total && m.total.attMax ? `<p class="note">The total includes up to ${esc(m.total.attMax)} marks for attendance.</p>` : ''}
    ${m.practical && m.total ? '<p class="note">A practical is passed on four conditions together, not on the total alone. Each student sees their own conditions in the MyGLCK app.</p>' : ''}
    <p class="note">Only the parts the faculty has shown are listed. A dash means no mark is entered yet.</p></div>`;
}

const COLS = '<colgroup><col class="c-roll"><col><col class="c-n"><col class="c-n"><col class="c-p"></colgroup>';
const findHtml = big => `<div class="find"><input id="find" inputmode="text" autocomplete="off" placeholder="${big ? 'Your roll number' : 'Find your roll number'}" aria-label="Your roll number" value="${esc(meRoll)}"><span id="found"></span></div>`;

function markMe(scroll) {
  document.querySelectorAll('tr.me').forEach(t => t.classList.remove('me'));
  const f = $('#found'); if (f) f.textContent = '';
  if (!meRoll || view === 'list') return;
  const rows = [...document.querySelectorAll('tr[data-roll]')].filter(t => t.dataset.roll.toUpperCase() === meRoll.toUpperCase());
  rows.forEach(t => t.classList.add('me'));
  if (f) f.textContent = rows.length ? '' : 'Not in this list';
  if (scroll && rows[0]) rows[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
}

document.addEventListener('click', e => {
  const v = e.target.closest('[data-v]');
  if (v) {
    if (v.dataset.v === 'list' && pushed) { history.back(); return; } // the phone's Back and this button do the same
    if (view === 'list' && v.dataset.v !== 'list') pushed = true;
    go(v.dataset.v, '', view === 'list' && v.dataset.v !== 'list'); return;
  }
  const p = e.target.closest('[data-p]');
  if (p) { per = p.dataset.p; open = new Set(); try { history.replaceState({ view, per }, ''); } catch (er) {} render(); return; }
  const o = e.target.closest('[data-o]');
  if (o) {
    const id = o.dataset.o, row = document.getElementById('d-' + id), on = row.hidden;
    row.hidden = !on; o.setAttribute('aria-expanded', String(on));
    if (on) open.add(id); else open.delete(id);
  }
});
document.addEventListener('input', e => {
  if (e.target.id !== 'find') return;
  meRoll = e.target.value.trim(); store.set('cp-roll:' + key, meRoll); markMe(true);
});
window.addEventListener('popstate', e => { const st = e.state || {}; view = st.view || 'list'; if (view === 'list') pushed = false; per = st.per || ''; open = new Set(); if (D) render(); });
window.addEventListener('hashchange', () => location.reload());
load();
