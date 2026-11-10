// The class page (view only). The link is https://myglck.github.io/c/#KEY. The data is what the faculty and the Class
// Teacher published (PublicPage.gs), fetched without any Google sign-in, so a browser signed in to several Google accounts
// still opens it. Everything is shown as text (esc); nothing from the data becomes HTML or script.
'use strict';
// Keep the same address as pwa/index.html.
const APP_URL = 'https://script.google.com/macros/s/AKfycbzfFLI2q79URWbBB2annmTCSr50Jc3dA8zTMss1hODTpRg4u5ukDri7m-wZx3_i6Mj6Ng/exec';
const DEV = location.hostname === 'localhost', qs = new URLSearchParams(location.search);
const API = DEV && /^http:\/\/localhost:\d+\/$/.test(qs.get('api') || '') ? qs.get('api') : APP_URL;
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const day = iso => { const m = String(iso || '').match(/^(\d{4})-(\d\d)-(\d\d)/); return m ? `${+m[3]} ${MON[m[2] - 1]} ${m[1]}` : ''; };
const when = s => {
  const m = String(s || '').match(/^(\d{4})-(\d\d)-(\d\d)[ T](\d\d):(\d\d)/);
  if (!m) return day(s);
  const h = +m[4], ap = h >= 12 ? 'pm' : 'am';
  return `${day(s)}, ${h % 12 || 12}:${m[5]} ${ap}`;
};
const num = v => (v === '' || v == null ? '—' : String(v));
const pct = v => (v === '' || v == null ? '—' : Number(v).toFixed(2).replace(/\.00$/, '') + '%');
const store = { get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} } };

// Rows below the minimum, by how far: up to 5 points, 5 to 15, more than 15.
const band = (p, thr) => { if (p === '' || p == null || !(thr > 0)) return ''; const g = thr - p; return g <= 0 ? '' : g <= 5 ? 'b1' : g <= 15 ? 'b2' : 'b3'; };
const legend = thr => `<div class="legend" aria-label="Colours"><span><i style="background:var(--b1);border:1px solid #E8B93A"></i>Up to 5% below ${esc(thr)}%</span>
  <span><i style="background:var(--b2);border:1px solid #E58B2B"></i>5% to 15% below</span><span><i style="background:var(--b3);border:1px solid #D2463A"></i>More than 15% below</span></div>`;

const key = (location.hash.slice(1) || qs.get('k') || '').trim().toUpperCase();
let D = null, tab = '', open = new Set(), meRoll = store.get('cp-roll:' + key) || '';

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
  const want = store.get('cp-tab:' + key), ids = tabIds();
  tab = ids.indexOf(want) >= 0 ? want : D.cons ? 'cons' : (ids.find(i => i !== 'cons' && D.subjects[+i].pub) || ids[0]);
  render();
}

const tabIds = () => D.subjects.map((s, i) => String(i)).concat(D.cons ? ['cons'] : []);

function render() {
  $('#title').textContent = D.cls.name || 'Class';
  $('#sub').textContent = [D.cls.programme, D.ct ? 'Class Teacher: ' + D.ct : ''].filter(Boolean).join(' · ');
  document.title = `${D.cls.name} · Class attendance · MyGLCK`;
  const tabs = D.subjects.map((s, i) => `<button role="tab" id="t${i}" aria-selected="${tab === String(i)}" class="${s.pub || s.marks ? 'has' : ''}" data-t="${i}">${esc(s.code)}<span class="dot" aria-hidden="true"></span></button>`)
    .concat(D.cons ? [`<button role="tab" id="tcons" aria-selected="${tab === 'cons'}" class="has" data-t="cons">Consolidated</button>`] : []).join('');
  $('#main').innerHTML = `<nav class="tabs" role="tablist" aria-label="Subjects">${tabs}</nav><section role="tabpanel" id="panel">${tab === 'cons' ? consHtml() : subjectHtml(D.subjects[+tab])}</section>`;
  $('#foot').hidden = false;
  $('#foot').innerHTML = `These are the figures as published by the faculty and the Class Teacher. Page updated ${esc(when(D.at))}.<br>
    Students and parents with a MyGLCK code see their own figures and raise claims in the app: <a href="../" rel="noopener">myglck.github.io</a>`;
  document.documentElement.style.setProperty('--tabs', $('.tabs').offsetHeight + 'px');
  const sel = $('.tabs [aria-selected="true"]'); if (sel) sel.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  markMe(false);
}

function subjectHtml(s) {
  const p = s.pub, hl = !D.aggregate, thr = p ? p.thr : '';
  const headCard = `<div class="card"><h2><span class="code">${esc(s.code)}${s.practical ? ' · Practical' : ''}</span>${esc(s.name)}</h2>
    <dl><dt>Faculty</dt><dd>${esc(s.faculty.join(', ') || '—')}</dd>
    ${p ? `<dt>Attendance</dt><dd>${esc(day(p.from))} to ${esc(day(p.upto))} · ${esc(p.held)} class${p.held === 1 ? '' : 'es'} held</dd>
      <dt>Minimum</dt><dd>${esc(thr)}%${s.practical ? ' (a practical, on its own)' : D.aggregate ? ' for all subjects together' : ''}</dd>
      <dt>Published</dt><dd>${esc(when(p.at))} by ${esc(p.by)}</dd>` : ''}</dl>
    ${p && p.changed ? '<p class="warn">The attendance was corrected after this was published. The faculty will publish it again.</p>' : ''}
    ${p && p.error ? '<p class="warn">This register could not be read when it was published.</p>' : ''}</div>`;
  if (!p && !s.marks) return headCard + '<div class="card empty">Not published yet.</div>';
  let att = '';
  if (p) {
    const rows = p.rows.map((r, i) => {
      const id = 's' + i, b = hl ? band(r[4], thr) : '', isOpen = open.has(id);
      const det = `<tr class="det" id="d-${id}"${isOpen ? '' : ' hidden'}><td></td><td colspan="4">
        <div class="facts"><div><span>Present</span><b>${num(r[5])}</b></div><div><span>Late</span><b>${num(r[6])}</b></div>
        <div><span>Lates counted absent</span><b>${num(r[7])}</b></div><div><span>Approved claims</span><b>${num(r[8])}</b></div><div><span>Absent</span><b>${num(r[9])}</b></div></div>
        <div class="dates"><b>Absent in ${esc(p.label)}</b>${r[10].length ? r[10].map(a => `<span class="chip${a[2] ? ' c' : ''}">${esc(a[0])} · ${esc(a[1])}${a[2] ? ' · claim approved' : ''}</span>`).join('') : '<span class="note">None</span>'}</div></td></tr>`;
      return `<tr class="${b}" data-roll="${esc(r[0])}"><td class="roll">${esc(r[0])}</td><td class="nm"><button class="rb" data-o="${id}" aria-expanded="${isOpen}" aria-controls="d-${id}">${esc(r[1])}</button></td>
        <td class="n">${num(r[2])}</td><td class="n">${num(r[3])}</td><td class="n pc">${pct(r[4])}</td></tr>${det}`;
    }).join('');
    att = `<div class="card"><h3>Attendance</h3>${hl ? legend(thr) : `<p class="note" style="margin:0 0 10px">For LL.M. the minimum (${esc(thr)}%) is for all subjects together: see Consolidated.</p>`}
      ${findHtml()}
      <table>${COLS}<thead><tr><th class="roll">Roll</th><th>Name</th><th class="n">Present</th><th class="n">Absent</th><th class="n">%</th></tr></thead><tbody>${rows}</tbody></table>
      <p class="note">Present includes approved claims. Absent includes lates counted as absent. Tap a name for the details and the absent dates.</p></div>`;
  }
  return headCard + att + (s.marks ? marksHtml(s.marks) : '');
}

function marksHtml(m) {
  // Up to three mark columns fit a phone; with more, the table shows the total and a tap shows each part.
  const compact = !!m.total && m.parts.length + 1 > 3, cols = compact ? [] : m.parts;
  const head = cols.map(p => `<th class="n mh">${esc(p.label)}<br>/${esc(p.max)}</th>`).join('') + (m.total ? `<th class="n mh">Total<br>/${esc(m.total.max)}</th>` : '');
  const rows = m.rows.map((r, i) => {
    const id = 'm' + i, isOpen = open.has(id);
    const name = compact ? `<button class="rb" data-o="${id}" aria-expanded="${isOpen}" aria-controls="d-${id}">${esc(r[1])}</button>` : esc(r[1]);
    const det = compact ? `<tr class="det" id="d-${id}"${isOpen ? '' : ' hidden'}><td></td><td colspan="2"><ul class="subs">${m.parts.map((p, j) => `<li><span>${esc(p.label)}</span><span class="v"><b>${num(r[2][j])}</b> / ${esc(p.max)}</span></li>`).join('')}</ul></td></tr>` : '';
    return `<tr data-roll="${esc(r[0])}"><td class="roll">${esc(r[0])}</td><td class="nm">${name}</td>${cols.map((p, j) => `<td class="n">${num(r[2][j])}</td>`).join('')}${m.total ? `<td class="n pc">${num(r[3])}</td>` : ''}</tr>${det}`;
  }).join('');
  const colg = `<colgroup><col class="c-roll"><col>${cols.map(() => '<col class="c-m">').join('')}${m.total ? '<col class="c-m">' : ''}</colgroup>`;
  return `<div class="card"><h3>Internal marks</h3><dl style="margin-top:0"><dt>Shown</dt><dd>${esc(when(m.at))}${m.by ? ' by ' + esc(m.by) : ''}</dd></dl>
    <table style="margin-top:10px">${colg}<thead><tr><th class="roll">Roll</th><th>Name</th>${head}</tr></thead><tbody>${rows}</tbody></table>
    ${compact ? '<p class="note">Tap a name for each part.</p>' : ''}
    ${m.total && m.total.attMax ? `<p class="note">The total includes up to ${esc(m.total.attMax)} marks for attendance.</p>` : ''}
    ${m.practical && m.total ? '<p class="note">A practical is passed on four conditions together, not on the total alone. Each student sees their own conditions in the MyGLCK app.</p>' : ''}
    <p class="note">Only the parts the faculty has shown are listed. A dash means no mark is entered yet.</p></div>`;
}

function consHtml() {
  const c = D.cons, thr = c.thr;
  const rows = c.rows.map((r, i) => {
    const id = 'c' + i, b = band(r[4], thr), isOpen = open.has(id);
    const subs = c.subjects.map((s, j) => { const v = r[5][j]; return `<li><span><b>${esc(s[0])}</b> <small>${esc(s[1])}</small></span><span class="v">${v ? `${esc(v[0])} present · ${esc(v[1])} absent · <b>${pct(v[2])}</b>` : '<small>no class held</small>'}</span></li>`; }).join('');
    return `<tr class="${b}" data-roll="${esc(r[0])}"><td class="roll">${esc(r[0])}</td><td class="nm"><button class="rb" data-o="${id}" aria-expanded="${isOpen}" aria-controls="d-${id}">${esc(r[1])}</button></td>
      <td class="n">${num(r[2])}</td><td class="n">${num(r[3])}</td><td class="n pc">${pct(r[4])}</td></tr>
      <tr class="det" id="d-${id}"${isOpen ? '' : ' hidden'}><td></td><td colspan="4"><ul class="subs st">${subs}</ul></td></tr>`;
  }).join('');
  return `<div class="card"><h2><span class="code">Consolidated</span>All subjects together</h2>
    <dl><dt>Class Teacher</dt><dd>${esc(c.by)}</dd><dt>Attendance</dt><dd>to ${esc(day(c.upto))} (${esc(c.label)})</dd><dt>Minimum</dt><dd>${esc(thr)}%</dd><dt>Published</dt><dd>${esc(when(c.at))}</dd></dl>
    ${c.changed ? '<p class="warn">The attendance was corrected after this was published. The Class Teacher will publish it again.</p>' : ''}</div>
    <div class="card"><h3>Every subject together</h3>${legend(thr)}${findHtml()}
    <table>${COLS}<thead><tr><th class="roll">Roll</th><th>Name</th><th class="n">Present</th><th class="n">Absent</th><th class="n">%</th></tr></thead><tbody>${rows}</tbody></table>
    <p class="note">The totals of every subject. Tap a name for each subject's present, absent and %.</p></div>`;
}

const COLS = '<colgroup><col class="c-roll"><col><col class="c-n"><col class="c-n"><col class="c-p"></colgroup>';
const findHtml = () => `<div class="find"><input id="find" inputmode="text" autocomplete="off" placeholder="Find your roll number" aria-label="Find your roll number" value="${esc(meRoll)}"><span id="found"></span></div>`;

function markMe(scroll) {
  document.querySelectorAll('tr.me').forEach(t => t.classList.remove('me'));
  const f = $('#found'); if (f) f.textContent = '';
  if (!meRoll) return;
  const rows = [...document.querySelectorAll('tr[data-roll]')].filter(t => t.dataset.roll.toUpperCase() === meRoll.toUpperCase());
  rows.forEach(t => t.classList.add('me'));
  if (f) f.textContent = rows.length ? '' : 'Not in this list';
  if (scroll && rows[0]) rows[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
}

document.addEventListener('click', e => {
  const t = e.target.closest('[data-t]');
  if (t) { tab = t.dataset.t; store.set('cp-tab:' + key, tab); open = new Set(); render(); window.scrollTo({ top: 0 }); return; }
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
window.addEventListener('hashchange', () => location.reload());
load();
