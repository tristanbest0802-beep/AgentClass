// État des classes, calculé à partir des événements (format commun, docs/05-SCHEMA.md).
// Module pur, sans DOM : utilisé par la page et par les tests node.

export const LOOP_READS = 4; // même fichier lu N fois par le même agent : alerte de boucle
const STALE_MS = 10 * 60 * 1000; // sous-agent sans nouvelle depuis 10 min : considéré parti
const PROF_AWAKE_MS = 20 * 1000;
const MAX_FILES = 8;

/** @param {string} source @param {string} [project] */
export const classKey = (source, project) => `${source}|${project ?? ''}`;

/** @returns {State} */
export function createState() {
  return { classes: new Map(), connected: new Set(), agents: {}, sessionProject: new Map() };
}

/** @param {string} [p] */
const base = (p) => (p ? p.split('/').pop() ?? p : '');
/** @param {string} [tool] @param {string} [target] */
export const taskLabel = (tool, target) => [tool, base(target)].filter(Boolean).join(' ');

/** @param {State} st @param {any} ev */
function cls(st, ev) {
  const key = classKey(ev.source, ev.project);
  let c = st.classes.get(key);
  if (!c) {
    c = { key, source: ev.source, project: ev.project ?? '', lastAt: 0, prof: { task: '', at: 0, pending: 0 }, subs: new Map(), files: new Map(), reads: new Map(), pending: new Map() };
    st.classes.set(key, c);
  }
  return c;
}

/**
 * Applique un événement à l'état.
 * @param {State} st @param {any} ev
 */
export function apply(st, ev) {
  if (!ev?.source || !ev.kind) return;
  st.connected.add(ev.source);
  // Le dossier courant peut changer pendant une session (cd) : le projet reste celui du début.
  if (ev.session) {
    if (!st.sessionProject.has(ev.session) && ev.project) st.sessionProject.set(ev.session, ev.project);
    ev = { ...ev, project: st.sessionProject.get(ev.session) ?? ev.project };
  }
  const at = Date.parse(ev.ts) || Date.now();
  const c = cls(st, ev);
  c.lastAt = Math.max(c.lastAt, at);
  const main = !ev.agent || ev.agent === 'main';
  /** @returns {Sub} */
  const sub = () => {
    let s = c.subs.get(ev.agent);
    // Début manqué (hook installé en cours de route) : on crée le sous-agent au premier signe de vie.
    if (!s) c.subs.set(ev.agent, (s = { id: ev.agent, type: ev.agentType ?? '', since: at, at, task: '', loop: false }));
    return s;
  };

  switch (ev.kind) {
    case 'agent_start': sub(); break;
    case 'agent_stop':
      c.subs.delete(ev.agent);
      for (const k of c.reads.keys()) if (k.startsWith(`${ev.agent}|`)) c.reads.delete(k);
      break;
    case 'tool_call': {
      const task = taskLabel(ev.tool, ev.target);
      if (main) { c.prof.task = task; c.prof.at = at; c.prof.pending++; } else { const s = sub(); s.task = task; s.at = at; }
      if (ev.call) c.pending.set(ev.call, { main, agent: ev.agent });
      if (ev.target && ev.tool !== 'Bash') {
        const who = main ? 'main' : ev.agentType || ev.agent;
        c.files.set(ev.target, { path: ev.target, state: 'go', who, at, reads: (c.files.get(ev.target)?.reads ?? 0) + (ev.tool === 'Read' ? 1 : 0) });
        if (ev.tool === 'Read') {
          const k = `${ev.agent ?? 'main'}|${ev.target}`;
          const n = (c.reads.get(k) ?? 0) + 1;
          c.reads.set(k, n);
          if (n >= LOOP_READS && !main) sub().loop = true;
        }
      }
      break;
    }
    case 'tool_result': {
      const p = ev.call && c.pending.get(ev.call);
      if (p) { c.pending.delete(ev.call); if (p.main) c.prof.pending = Math.max(0, c.prof.pending - 1); }
      if (main) c.prof.at = at; else sub().at = at;
      const f = ev.target && c.files.get(ev.target);
      if (f) { f.state = ev.ok === false ? 'fail' : 'back'; f.at = at; }
      break;
    }
  }
}

/**
 * Vue d'une classe à l'instant `now` : tables (agents fixes et temporaires), prof, tableau.
 * @param {State} st @param {string} key @param {number} [now]
 */
export function view(st, key, now = Date.now()) {
  const [source, project = ''] = key.split('|');
  const c = st.classes.get(key);
  const on = st.connected.has(source);
  const pack = st.agents[source];
  const roster = on && pack ? [...(pack.agents ?? []), ...(pack.byProject?.[project] ?? [])] : [];
  const subs = c ? [...c.subs.values()].filter((s) => now - s.at < STALE_MS) : [];
  const used = new Set();

  /** @type {Desk[]} */
  const desks = roster.map((a) => {
    const s = subs.find((x) => !used.has(x) && x.type === a.id);
    if (s) used.add(s);
    return { key: a.id, id: a.id, label: a.label, job: a.job, temp: false, awake: !!s, task: s?.task ?? '', loop: !!s?.loop, since: s?.since ?? 0 };
  });
  // Sous-agents sans table attitrée (type inconnu, ou deuxième instance) : table temporaire
  for (const s of subs) {
    if (used.has(s)) continue;
    const known = roster.find((a) => a.id === s.type);
    const name = s.type || 'sous-agent';
    desks.push({ key: `tmp:${s.id}`, id: s.type, label: known?.label ?? { fr: name, en: name }, job: known?.job ?? { fr: 'Sous-agent', en: 'Subagent' }, temp: true, awake: true, task: s.task, loop: s.loop, since: s.since });
  }
  const profAwake = !!c && (c.prof.pending > 0 || subs.length > 0 || now - c.prof.at < PROF_AWAKE_MS);
  const files = c ? [...c.files.values()].sort((a, b) => b.at - a.at).slice(0, MAX_FILES) : [];
  return {
    key, source, project, connected: on,
    desks: desks.length ? desks : [null, null, null],
    prof: { awake: profAwake, task: c?.prof.task ?? '' },
    files,
    active: desks.filter((d) => d.awake).length,
    total: roster.length,
    lastAt: c?.lastAt ?? 0,
  };
}

/**
 * @typedef {{ id: string, type: string, since: number, at: number, task: string, loop: boolean }} Sub
 * @typedef {{ key: string, id: string, label: { fr: string, en: string }, job: { fr: string, en: string }, temp: boolean, awake: boolean, task: string, loop: boolean, since: number }} Desk
 * @typedef {{ key: string, source: string, project: string, lastAt: number, prof: { task: string, at: number, pending: number }, subs: Map<string, Sub>, files: Map<string, any>, reads: Map<string, number>, pending: Map<string, any> }} Cls
 * @typedef {{ classes: Map<string, Cls>, connected: Set<string>, agents: Record<string, any>, sessionProject: Map<string, string> }} State
 */
