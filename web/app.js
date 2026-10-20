// Salle de classe en direct : flux SSE du serveur local -> état (state.mjs) -> salle 3D en CSS.
import { apply, classKey, createState, view } from './state.mjs';

const token = new URLSearchParams(location.search).get('t') ?? '';
const st = createState();

// ---------- Préférences (navigateur seulement) ----------
const store = {
  get: (k, d) => { try { return JSON.parse(localStorage.getItem(`agentclass-${k}`) ?? 'null') ?? d; } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem(`agentclass-${k}`, JSON.stringify(v)); } catch { /* stockage bloqué */ } },
};
let lang = store.get('lang', navigator.language.startsWith('fr') ? 'fr' : 'en');
let stream = store.get('stream', false);
/** @type {string[]} classes ajoutées à la main, pour des IA pas encore branchées */
let extra = store.get('classes', ['claude|']);

// ---------- Textes FR / EN ----------
const L = {
  fr: {
    active: (n) => `${n} actif${n > 1 ? 's' : ''}`, of: (n) => `sur ${n} agents · en direct`, allClasses: 'Toutes les classes', projectsFor: (a) => `Projets vus pour ${a}`,
    noProject: 'Aucun projet vu pour l\'instant', addClass: 'Ajouter une classe', top: 'Dessus', light: 'Mode clair', dark: 'Mode sombre', theme: 'Thème', lang: 'Langue', viewL: 'Vue',
    rotL: 'Tourner à gauche', rotR: 'Tourner à droite', reset: 'Vue par défaut', prof: 'prof', idle: 'au repos', working: 'actif', main: 'agent principal',
    yours: 'Tes classes', sub: (n) => `${n} classe${n > 1 ? 's' : ''} · une par IA et par projet`, addText: 'Ajoute une classe pour une autre IA, ou pour un autre projet de la même IA.',
    pick: 'Choisir une IA', allAis: 'Toutes les IA', agents: (n) => `${n} agents`, noPlugin: 'sans plugin', allIdle: 'tous au repos',
    open: (a, p) => `Ouvrir la classe ${a}, projet ${p}`, liveTxt: (a, n) => `${a} : ${n} agents actifs.`,
    stream: 'Stream', streamTip: 'Mode stream : masque les chemins de fichiers et le nom des projets, pour filmer ou partager ton écran', streamOn: 'Mode stream : chemins et projets masqués',
    waiting: 'Plugin pas encore branché : la classe se remplira dès qu\'il le sera', empty: 'Place libre', projAlias: 'Projet', noProj: 'aucun projet',
    files: 'Fichiers touchés', noFiles: 'Rien pour l\'instant. Les fichiers lus et modifiés s\'affichent ici.', lost: 'Connexion perdue, nouvel essai…', temp: 'temporaire',
  },
  en: {
    active: (n) => `${n} active`, of: (n) => `of ${n} agents · live`, allClasses: 'All classes', projectsFor: (a) => `Projects seen for ${a}`,
    noProject: 'No project seen yet', addClass: 'Add a class', top: 'Top', light: 'Light mode', dark: 'Dark mode', theme: 'Theme', lang: 'Language', viewL: 'View',
    rotL: 'Rotate left', rotR: 'Rotate right', reset: 'Default view', prof: 'teacher', idle: 'idle', working: 'working', main: 'main agent',
    yours: 'Your classes', sub: (n) => `${n} class${n > 1 ? 'es' : ''} · one per AI and project`, addText: 'Add a class for another AI, or for another project of the same AI.',
    pick: 'Pick an AI', allAis: 'All AIs', agents: (n) => `${n} agents`, noPlugin: 'no plugin', allIdle: 'all idle',
    open: (a, p) => `Open the ${a} class, project ${p}`, liveTxt: (a, n) => `${a}: ${n} active agents.`,
    stream: 'Stream', streamTip: 'Stream mode: hides file paths and project names, for recording or sharing your screen', streamOn: 'Stream mode: paths and projects hidden',
    waiting: 'Plugin not connected yet: the class fills up as soon as it is', empty: 'Empty seat', projAlias: 'Project', noProj: 'no project',
    files: 'Files touched', noFiles: 'Nothing yet. Files read and edited show up here.', lost: 'Connection lost, retrying…', temp: 'temporary',
  },
};
const t = (k, ...a) => { const v = L[lang][k]; return typeof v === 'function' ? v(...a) : v; };
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const ICON = (n, s = 18) => `<span class="i" style="--u:url(/web/icons/${n}.svg);width:${s}px;height:${s}px" aria-hidden="true"></span>`;
const LOGO = '<svg viewBox="0 0 120 120" aria-hidden="true"><rect width="120" height="120" rx="20" fill="#2F4A3F"/><rect x="32" y="14" width="56" height="16" rx="3" fill="#F2F0E9"/><circle cx="60" cy="38" r="4" fill="#E5484D"/><rect x="22" y="46" width="20" height="20" rx="4" fill="#30A46C"/><rect x="51" y="47" width="18" height="18" rx="3" fill="none" stroke="#F2F0E9" stroke-width="2"/><rect x="78" y="46" width="20" height="20" rx="4" fill="#30A46C"/><rect x="23" y="79" width="18" height="18" rx="3" fill="none" stroke="#F2F0E9" stroke-width="2"/><rect x="50" y="78" width="20" height="20" rx="4" fill="#30A46C"/><rect x="79" y="79" width="18" height="18" rx="3" fill="none" stroke="#F2F0E9" stroke-width="2"/></svg>';

// ---------- IA connues ----------
const AIS = {
  claude: { name: 'Claude Code', short: 'Claude', body: '#D9774A', dark: '#3A1F12' },
  codex: { name: 'Codex', short: 'Codex', body: '#8FA3B3', dark: '#1D2833' },
  gemini: { name: 'Gemini CLI', short: 'Gemini', body: '#6E8FE0', dark: '#16224A' },
  cursor: { name: 'Cursor', short: 'Cursor', body: '#9C9C9C', dark: '#222222' },
  opencode: { name: 'OpenCode', short: 'OpenCode', body: '#C9B458', dark: '#2E2810' },
  aider: { name: 'Aider', short: 'Aider', body: '#7FB069', dark: '#1E2B14' },
  copilot: { name: 'GitHub Copilot', short: 'Copilot', body: '#A08BD6', dark: '#241A3D' },
};
const ai = (src) => AIS[src] ?? { name: src, short: src, body: '#9C9C9C', dark: '#222222' };

// ---------- Sprites pixel art ----------
const BODY = [
  '...BBBBBBBB...', '..BBBBBBBBBB..', '..BBBBBBBBBB..', '..BBEBBBBEBB..', 'BBBBEBBBBEBBBB',
  'BBBBBBBBBBBBBB', '..BBBBBBBBBB..', '..BBBBBBBBBB..', '..B.B....B.B..', '..B.B....B.B..',
];
const HATS = {
  beanie: ['....HHHHHH....', '...HHHHHHHH...'], cap: ['....HHHHHH....', '...HHHHHHHHHH.'],
  bow: ['...HH....HH...', '....HHHHHH....'], sprout: ['.....H..H.....', '......HH......'],
  wizard: ['......HH......', '.....HHHH.....', '....HHHHHH....'], heart: ['.....H.H......', '.....HHH......', '......H.......'],
  flower: ['......H.......', '.....HWH......', '......H.......'], phones: ['...HHHHHHHH...', '..H........H..'],
  tuft: ['.......HH.....', '......HH......'],
};
const HAT_KEYS = ['beanie', 'sprout', 'bow', 'cap', 'phones', 'wizard', 'flower', 'heart'];
const HAT_COLORS = ['#2F6FD6', '#3E9B4F', '#B04FC8', '#E3A72F', '#EDEDED', '#D64545', '#1E9A8A', '#E0569A', '#BFC5C9', '#2FB4D6', '#C83A3A', '#3B5FC8'];
const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
/** Accessoire stable pour un agent donné */
const look = (id) => { const h = hash(id); return { hat: HAT_KEYS[h % HAT_KEYS.length], hatColor: HAT_COLORS[(h >>> 3) % HAT_COLORS.length] }; };

function sprite({ hat, hatColor, awake, src, glasses }) {
  const pal = ai(src);
  const hatRows = hat ? HATS[hat] : [];
  const pad = 3 - hatRows.length;
  const rows = [...Array(pad).fill('..............'), ...hatRows, ...BODY];
  let r = '';
  rows.forEach((row, y) => [...row].forEach((c, x) => {
    if (c === '.') return;
    if (c === 'E') {
      if (awake) r += `<rect class="eye" x="${x}" y="${y}" width="1" height="1" fill="${pal.dark}"/>`;
      else r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${pal.body}"/>` + (rows[y + 1]?.[x] === 'E' ? '' : `<rect x="${x}" y="${y + .45}" width="1" height=".35" fill="${pal.dark}"/>`);
      return;
    }
    r += `<rect x="${x}" y="${y}" width="1" height="1" fill="${c === 'B' ? pal.body : c === 'H' ? hatColor : c === 'W' ? '#FFF6D8' : pal.dark}"/>`;
  }));
  r += `<rect x="2" y="${pad + hatRows.length + 7}" width="10" height="1" fill="${pal.dark}" opacity=".18"/>`;
  if (glasses) {
    const y = pad + hatRows.length + 3;
    r += `<rect x="3" y="${y - .2}" width="3" height="2.4" fill="none" stroke="#24563A" stroke-width=".4"/><rect x="8" y="${y - .2}" width="3" height="2.4" fill="none" stroke="#24563A" stroke-width=".4"/><rect x="6" y="${y + .6}" width="2" height=".35" fill="#24563A"/>`;
  }
  return `<svg viewBox="0 0 14 ${rows.length}" aria-hidden="true">${r}</svg>`;
}

// ---------- Affichage des noms (mode stream) ----------
const baseName = (p) => (p ? p.replace(/\\/g, '/').split('/').filter(Boolean).pop() ?? p : '');
const showFile = (f) => (stream ? baseName(f) : f);
const showProj = (p) => {
  if (!p) return t('noProj');
  if (!stream) return baseName(p);
  const all = [...new Set(allKeys().map((k) => k.split('|')[1]).filter(Boolean))];
  return `${t('projAlias')} ${String.fromCharCode(65 + Math.max(0, all.indexOf(p)))}`;
};
const showTask = (task) => (stream ? task : task);
const clock = (ms) => { const s = Math.max(0, Math.floor(ms / 1000)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

// ---------- Classes ----------
const WALLS = ['#2C4A3E', '#2E3E4C', '#4A3242', '#4A4030', '#33424A'];
const wallOf = (p) => WALLS[hash(p || '-') % WALLS.length];
/** Toutes les classes : vues dans les événements + ajoutées à la main */
function allKeys() {
  const seen = [...st.classes.values()].sort((a, b) => b.lastAt - a.lastAt).map((c) => c.key);
  // Une classe ajoutée à la main sans projet disparaît dès qu'une vraie classe de la même IA existe
  const manual = extra.filter((k) => !seen.includes(k) && !(k.endsWith('|') && seen.some((s) => s.startsWith(k))));
  return [...seen, ...manual];
}

// ---------- Salle ----------
const DESK = { w: 120, d: 50, gap: 50, row: 100, top: 250, W: 780 };
/** Tables centrées, 4 au plus par rangée, rangées équilibrées ; la salle s'allonge si besoin. */
function layout(n) {
  const rows = Math.max(1, Math.ceil(n / 4));
  const D = Math.max(640, DESK.top + rows * DESK.row + 70);
  const area = D - 60 - DESK.top, block = (rows - 1) * DESK.row + DESK.d;
  const y0 = DESK.top + 18 + Math.max(0, (area - block) / 2);
  const out = [];
  for (let r = 0, left = n; r < rows; r++) {
    const k = Math.ceil(left / (rows - r));
    left -= k;
    const x0 = (DESK.W - (k * DESK.w + (k - 1) * DESK.gap)) / 2;
    for (let j = 0; j < k; j++) out.push({ x: x0 + j * (DESK.w + DESK.gap), y: y0 + r * DESK.row });
  }
  return { D, seats: out };
}
const box = (x, y, w, d, h, extra = '', inner = '') =>
  `<div class="contact" style="left:${x - 3}px;top:${y + d - 4}px;width:${w + 8}px;height:10px"></div>` +
  `<div class="box ${extra}" style="left:${x}px;top:${y}px;width:${w}px;height:${d}px;--h:${h}px"><i class="fn"></i><i class="fw"></i><i class="fs"></i><i class="fe"></i><i class="t"></i>${inner}</div>`;
const zzz = '<span class="zzz" aria-hidden="true"><span>Z</span><span>z</span><span>z</span></span>';

/** Contenu d'un élève (bouton, bulle, sprite) : recalculé à chaque mise à jour */
function kidInner(d, src, now) {
  const name = d.label[lang], job = d.job[lang];
  const extraJob = job !== name ? ` · ${job}` : '';
  const over = d.awake
    ? `<span class="bubble ${d.loop ? 'loop' : ''}">${d.loop ? '↻ ' : ''}${esc(showTask(d.task) || job)}<span class="t">${clock(now - d.since)}</span></span>`
    : zzz;
  return `<button aria-label="${esc(name + extraJob)}, ${d.awake ? t('working') : t('idle')}${d.temp ? ', ' + t('temp') : ''}" title="${esc(name + extraJob)}">${over}${sprite({ ...look(d.key.replace(/^tmp:/, '') + (d.temp ? d.id : '')), awake: d.awake, src })}</button>`;
}
function profInner(v) {
  const p = v.prof;
  const over = p.awake && p.task ? `<span class="bubble">${esc(p.task)}</span>` : p.awake ? '' : zzz;
  return `<button aria-label="${esc(ai(v.source).short)}, ${t('main')}, ${p.awake ? t('working') : t('idle')}">${sprite({ hat: 'tuft', hatColor: ai(v.source).dark, awake: p.awake, src: v.source, glasses: true })}${over}</button>`;
}
function boardInner(v) {
  if (!v.files.length) return `<h4>${t('files')}</h4><p class="empty">${t('noFiles')}</p>`;
  const now = Date.now();
  return `<h4>${t('files')}</h4><ul>${v.files.map((f) => `<li class="${now - f.at < 4000 ? 'fresh' : ''}"><span class="mk ${f.state}" aria-hidden="true"></span>${esc(showFile(f.path))}</li>`).join('')}</ul>`;
}

function roomHTML(v, now) {
  let h = `<div class="floor"></div>
  <div class="plinth n"></div><div class="plinth s"></div><div class="plinth e"></div><div class="plinth w"></div>
  <div class="wall n" data-wall="n"><div class="wall-slot"><div class="board" id="board">${boardInner(v)}</div></div></div>
  <div class="wall w" data-wall="w"><div class="wall-slot"><div class="window" style="left:120px"><i></i><i></i><i></i><i></i></div><div class="window" style="left:400px"><i></i><i></i><i></i><i></i></div></div></div>
  <div class="wall e" data-wall="e"><div class="wall-slot"><div class="clock" style="left:290px"></div><div class="shelf" style="left:80px">${['#3E9B4F', '#2F6FD6', '#D64545', '#E3A72F', '#B04FC8', '#1E9A8A', '#E3A72F'].map((col, i) => `<b style="--c:${col};--h:${38 + (i * 7) % 18}px"></b>`).join('')}</div></div></div>
  <div class="wall s" data-wall="s"><div class="wall-slot"><div class="door" style="left:600px"></div></div></div>
  <div class="layer">`;
  h += box(445, 70, 50, 34, 30, 'chair');
  h += `<div class="kid prof ${v.prof.awake ? 'awake' : 'sleep'}" data-k="__prof" style="left:470px;top:92px;--z:30px"><div class="bb">${profInner(v)}</div></div>`;
  h += box(370, 112, 200, 62, 46, '', `<span class="plate">${esc(ai(v.source).short)} · ${t('prof')}</span>`);
  h += box(392, 122, 50, 16, 76, 'monitor');
  layout(v.desks.length).seats.forEach(({ x, y }, i) => {
    const d = v.desks[i];
    h += box(x + 38, y - 30, 44, 28, 20, 'chair');
    if (!d) { h += box(x, y, DESK.w, DESK.d, 36, '', `<span class="plate">${t('empty')}</span>`); return; }
    h += `<div class="kid ${d.awake ? 'awake' : 'sleep'} ${d.temp ? 'temp' : ''}" data-k="${esc(d.key)}" style="left:${x + 60}px;top:${y - 14}px"><div class="bb">${kidInner(d, v.source, now)}</div></div>`;
    h += box(x, y, DESK.w, DESK.d, 36, '', `<span class="plate">${esc(d.label[lang])}</span>`);
  });
  return h + '</div>';
}

// Plan 2D de la galerie
function planHTML(v) {
  const seats = v.desks.map((d) => (d
    ? `<span class="seat ${d.awake ? 'awake' : ''}">${sprite({ ...look(d.key), awake: d.awake, src: v.source })}<span class="desk"></span></span>`
    : '<span class="seat"><span class="desk"></span></span>')).join('');
  return `<div class="plan" style="--wall:${wallOf(v.project)}"><span class="pb"><i></i></span><span class="pt">${sprite({ hat: 'tuft', hatColor: ai(v.source).dark, awake: v.prof.awake, src: v.source, glasses: true })}<span class="desk" style="width:46px"></span></span><span class="seats">${seats}</span></div>`;
}

// ---------- Barre du haut ----------
const bar = document.getElementById('top');
const viewEl = document.getElementById('view');
const live = document.getElementById('live');
const ui = { open: null, mode: 'iso', view: { rx: 56, rz: 38 }, sig: '', lost: false };
const ISO = { rx: 56, rz: 38 };

function themeHTML() {
  const th = document.documentElement.dataset.theme;
  return `<div class="seg theme" role="group" aria-label="${t('theme')}" data-seg><span class="thumb" aria-hidden="true"></span>
    <button data-theme-set="light" aria-pressed="${th === 'light'}" aria-label="${t('light')}" title="${t('light')}">${ICON('sun', 16)}</button>
    <button data-theme-set="dark" aria-pressed="${th === 'dark'}" aria-label="${t('dark')}" title="${t('dark')}">${ICON('moon', 16)}</button></div>`;
}
function renderTop() {
  const key = ui.open;
  const brand = `<span class="brand">${LOGO}<span>AgentClass</span></span>`;
  const right = `<span class="spacer"></span>
    ${key ? `<div class="seg" role="group" aria-label="${t('viewL')}" data-seg><span class="thumb" aria-hidden="true"></span>
      <button data-mode="iso" aria-pressed="${ui.mode === 'iso'}">3D</button><button data-mode="top" aria-pressed="${ui.mode === 'top'}">${t('top')}</button></div>` : ''}
    ${themeHTML()}
    <div class="seg langs" role="group" aria-label="${t('lang')}" data-seg><span class="thumb" aria-hidden="true"></span>
      <button data-lang="fr" aria-pressed="${lang === 'fr'}" lang="fr">FR</button><button data-lang="en" aria-pressed="${lang === 'en'}" lang="en">EN</button></div>
    <button class="btn ghost stream" data-stream aria-pressed="${stream}" title="${t('streamTip')}">${ICON(stream ? 'eye-off' : 'eye', 16)}<span>${t('stream')}</span></button>`;
  if (!key) { bar.innerHTML = brand + right; placeThumbs(); return; }
  const [src, proj] = key.split('|');
  const projects = allKeys().filter((k) => k.startsWith(src + '|') && k.split('|')[1]);
  bar.innerHTML = `${brand}<span class="sep"></span>
    <nav class="crumb" aria-label="Classe">
      <button class="btn ghost" data-go="gallery" aria-label="${t('allClasses')}" title="${t('allClasses')}">${ICON('layout-grid')}<small>${allKeys().length}</small></button>
      <span class="title"><span class="swatch" style="background:${ai(src).body}22">${sprite({ src, awake: true })}</span>${esc(ai(src).short)}</span>
      <div class="pop">
        <button class="btn" data-menu aria-haspopup="menu" aria-expanded="false">${ICON('folder', 16)}<span class="mono">${esc(showProj(proj))}</span>${ICON('chevron-down', 14)}</button>
        <div class="menu" role="menu" hidden><h3>${projects.length ? t('projectsFor', ai(src).short) : t('noProject')}</h3>
          ${projects.map((k) => { const v = view(st, k); return `<button class="item" role="menuitemradio" aria-checked="${k === key}" data-open="${esc(k)}"><span class="mono">${esc(showProj(v.project))}</span>${k === key ? `<span class="check">${ICON('check', 16)}</span>` : `<span class="meta">${t('active', v.active)}</span>`}</button>`; }).join('')}
        </div>
      </div>
    </nav>
    <button class="btn ghost icon" data-go="add" aria-label="${t('addClass')}" title="${t('addClass')}">${ICON('plus')}</button>${right}`;
  placeThumbs();
}
function placeThumbs() {
  bar.querySelectorAll('[data-seg]').forEach((seg) => {
    const on = seg.querySelector('[aria-pressed="true"]'), th = seg.querySelector('.thumb');
    if (!on || !th) return;
    th.style.width = on.offsetWidth + 'px';
    th.style.transform = `translateX(${on.offsetLeft - 3}px)`;
  });
}

// ---------- Vue « classe » ----------
let roomEl, fitEl;
function hudHTML(v) {
  const status = v.connected
    ? `<span class="dot ${v.active ? '' : 'idle'}"></span><strong>${t('active', v.active)}</strong><span class="long">${t('of', v.total)}</span>`
    : `<span class="dot idle"></span><span class="empty-note">${t('waiting')}</span>`;
  return `<div class="left"><div class="status">${ui.lost ? `<span class="dot idle"></span>${t('lost')}` : status}</div>
      ${stream ? `<div class="stream-flag">${ICON('eye-off', 16)}${t('streamOn')}</div>` : ''}</div>
    <div class="ctrl" role="group" aria-label="Rotation">
      <button class="btn ghost icon" data-rot="-45" aria-label="${t('rotL')}" title="${t('rotL')}">${ICON('rotate-2')}</button>
      <button class="btn ghost icon" data-rot="reset" aria-label="${t('reset')}" title="${t('reset')}">${ICON('focus-centered')}</button>
      <button class="btn ghost icon" data-rot="45" aria-label="${t('rotR')}" title="${t('rotR')}">${ICON('rotate-clockwise-2')}</button></div>`;
}
/** Signature de structure : si elle change, on reconstruit la salle ; sinon on met juste à jour. */
const signature = (v) => [v.key, lang, stream, v.desks.map((d) => d?.key ?? '-').join(',')].join('#');

function renderClass(force) {
  const now = Date.now();
  const v = view(st, ui.open, now);
  const sig = signature(v);
  if (force || sig !== ui.sig || !roomEl) {
    ui.sig = sig;
    viewEl.innerHTML = `<div class="stage" id="stage" style="view-transition-name:room">
        <div class="fit" id="fit"><div class="room" id="room" style="--wall:${wallOf(v.project)};--D:${layout(v.desks.length).D}px">${roomHTML(v, now)}</div></div>
      </div><div class="hud" id="hud">${hudHTML(v)}</div>`;
    roomEl = document.getElementById('room');
    fitEl = document.getElementById('fit');
    bindDrag(document.getElementById('stage'));
    resize();
    apply3d();
  } else {
    // Mise à jour fine : seuls les élèves, le prof, le tableau et la barre d'état changent
    const patch = (el, cls, html) => { if (!el) return; el.className = cls; const bb = el.firstElementChild; if (bb.innerHTML !== html) bb.innerHTML = html; };
    patch(roomEl.querySelector('[data-k="__prof"]'), `kid prof ${v.prof.awake ? 'awake' : 'sleep'}`, profInner(v));
    for (const d of v.desks) if (d) patch(roomEl.querySelector(`[data-k="${CSS.escape(d.key)}"]`), `kid ${d.awake ? 'awake' : 'sleep'} ${d.temp ? 'temp' : ''}`, kidInner(d, v.source, now));
    const b = document.getElementById('board'), bh = boardInner(v);
    if (b && b.innerHTML !== bh) b.innerHTML = bh;
    const hud = document.getElementById('hud'), hh = hudHTML(v);
    if (hud && hud.innerHTML !== hh) hud.innerHTML = hh;
  }
  const msg = t('liveTxt', ai(v.source).short, v.active);
  if (live.textContent !== msg) live.textContent = msg;
}
function resize() {
  if (fitEl) fitEl.style.setProperty('--fit', Math.min(viewEl.clientWidth / 1250, viewEl.clientHeight / 1000, 1.15).toFixed(3));
}
new ResizeObserver(resize).observe(viewEl);

function syncMode() {
  bar.querySelectorAll('[data-mode]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.mode === ui.mode)));
  placeThumbs();
}
function apply3d() {
  if (!roomEl) return;
  const { rx, rz } = ui.view;
  const k = Math.min(1, rx / 35);
  roomEl.style.setProperty('--rx', rx + 'deg');
  roomEl.style.setProperty('--rz', rz + 'deg');
  roomEl.style.setProperty('--fold', (-90 * k).toFixed(1) + 'deg');
  fitEl.style.setProperty('--shift', ((1 - k) * 105).toFixed(0) + 'px');
  // Murs tournés vers la caméra : abaissés pour voir dedans
  const a = rz * Math.PI / 180, fx = Math.sin(a), fy = Math.cos(a);
  const out = { n: [0, -1], s: [0, 1], e: [1, 0], w: [-1, 0] };
  roomEl.querySelectorAll('.wall').forEach((w) => {
    const [nx, ny] = out[w.dataset.wall];
    w.classList.toggle('cut', rx < 10 ? w.dataset.wall !== 'n' : nx * fx + ny * fy > 0.25);
  });
}
function setMode(m) {
  ui.mode = m;
  const near = (target) => target + Math.round((ui.view.rz - target) / 360) * 360;
  ui.view = m === 'top' ? { rx: 0, rz: near(0) } : { rx: ISO.rx, rz: near(ISO.rz) };
  syncMode();
  apply3d();
}
function bindDrag(stage) {
  let d = null;
  stage.addEventListener('pointerdown', (e) => { if (e.button !== 0 || e.target.closest('button')) return; d = { x: e.clientX, y: e.clientY, ...ui.view }; stage.classList.add('dragging'); stage.setPointerCapture(e.pointerId); });
  stage.addEventListener('pointermove', (e) => {
    if (!d) return;
    ui.view.rz = d.rz + (e.clientX - d.x) * 0.3;
    ui.view.rx = Math.max(0, Math.min(68, d.rx - (e.clientY - d.y) * 0.2));
    const m = ui.view.rx < 5 ? 'top' : 'iso';
    if (m !== ui.mode) { ui.mode = m; syncMode(); }
    apply3d();
  });
  const end = () => { d = null; stage.classList.remove('dragging'); };
  stage.addEventListener('pointerup', end);
  stage.addEventListener('pointercancel', end);
}

// ---------- Vue « galerie » ----------
function renderGallery(focusAdd) {
  const cards = allKeys().map((k) => {
    const v = view(st, k);
    const foot = !v.connected ? t('noPlugin') : `${t('agents', v.total)} · ${v.active ? `<strong>${t('active', v.active)}</strong>` : t('allIdle')}`;
    return `<button class="card" data-open="${esc(k)}" aria-label="${esc(t('open', ai(v.source).short, showProj(v.project)))}">
      <div class="card-head"><span class="swatch" style="background:${ai(v.source).body}22">${sprite({ src: v.source, awake: true })}</span><strong>${esc(ai(v.source).short)}</strong><span class="proj">${esc(showProj(v.project))}</span><span class="dot ${v.active ? '' : 'idle'}"></span></div>
      <div class="thumb-room">${planHTML(v)}</div>
      <div class="card-foot">${foot}</div></button>`;
  }).join('');
  viewEl.innerHTML = `<section class="gallery">
    <header><h1>${t('yours')}</h1><p>${t('sub', allKeys().length)}</p></header>
    <div class="grid">${cards}
      <div class="card add"><div class="add-inner">
        <span class="add-plus">${ICON('plus', 24)}</span><p>${t('addText')}</p>
        <div class="pop">
          <button class="btn" data-menu aria-haspopup="menu" aria-expanded="false" id="pick-ai">${t('pick')} ${ICON('chevron-down', 14)}</button>
          <div class="menu" role="menu" hidden><h3>${t('allAis')}</h3>
            ${Object.entries(AIS).map(([k, a]) => `<button class="item" role="menuitem" data-add="${k}"><span class="swatch" style="background:${a.body}22">${sprite({ src: k, awake: true })}</span>${a.name}<span class="meta">${st.connected.has(k) ? t('agents', view(st, classKey(k, '')).total) : t('noPlugin')}</span></button>`).join('')}
          </div>
        </div>
      </div></div>
    </div></section>`;
  roomEl = fitEl = null;
  ui.sig = '';
  if (focusAdd) document.getElementById('pick-ai')?.focus();
}

// ---------- Navigation ----------
const go = (fn) => (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches ? document.startViewTransition(fn) : fn());
function render() { renderTop(); ui.open ? renderClass(true) : renderGallery(false); }
function openClass(k) { ui.open = k; renderTop(); renderClass(true); }
function openGallery(focusAdd) { ui.open = null; renderTop(); renderGallery(focusAdd); }
const closeMenus = (except) => document.querySelectorAll('.menu:not([hidden])').forEach((m) => {
  if (m === except) return;
  m.hidden = true;
  m.previousElementSibling?.setAttribute('aria-expanded', 'false');
});

document.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  const menu = b?.hasAttribute('data-menu') ? b.parentElement.querySelector('.menu') : null;
  if (!e.target.closest('.menu')) closeMenus(menu);
  if (!b) return;
  if (b.dataset.themeSet) { document.documentElement.dataset.theme = b.dataset.themeSet; store.set('theme', b.dataset.themeSet); return renderTop(); }
  if (b.dataset.lang) { lang = b.dataset.lang; document.documentElement.lang = lang; store.set('lang', lang); return render(); }
  if (b.hasAttribute('data-stream')) { stream = !stream; store.set('stream', stream); return render(); }
  if (b.dataset.mode) return setMode(b.dataset.mode);
  if (b.dataset.go === 'gallery') return go(() => openGallery(false));
  if (b.dataset.go === 'add') return go(() => openGallery(true));
  if (b.dataset.open) return go(() => openClass(b.dataset.open));
  if (b.dataset.rot) {
    if (b.dataset.rot === 'reset') return setMode('iso');
    if (ui.view.rx < 10) ui.view.rx = ISO.rx;
    ui.mode = 'iso';
    ui.view.rz += Number(b.dataset.rot);
    syncMode();
    return apply3d();
  }
  if (menu) {
    menu.hidden = !menu.hidden;
    b.setAttribute('aria-expanded', String(!menu.hidden));
    if (!menu.hidden) menu.querySelector('.item')?.focus();
    return;
  }
  if (b.dataset.add) {
    const k = classKey(b.dataset.add, '');
    if (!extra.includes(k)) { extra = [...extra, k]; store.set('classes', extra); }
    return go(() => renderGallery(false));
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  const open = document.querySelector('.menu:not([hidden])');
  closeMenus();
  open?.previousElementSibling?.focus();
});

// ---------- Flux en direct ----------
let pending = false;
const schedule = () => {
  if (pending) return;
  pending = true;
  requestAnimationFrame(() => {
    pending = false;
    if (!ui.open) {
      // Première donnée : ouvre la classe la plus récente
      ui.open = allKeys()[0] ?? null;
      if (ui.open) return render();
      return renderGallery(false);
    }
    if (!allKeys().includes(ui.open)) { ui.open = allKeys()[0]; return render(); }
    renderClass(false);
  });
};
let booted = false;
const es = new EventSource(`/events?t=${encodeURIComponent(token)}`);
es.onopen = () => { if (ui.lost) { ui.lost = false; schedule(); } };
es.onerror = () => { ui.lost = true; schedule(); };
es.addEventListener('agents', (m) => {
  try {
    const p = JSON.parse(m.data || '{}');
    for (const s of p.connected ?? []) st.connected.add(s);
    if (p.claude) st.agents.claude = p.claude;
  } catch { /* charge utile illisible : ignorée */ }
  if (!booted) { booted = true; ui.open = allKeys()[0] ?? null; return render(); }
  ui.sig = ''; // la liste des agents a changé : reconstruire
  schedule();
});
es.onmessage = (m) => {
  try { apply(st, JSON.parse(m.data)); } catch { return; }
  if (booted) schedule();
};
// Horloge : durées, prof qui s'endort, sous-agents oubliés
setInterval(() => { if (booted && ui.open) renderClass(false); }, 1000);

// ---------- Démarrage ----------
document.documentElement.dataset.theme = store.get('theme', matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
document.documentElement.lang = lang;
if (matchMedia('(max-width: 767px)').matches) { ui.mode = 'top'; ui.view = { rx: 0, rz: 0 }; }
document.fonts?.ready.then(placeThumbs);
