#!/usr/bin/env node
// Hook Claude Code : lit l'événement sur stdin, n'en garde que le strict minimum
// et l'ajoute au JSONL du jour. Sort toujours en 0, n'écrit jamais sur stderr.
// Une seule sortie sur stdout, au SessionStart : le lien de la salle en systemMessage
// (montré à l'utilisateur, 0 token) et une consigne d'une phrase pour que Claude le
// donne dans sa première réponse (~50 tokens par session, coupable : announce=false
// dans ~/.agentclass/config.json ou AGENTCLASS_QUIET=1). Rien sur les autres événements.
import { appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, posix, win32 } from 'node:path';
import { fileURLToPath } from 'node:url';

const KINDS = {
  SessionStart: 'session_start',
  SubagentStart: 'agent_start',
  SubagentStop: 'agent_stop',
  PreToolUse: 'tool_call',
  PostToolUse: 'tool_result',
  PostToolUseFailure: 'tool_result',
};

const GRAPHIFY = /^\s*graphify\s+(query|path|explain)\b/;

/** @param {unknown} v @param {number} max */
const str = (v, max) => String(v).slice(0, max);

/**
 * Cible d'un outil : chemin relatif au projet, ou « graphify <commande> ».
 * Jamais de contenu, jamais d'argument de commande.
 * @param {string} tool @param {any} ti @param {string | undefined} cwd
 */
function target(tool, ti, cwd) {
  if (tool === 'Bash') {
    const m = GRAPHIFY.exec(ti?.command ?? '');
    return m ? `graphify ${m[1]}` : undefined;
  }
  const p = ti?.file_path ?? ti?.notebook_path ?? ti?.path;
  if (typeof p !== 'string' || !p) return undefined;
  // Chemins Windows reconnus quel que soit l'OS qui lit l'événement.
  const P = /^[A-Za-z]:[\\/]/.test(p) ? win32 : posix;
  let r = p;
  if (cwd && P.isAbsolute(p)) {
    const rel = P.relative(cwd, p);
    if (rel && !rel.startsWith('..') && !P.isAbsolute(rel)) r = rel;
  }
  return r.replaceAll('\\', '/').slice(0, 200);
}

/** @param {any} r */
const isError = (r) => !!r && typeof r === 'object' && (r.is_error === true || !!r.error);

/**
 * Réduit un événement de hook au format commun (docs/05-SCHEMA.md).
 * @param {any} input @param {Date} [now]
 * @returns {Record<string, unknown> | null}
 */
export function reduce(input, now = new Date()) {
  const kind = KINDS[/** @type {keyof typeof KINDS} */ (input?.hook_event_name)];
  if (!kind) return null;
  /** @type {Record<string, unknown>} */
  const ev = {
    v: 1,
    ts: now.toISOString(),
    source: 'claude',
    session: str(input.session_id ?? '', 100),
    agent: input.agent_id ? str(input.agent_id, 100) : 'main',
    kind,
  };
  if (input.agent_type) ev.agentType = str(input.agent_type, 100);
  if (input.cwd) ev.project = str(input.cwd, 300);
  if (input.tool_use_id) ev.call = str(input.tool_use_id, 100);
  if (input.tool_name) {
    ev.tool = str(input.tool_name, 100);
    const t = target(ev.tool, input.tool_input, input.cwd);
    if (t) ev.target = t;
  }
  if (kind === 'tool_result') {
    // Un outil en échec n'émet pas PostToolUse mais PostToolUseFailure.
    ev.ok = input.hook_event_name === 'PostToolUse' && !isError(input.tool_response);
    if (Number.isFinite(input.duration_ms)) ev.ms = Math.round(input.duration_ms);
  }
  return ev;
}

/**
 * Sortie du SessionStart : le lien pour l'utilisateur (systemMessage, 0 token) et,
 * sauf si `announce` est coupé, une consigne d'une phrase pour que Claude donne le
 * lien en tête de sa première réponse (environ 50 tokens, une fois par session).
 * @param {string} url @param {boolean} announce
 */
export function sessionOutput(url, announce) {
  /** @type {Record<string, unknown>} */
  const out = { systemMessage: `AgentClass : ta salle de classe est ouverte ici → ${url}` };
  if (announce) {
    out.hookSpecificOutput = {
      hookEventName: 'SessionStart',
      additionalContext: `AgentClass : le serveur local de la salle de classe est lancé. Commence ta toute première réponse de cette session par une phrase courte qui le dit et donne ce lien : ${url} — puis traite normalement la demande.`,
    };
  }
  return out;
}

function main() {
  if (process.env.AGENTCLASS_OFF) return;
  /** @type {Buffer[]} */
  const chunks = [];
  process.stdin.on('data', (c) => chunks.push(c));
  process.stdin.on('end', async () => {
    try {
      const input = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const ev = reduce(input);
      if (!ev) return;
      const home = process.env.AGENTCLASS_HOME || join(homedir(), '.agentclass');
      const dir = join(home, 'events');
      mkdirSync(dir, { recursive: true });
      appendFileSync(join(dir, `claude-${String(ev.ts).slice(0, 10)}.jsonl`), JSON.stringify(ev) + '\n');
      if (ev.kind === 'session_start') {
        const { ensureServer } = await import('../server/launch.mjs');
        const { config } = await import('../server/config.mjs');
        const { url } = await ensureServer(home);
        // Annonce par Claude seulement pour une vraie nouvelle conversation (pas reprise ni compactage).
        const fresh = input.source === undefined || input.source === 'startup' || input.source === 'clear';
        const announce = fresh && config(home).announce && !process.env.AGENTCLASS_QUIET;
        process.stdout.write(JSON.stringify(sessionOutput(url, announce)));
      }
    } catch {
      // Silence voulu : le hook ne doit jamais gêner Claude Code.
    }
  });
  process.stdin.on('error', () => {});
}

process.on('exit', () => { process.exitCode = 0; });
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
