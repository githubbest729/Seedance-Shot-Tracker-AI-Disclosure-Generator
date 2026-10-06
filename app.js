const KEY = 'seedance-tracker-v1';
const STATUS = ['planned', 'prompted', 'generated', 'edited'];
const uid = () => Math.random().toString(36).slice(2, 9);
const blank = () => ({ meta: { title: '', creator: '', contest: '', tool: 'Seedance', human: '' }, scenes: [] });
let S = blank(), dbp, timer, fade, pending = false;
const LIM = 1000;
const idb = () => new Promise((res, rej) => {
  const r = indexedDB.open('seedance-tracker', 1);
  r.onupgradeneeded = () => r.result.createObjectStore('kv');
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});
const tx = async (mode, fn) => {
  const db = await (dbp ||= idb());
  return new Promise((res, rej) => {
    const t = db.transaction('kv', mode), rq = fn(t.objectStore('kv'));
    t.oncomplete = () => res(rq && rq.result);
    t.onerror = t.onabort = () => rej(t.error);
  });
};
async function init() {
  try {
    let d = await tx('readonly', st => st.get('project'));
    if (!d) { // one-time migration from localStorage
      const old = localStorage.getItem(KEY);
      if (old) { d = JSON.parse(old); await tx('readwrite', st => st.put(d, 'project')); localStorage.removeItem(KEY); }
    }
    if (d) S = d;
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) { showSave('Storage unavailable. Use Backup often.', true); }
}
function showSave(msg, err) {
  const el = $('#saveState'); el.textContent = msg;
  el.classList.toggle('err', !!err); el.classList.add('show');
  clearTimeout(fade); if (!err) fade = setTimeout(() => el.classList.remove('show'), 3000);
}
async function flush() {
  clearTimeout(timer); pending = false;
  try {
    await tx('readwrite', st => st.put(S, 'project'));
    showSave(`Changes saved locally at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`);
  } catch (e) { showSave('Save failed. Use Backup now.', true); }
}
const save = () => { pending = true; clearTimeout(timer); timer = setTimeout(flush, 400); };
const missing = new Set();
// Never returns null: a missing element yields a detached stand-in, so one absent id can't halt the app.
const $ = s => document.querySelector(s) || (missing.has(s) || (missing.add(s), console.warn('Missing element:', s)), document.createElement('div'));
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shots = () => S.scenes.flatMap(s => s.shots);

const W = { planned: 0, prompted: 25, generated: 75, edited: 100 };
function stats() {
  const all = shots(), got = all.filter(x => x.file.trim()).length;
  const pct = all.length ? Math.round(all.reduce((n, x) => n + (W[x.status] || 0), 0) / all.length) : 0;
  $('#bar').style.width = pct + '%';
  $('.progress').setAttribute('aria-valuenow', pct);
  $('#stats').textContent = `${pct}% complete. ${S.scenes.length} scenes, ${all.length} shots, ${got} linked to a file` + (all.length - got ? `, ${all.length - got} missing a filename` : '');
}

const promptBox = (k, label, v, ph) => { const n = (v || '').length;
  return `<label>${label}<span class="box"><textarea data-k="${k}" rows="4" placeholder="${ph}">${esc(v)}</textarea><button type="button" class="copy" data-act="copy" data-for="${k}" aria-label="Copy ${label}">Copy</button><span class="cc${n > LIM ? ' over' : ''}" data-cc="${k}">${n}/${LIM}</span></span></label>`; };
const previews = {}; // session-only blob URLs; only filenames are saved
function shotHtml(sh, i, j) {
  const miss = !sh.file.trim();
  return `<div class="shot st-${sh.status}" data-i="${i}" data-j="${j}">
  <div class="shot-head">
    <input data-k="title" value="${esc(sh.title)}" placeholder="Shot name (e.g. scene 3, take 2)" aria-label="Shot name">
    <select data-k="status" aria-label="Status">${STATUS.map(s => `<option ${s === sh.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <span class="shot-btns"><button data-act="shotUp" aria-label="Move shot up">Up</button><button data-act="shotDown" aria-label="Move shot down">Down</button><button data-act="dup">Duplicate</button><button data-act="delShot">Delete</button></span>
  </div>
  <div class="cols">
    ${promptBox('visual', 'Visual prompt', sh.visual, 'e.g., Medium shot, cinematic lighting, rain on a neon street at night')}
    ${promptBox('motion', 'Motion prompt', sh.motion, 'e.g., Slow dolly in, subtle handheld sway, character turns to camera')}
    ${promptBox('audio', 'Audio prompt', sh.audio, 'e.g., Distant thunder, soft synth pad, whispered dialogue')}
  </div>
  <label>Reference assets (up to 12: images, video, audio)<input data-k="refs" value="${esc(sh.refs)}" placeholder="e.g., hero_front.png, street_ref.mp4, theme_temp.wav"></label>
  <label>Downloaded filename <span class="nofile" ${miss ? '' : 'hidden'}>not linked yet</span><input class="file${miss ? ' missing' : ''}" data-k="file" value="${esc(sh.file)}" placeholder="scene_03_take_02.mp4"></label>
  <div class="drop">Drop the .mp4 here to link it and preview it.
    <button data-act="pick">Choose file</button><input type="file" accept="video/*" data-pick hidden></div>
  ${previews[sh.id] ? `<video controls preload="metadata" src="${previews[sh.id]}"></video>` : ''}
  <label>Notes<input data-k="notes" value="${esc(sh.notes)}"></label>
  </div>`;
}

const view = { filter: 'all', q: '' };
const has = (v, q) => (v || '').toLowerCase().includes(q);
const sceneHit = sc => view.q && (has(sc.title, view.q) || has(sc.summary, view.q));
const shotHit = sh => ['title', 'visual', 'motion', 'audio', 'refs', 'file', 'notes'].some(k => has(sh[k], view.q));
const visShots = sc => sc.shots.map((sh, j) => [sh, j]).filter(([sh]) =>
  (view.filter === 'all' || (view.filter === 'missing' ? !sh.file.trim() : sh.status === view.filter)) &&
  (!view.q || sceneHit(sc) || shotHit(sh)));
function resetView() { view.filter = 'all'; view.q = ''; $('#filter').value = 'all'; $('#search').value = ''; }

function render() {
  document.querySelectorAll('[data-meta]').forEach(el => el.value = S.meta[el.dataset.meta] || '');
  const active = view.filter !== 'all' || view.q;
  const html = S.scenes.map((sc, i) => {
    const vis = visShots(sc);
    if (active && !vis.length && !(view.filter === 'all' && sceneHit(sc))) return '';
    const open = !sc.collapsed || active, miss = sc.shots.filter(x => !x.file.trim()).length;
    return `<section class="scene${open ? '' : ' collapsed'}" data-i="${i}">
    <div class="scene-head">
      <button data-act="fold" aria-expanded="${open}" aria-label="${open ? 'Collapse' : 'Expand'} scene">${open ? '▾' : '▸'}</button>
      <input data-s="title" value="${esc(sc.title)}" placeholder="Scene ${i + 1} title" aria-label="Scene title">
      ${open ? '' : `<span class="count">${sc.shots.length} shots${miss ? `, ${miss} unlinked` : ''}</span>`}
      <button data-act="up" aria-label="Move scene up">Up</button><button data-act="down" aria-label="Move scene down">Down</button>
      <button data-act="delScene">Delete</button>
    </div>
    ${open ? `<label>Scene summary<textarea data-s="summary" rows="2">${esc(sc.summary)}</textarea></label>
    ${vis.map(([sh, j]) => shotHtml(sh, i, j)).join('')}
    <p><button data-act="addShot">Add shot</button></p>` : ''}
  </section>`; }).join('');
  $('#scenes').innerHTML = S.scenes.length ? (html || '<p class="empty">No shots match the current filter or search.</p>') : '<p class="empty">No scenes yet. Add your first scene to start planning the film.</p>';
  $('#foldAll').textContent = S.scenes.some(s => !s.collapsed) ? 'Collapse all scenes' : 'Expand all scenes';
  stats();
}

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.meta) S.meta[t.dataset.meta] = t.value;
  else if (t.dataset.s) S.scenes[t.closest('.scene').dataset.i][t.dataset.s] = t.value;
  else if (t.dataset.k) {
    const c = t.closest('.shot'); S.scenes[c.dataset.i].shots[c.dataset.j][t.dataset.k] = t.value;
    if (t.dataset.k === 'status') c.className = 'shot st-' + t.value;
    if (t.dataset.k === 'file') { const m = !t.value.trim(); t.classList.toggle('missing', m); c.querySelector('.nofile').hidden = !m; }
    const cc = c.querySelector(`[data-cc="${t.dataset.k}"]`);
    if (cc) { cc.textContent = `${t.value.length}/${LIM}`; cc.classList.toggle('over', t.value.length > LIM); }
  } else return;
  save(); stats();
});
function tip(b, msg) { b.dataset.tip = msg; b.classList.add('tipped'); clearTimeout(b._t); b._t = setTimeout(() => b.classList.remove('tipped'), 1200); }
document.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); flush(); } });
function attach(f, c) {
  if (!f) return;
  if (!(f.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(f.name))) return alert('Drop a video file such as an .mp4.');
  const sh = S.scenes[c.dataset.i].shots[c.dataset.j];
  if (previews[sh.id]) URL.revokeObjectURL(previews[sh.id]);
  previews[sh.id] = URL.createObjectURL(f);
  sh.file = f.name; save(); render();
}
document.addEventListener('change', e => { if (e.target.dataset.pick) attach(e.target.files[0], e.target.closest('.shot')); });
document.addEventListener('dragover', e => { e.preventDefault(); const c = e.target.closest && e.target.closest('.shot'); if (c) c.classList.add('drag'); });
document.addEventListener('dragleave', e => { const c = e.target.closest && e.target.closest('.shot'); if (c) c.classList.remove('drag'); });
document.addEventListener('drop', e => {
  e.preventDefault();
  const c = e.target.closest && e.target.closest('.shot');
  if (c) { c.classList.remove('drag'); attach(e.dataTransfer.files[0], c); }
});

document.addEventListener('click', e => {
  const a = e.target.dataset.act; if (!a) return;
  const sc = e.target.closest('.scene'), i = sc && +sc.dataset.i, c = e.target.closest('.shot'), j = c && +c.dataset.j;
  if (a === 'fold') S.scenes[i].collapsed = !S.scenes[i].collapsed;
  if (a === 'copy') {
    const b = e.target, v = c.querySelector(`[data-k="${b.dataset.for}"]`).value;
    (navigator.clipboard ? navigator.clipboard.writeText(v) : Promise.reject()).then(() => tip(b, 'Copied!'), () => tip(b, 'Copy failed'));
    return;
  }
  if (a === 'shotUp' && j > 0) { const L = S.scenes[i].shots; [L[j - 1], L[j]] = [L[j], L[j - 1]]; }
  if (a === 'shotDown' && j < S.scenes[i].shots.length - 1) { const L = S.scenes[i].shots; [L[j + 1], L[j]] = [L[j], L[j + 1]]; }
  if (a === 'dup') {
    resetView(); const L = S.scenes[i].shots, o = L[j];
    L.splice(j + 1, 0, { ...o, id: uid(), title: (o.title || 'Shot') + ' (copy)', status: 'planned', file: '' });
  }
  if (a === 'pick') { c.querySelector('[data-pick]').click(); return; }
  if (a === 'addShot') resetView(), S.scenes[i].shots.push({ id: uid(), title: `Shot ${S.scenes[i].shots.length + 1}`, status: 'planned', visual: '', motion: '', audio: '', refs: '', file: '', notes: '' });
  if (a === 'delShot' && confirm('Delete this shot and its prompts?')) S.scenes[i].shots.splice(j, 1);
  if (a === 'delScene' && confirm('Delete this scene and all its shots?')) S.scenes.splice(i, 1);
  if (a === 'up' && i > 0) [S.scenes[i - 1], S.scenes[i]] = [S.scenes[i], S.scenes[i - 1]];
  if (a === 'down' && i < S.scenes.length - 1) [S.scenes[i + 1], S.scenes[i]] = [S.scenes[i], S.scenes[i + 1]];
  save(); render();
});
$('#addScene').onclick = () => { S.scenes.push({ id: uid(), title: '', summary: '', shots: [] }); save(); render(); };

$('#foldAll').onclick = () => { const c = S.scenes.some(s => !s.collapsed); S.scenes.forEach(s => { s.collapsed = c; }); save(); render(); };

$('#filter').onchange = e => { view.filter = e.target.value; render(); };
let searchTimer;
$('#search').oninput = e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { view.q = e.target.value.trim().toLowerCase(); render(); }, 150); };

function csv() {
  const cell = v => { let t = String(v ?? '').replace(/\r\n?/g, '\n'); if (/^[=+\-@\t]/.test(t)) t = "'" + t; return '"' + t.replace(/"/g, '""') + '"'; };
  const rows = [['Scene Title', 'Shot Title', 'Status', 'Visual Prompt', 'Motion Prompt', 'Audio Prompt', 'Reference Assets', 'Downloaded Filename', 'Notes']];
  S.scenes.forEach(sc => sc.shots.forEach(sh => rows.push([sc.title, sh.title, sh.status, sh.visual, sh.motion, sh.audio, sh.refs, sh.file, sh.notes])));
  return '\uFEFF' + rows.map(r => r.map(cell).join(',')).join('\r\n');
}
$('#exportCsv').onclick = () => dl(csv(), 'seedance-shots.csv', 'text/csv');

function disclosure() {
  const m = S.meta, L = [];
  L.push('AI DISCLOSURE', '', `Film: ${m.title || '(untitled)'}`, `Creator: ${m.creator || '(not set)'}`, `Contest: ${m.contest || '(not set)'}`, `AI tools used: ${m.tool || '(not set)'}`, `Generated: ${new Date().toLocaleDateString()}`, '');
  if (m.human) L.push('Human contribution:', m.human, '');
  L.push('PROMPT LOG', '');
  S.scenes.forEach((sc, i) => {
    L.push(`SCENE ${i + 1}: ${sc.title || 'Untitled'}`);
    if (sc.summary) L.push(sc.summary);
    sc.shots.forEach(sh => {
      L.push('', `  ${sh.title || 'Shot'}  [file: ${sh.file || 'not linked'}]`);
      [['Visual prompt', sh.visual], ['Motion prompt', sh.motion], ['Audio prompt', sh.audio], ['Reference assets', sh.refs]].forEach(([n, v]) => v && L.push(`    ${n}: ${v}`));
    });
    L.push('');
  });
  return L.join('\n');
}
$('#exportTxt').onclick = async () => {
  const text = disclosure();
  if (navigator.share) {
    try { await navigator.share({ title: `AI Disclosure: ${S.meta.title || 'Untitled film'}`, text }); return; }
    catch (err) { if (err.name === 'AbortError') return; }
  }
  dl(text, 'ai-disclosure.txt', 'text/plain');
};
$('#exportPdf').onclick = () => { $('#printArea').innerHTML = `<pre>${esc(disclosure())}</pre>`; window.print(); };
$('#backup').onclick = async () => {
  if (pending) await flush();
  const data = (await tx('readonly', st => st.get('project'))) || S;
  dl(JSON.stringify(data, null, 2), 'seedance-tracker-backup.json', 'application/json');
};
$('#restore').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { const d = JSON.parse(t); if (!d.scenes || !d.meta) throw 0; S = d; return flush().then(render); }).catch(() => alert('That file is not a valid tracker backup.'));
};
function dl(text, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

init().then(render);
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && pending) flush(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
