const KEY = 'seedance-tracker-v1';
const STATUS = ['planned', 'prompted', 'generated', 'edited'];
const uid = () => Math.random().toString(36).slice(2, 9);
const blank = () => ({ meta: { title: '', creator: '', contest: '', tool: 'Seedance', human: '' }, scenes: [] });
let S;
try { S = JSON.parse(localStorage.getItem(KEY)) || blank(); } catch { S = blank(); }
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { alert('Could not save: browser storage is full or blocked.'); } };
const $ = s => document.querySelector(s);
const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const shots = () => S.scenes.flatMap(s => s.shots);

function stats() {
  const all = shots(), got = all.filter(x => x.file.trim()).length;
  $('#stats').textContent = `${S.scenes.length} scenes, ${all.length} shots, ${got} linked to a downloaded file` + (all.length - got ? `, ${all.length - got} still missing a filename` : '');
}

function shotHtml(sh, i, j) {
  return `<div class="shot st-${sh.status}" data-i="${i}" data-j="${j}">
  <div class="shot-head">
    <input data-k="title" value="${esc(sh.title)}" placeholder="Shot name (e.g. scene 3, take 2)" aria-label="Shot name">
    <select data-k="status" aria-label="Status">${STATUS.map(s => `<option ${s === sh.status ? 'selected' : ''}>${s}</option>`).join('')}</select>
    <button data-act="delShot">Delete</button>
  </div>
  <div class="cols">
    <label>Visual prompt<textarea data-k="visual" rows="4">${esc(sh.visual)}</textarea></label>
    <label>Motion prompt<textarea data-k="motion" rows="4">${esc(sh.motion)}</textarea></label>
    <label>Audio prompt<textarea data-k="audio" rows="4">${esc(sh.audio)}</textarea></label>
  </div>
  <label>Downloaded filename${sh.file.trim() ? '' : ' <span class="nofile">not linked yet</span>'}<input class="file" data-k="file" value="${esc(sh.file)}" placeholder="scene_03_take_02.mp4"></label>
  <label>Notes<input data-k="notes" value="${esc(sh.notes)}"></label>
  </div>`;
}

function render() {
  document.querySelectorAll('[data-meta]').forEach(el => el.value = S.meta[el.dataset.meta] || '');
  $('#scenes').innerHTML = S.scenes.length ? S.scenes.map((sc, i) => `<section class="scene" data-i="${i}">
    <div class="scene-head">
      <input data-s="title" value="${esc(sc.title)}" placeholder="Scene ${i + 1} title" aria-label="Scene title">
      <button data-act="up" aria-label="Move scene up">Up</button><button data-act="down" aria-label="Move scene down">Down</button>
      <button data-act="delScene">Delete</button>
    </div>
    <label>Scene summary<textarea data-s="summary" rows="2">${esc(sc.summary)}</textarea></label>
    ${sc.shots.map((sh, j) => shotHtml(sh, i, j)).join('')}
    <p><button data-act="addShot">Add shot</button></p>
  </section>`).join('') : '<p class="empty">No scenes yet. Add your first scene to start planning the film.</p>';
  stats();
}

document.addEventListener('input', e => {
  const t = e.target;
  if (t.dataset.meta) S.meta[t.dataset.meta] = t.value;
  else if (t.dataset.s) S.scenes[t.closest('.scene').dataset.i][t.dataset.s] = t.value;
  else if (t.dataset.k) {
    const c = t.closest('.shot'); S.scenes[c.dataset.i].shots[c.dataset.j][t.dataset.k] = t.value;
    if (t.dataset.k === 'status') c.className = 'shot st-' + t.value;
  } else return;
  save(); stats();
});
document.addEventListener('change', e => { if (e.target.dataset.k === 'file') render(); });

document.addEventListener('click', e => {
  const a = e.target.dataset.act; if (!a) return;
  const sc = e.target.closest('.scene'), i = sc && +sc.dataset.i, c = e.target.closest('.shot'), j = c && +c.dataset.j;
  if (a === 'addShot') S.scenes[i].shots.push({ id: uid(), title: `Shot ${S.scenes[i].shots.length + 1}`, status: 'planned', visual: '', motion: '', audio: '', file: '', notes: '' });
  if (a === 'delShot' && confirm('Delete this shot and its prompts?')) S.scenes[i].shots.splice(j, 1);
  if (a === 'delScene' && confirm('Delete this scene and all its shots?')) S.scenes.splice(i, 1);
  if (a === 'up' && i > 0) [S.scenes[i - 1], S.scenes[i]] = [S.scenes[i], S.scenes[i - 1]];
  if (a === 'down' && i < S.scenes.length - 1) [S.scenes[i + 1], S.scenes[i]] = [S.scenes[i], S.scenes[i + 1]];
  save(); render();
});
$('#addScene').onclick = () => { S.scenes.push({ id: uid(), title: '', summary: '', shots: [] }); save(); render(); };

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
      [['Visual', sh.visual], ['Motion', sh.motion], ['Audio', sh.audio]].forEach(([n, v]) => v && L.push(`    ${n} prompt: ${v}`));
    });
    L.push('');
  });
  return L.join('\n');
}
$('#exportTxt').onclick = () => dl(disclosure(), 'ai-disclosure.txt', 'text/plain');
$('#exportPdf').onclick = () => { $('#printArea').innerHTML = `<pre>${esc(disclosure())}</pre>`; window.print(); };
$('#backup').onclick = () => dl(JSON.stringify(S, null, 2), 'seedance-tracker-backup.json', 'application/json');
$('#restore').onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => { const d = JSON.parse(t); if (!d.scenes || !d.meta) throw 0; S = d; save(); render(); }).catch(() => alert('That file is not a valid tracker backup.'));
};
function dl(text, name, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
