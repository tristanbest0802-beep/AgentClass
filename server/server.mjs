// Serveur local : page de la salle, flux SSE, arrêt propre.
// Écoute sur 127.0.0.1 seulement. Chaque requête vérifie Host, Origin et,
// hors fichiers statiques, le jeton. Pas d'en-tête CORS.
import { createServer } from 'node:http';
import { createHash, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { follow } from './readers/claude.mjs';
import { startDemo } from './demo.mjs';
import { claudeAgents, displayName, jobTitle } from './agents.mjs';
import { config, home, roomUrl } from './config.mjs';

export { home };

const WEB = fileURLToPath(new URL('../web/', import.meta.url));
const TYPES = /** @type {Record<string, string>} */ ({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
});
const HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Content-Security-Policy': "default-src 'self'; style-src 'self' https://fonts.googleapis.com; style-src-attr 'unsafe-inline'; font-src https://fonts.gstatic.com; img-src 'self' data:; frame-ancestors 'none'",
};
// ponytail: tampon en mémoire borné ; un vrai état par session arrive au lot 2.
const MAX_EVENTS = 5000;

/** @param {string} a @param {string} b */
// Hachage d'abord : longueurs égales garanties, timingSafeEqual ne peut pas lever d'exception.
const digest = (/** @type {string} */ s) => createHash('sha256').update(s).digest();
const same = (a, b) => timingSafeEqual(digest(a), digest(b));

/**
 * Agents connus par IA, avec nom affiché et métier dans les deux langues.
 * Les agents propres à un projet (.claude/agents) sont ajoutés pour chaque projet vu.
 * @param {Iterable<string>} projects
 */
export function agentsPayload(projects) {
  /** @param {{ id: string, name: string, description: string, origin: string }} a */
  const view = (a) => {
    const short = a.name.split(':').pop() ?? a.name;
    return { id: a.id, name: short, origin: a.origin, label: { fr: displayName(a, 'fr'), en: displayName(a, 'en') }, job: jobTitle(short, a.description) };
  };
  const global = claudeAgents().map(view);
  /** @type {Record<string, any[]>} */
  const byProject = {};
  for (const p of projects) {
    const own = claudeAgents({ claudeHome: join(p, '.agentclass-aucun'), project: p }).filter((a) => a.origin === 'project');
    if (own.length) byProject[p] = own.map(view);
  }
  return { claude: { agents: global, byProject } };
}

/**
 * @param {{ home?: string, port?: number, token?: string, demo?: boolean, onClose?: () => void, scanMs?: number }} [opts]
 * @returns {Promise<{ url: string, port: number, token: string, close: () => Promise<void> }>}
 */
export async function serve(opts = {}) {
  const dir = opts.home ?? home();
  const token = opts.token ?? config(dir).token;
  /** @type {any[]} */
  const events = [];
  /** @type {Set<import('node:http').ServerResponse>} */
  const clients = new Set();
  // IA branchées (au moins un événement reçu) et projets vus
  /** @type {Set<string>} */
  const sources = new Set();
  /** @type {Set<string>} */
  const projects = new Set();
  let agents = '';
  // Relit les agents toutes les quelques secondes : un agent ajouté ou retiré apparaît sans relancer.
  const scan = () => {
    let next;
    try { next = JSON.stringify({ connected: [...sources], ...agentsPayload(projects) }); } catch { return; }
    if (next === agents) return;
    agents = next;
    for (const c of clients) c.write(`event: agents\ndata: ${agents}\n\n`);
  };

  /** @param {any} ev */
  const push = (ev) => {
    sources.add(ev.source);
    if (ev.project) projects.add(ev.project);
    events.push(ev);
    if (events.length > MAX_EVENTS) events.splice(0, events.length - MAX_EVENTS);
    const msg = `data: ${JSON.stringify(ev)}\n\n`;
    for (const c of clients) c.write(msg);
  };
  const stop = opts.demo ? startDemo(push) : follow(join(dir, 'events'), push);
  scan();
  const scanner = setInterval(scan, opts.scanMs ?? 3000);

  let port = 0;
  const hosts = () => [`127.0.0.1:${port}`, `localhost:${port}`];

  const server = createServer((req, res) => {
    try {
      route(req, res);
    } catch {
      if (!res.headersSent) res.writeHead(500, HEADERS);
      res.end();
    }
  });

  /** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res */
  function route(req, res) {
    const url = new URL(req.url ?? '/', 'http://x');
    const host = req.headers.host ?? '';
    const origin = req.headers.origin;
    if (!hosts().includes(host) || (origin && !hosts().some((h) => origin === `http://${h}`))) return deny(res);

    if (req.method === 'GET' && url.pathname.startsWith('/web/')) return file(res, url.pathname.slice(5));
    if (!same(url.searchParams.get('t') ?? '', token)) return deny(res);

    if (req.method === 'GET' && url.pathname === '/') return file(res, 'index.html');
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { ...HEADERS, 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write('retry: 2000\n\n');
      res.write(`event: agents\ndata: ${agents}\n\n`);
      for (const ev of events) res.write(`data: ${JSON.stringify(ev)}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/shutdown') {
      res.writeHead(204, HEADERS).end();
      close();
      return;
    }
    res.writeHead(404, HEADERS).end();
  }

  const ping = setInterval(() => { for (const c of clients) c.write(': ping\n\n'); }, 25000);

  let closing;
  const close = () => (closing ??= new Promise((done) => {
    stop();
    clearInterval(ping);
    clearInterval(scanner);
    for (const c of clients) c.end();
    server.close(() => { opts.onClose?.(); done(undefined); });
  }));

  port = await listen(server, opts.port ?? 0);
  return { url: roomUrl(port, token), port, token, close };
}

/** @param {import('node:http').ServerResponse} res */
function deny(res) {
  res.writeHead(403, { ...HEADERS, 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('403 : lien invalide. Relance `agentclass start` et ouvre le lien qu\'il affiche.\n');
}

/** @param {import('node:http').ServerResponse} res @param {string} rel */
function file(res, rel) {
  const p = normalize(join(WEB, rel));
  if (!p.startsWith(normalize(WEB)) || p.includes(`${sep}..`) || !TYPES[extname(p)]) return void res.writeHead(404, HEADERS).end();
  try {
    const body = readFileSync(p);
    res.writeHead(200, { ...HEADERS, 'Content-Type': TYPES[extname(p)], 'Cache-Control': 'no-store' });
    res.end(body);
  } catch {
    res.writeHead(404, HEADERS).end();
  }
}

/**
 * Écoute sur 127.0.0.1. Port occupé : essaie les 9 suivants.
 * @param {import('node:http').Server} server @param {number} port @returns {Promise<number>}
 */
function listen(server, port) {
  return new Promise((resolve, reject) => {
    let tries = 0;
    const attempt = () => server.listen(port === 0 ? 0 : port + tries, '127.0.0.1');
    server.on('error', (/** @type {any} */ e) => (e.code === 'EADDRINUSE' && port && ++tries < 10 ? attempt() : reject(e)));
    server.on('listening', () => resolve(/** @type {import('node:net').AddressInfo} */ (server.address()).port));
    attempt();
  });
}

/** Fichier d'état du serveur (port, PID, jeton). @param {string} [dir] */
export const stateFile = (dir = home()) => join(dir, 'server.json');

/** @param {string} [dir] @returns {{ port: number, pid: number, token: string, url: string } | null} */
export function running(dir) {
  try {
    const s = JSON.parse(readFileSync(stateFile(dir), 'utf8'));
    process.kill(s.pid, 0);
    return s;
  } catch {
    return null;
  }
}

/**
 * Écrit server.json en création exclusive : sert de verrou contre un double démarrage.
 * @param {string} dir @param {object} s @returns {boolean} faux si un autre serveur a gagné
 */
export function writeState(dir, s) {
  mkdirSync(dir, { recursive: true });
  try {
    writeFileSync(stateFile(dir), JSON.stringify(s), { mode: 0o600, flag: "wx" });
    return true;
  } catch {
    return false;
  }
}

/** @param {string} dir */
export function clearState(dir) {
  if (existsSync(stateFile(dir))) rmSync(stateFile(dir), { force: true });
}
