// Lecteur Claude : suit les JSONL écrits par le hook et rend des événements
// au format commun (docs/05-SCHEMA.md). Les lignes d'une version inconnue
// ou illisibles sont ignorées sans planter.
import { closeSync, mkdirSync, openSync, readSync, readdirSync, realpathSync, statSync, watch } from 'node:fs';
import { join } from 'node:path';

// Champs du format commun (docs/05-SCHEMA.md) et longueur maximale. Tout le reste est jeté :
// la page ne reçoit jamais un champ que le schéma ne prévoit pas.
const FIELDS = { ts: 40, source: 20, session: 100, agent: 100, kind: 20, call: 100, tool: 100, target: 200, project: 300, agentType: 100 };

/** @param {string} line @returns {any | null} */
export function parseLine(line) {
  let raw;
  try { raw = JSON.parse(line); } catch { return null; }
  if (!raw || raw.v !== 1 || typeof raw.kind !== 'string' || typeof raw.session !== 'string') return null;
  /** @type {Record<string, unknown>} */
  const ev = { v: 1 };
  for (const [k, max] of Object.entries(FIELDS)) if (typeof raw[k] === 'string') ev[k] = raw[k].slice(0, max);
  if (typeof raw.ok === 'boolean') ev.ok = raw.ok;
  if (Number.isFinite(raw.ms)) ev.ms = raw.ms;
  ev.agent ??= 'main';
  return ev;
}

const MAX_REST = 64 * 1024;

/**
 * Suit les fichiers `claude-*.jsonl` d'un dossier : lit l'existant (fichiers
 * du jour et de la veille), puis les ajouts. Rend une fonction d'arrêt.
 * @param {string} dir @param {(ev: any) => void} onEvent
 */
export function follow(dir, onEvent) {
  mkdirSync(dir, { recursive: true });
  // Chemin long obligatoire : fs.watch plante sous Windows sur un nom court 8.3 (UTILIS~1).
  dir = realpathSync.native(dir);
  /** @type {Map<string, { offset: number, rest: Buffer }>} */
  const files = new Map();
  const since = new Date(Date.now() - 864e5).toISOString().slice(0, 10);

  /** @param {string} name */
  const read = (name) => {
    if (!/^claude-\d{4}-\d{2}-\d{2}\.jsonl$/.test(name) || name.slice(7, 17) < since) return;
    const f = files.get(name) ?? { offset: 0, rest: Buffer.alloc(0) };
    files.set(name, f);
    let fd;
    try {
      const size = statSync(join(dir, name)).size;
      if (size < f.offset) Object.assign(f, { offset: 0, rest: Buffer.alloc(0) }); // fichier tronqué
      if (size <= f.offset) return;
      fd = openSync(join(dir, name), 'r');
      const buf = Buffer.alloc(size - f.offset);
      f.offset += readSync(fd, buf, 0, buf.length, f.offset);
      // Découpe en octets : un caractère UTF-8 coupé entre deux lectures reste intact.
      const all = Buffer.concat([f.rest, buf]);
      const end = all.lastIndexOf(10) + 1;
      f.rest = all.subarray(end);
      if (f.rest.length > MAX_REST) f.rest = Buffer.alloc(0); // ligne sans fin : abandonnée
      for (const l of all.subarray(0, end).toString('utf8').split('\n')) {
        const ev = l && parseLine(l);
        if (ev) onEvent(ev);
      }
    } catch {
      // Fichier en cours d'écriture ou supprimé : on réessaiera au prochain signal.
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  };

  const scan = () => { try { for (const name of readdirSync(dir).sort()) read(name); } catch { /* dossier supprimé */ } };
  scan();
  const w = watch(dir, (_, name) => name && read(String(name)));
  w.on('error', () => {});
  // ponytail: fs.watch rate parfois des signaux sous Windows ; balayage d'appoint toutes les secondes.
  const t = setInterval(scan, 1000);
  return () => { w.close(); clearInterval(t); };
}
