import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { reduce } from '../hooks/hook.mjs';

const HOOK = fileURLToPath(new URL('../hooks/hook.mjs', import.meta.url));
const now = new Date('2026-10-20T10:00:00Z');

test('Read : chemin relatif au projet, appariement par tool_use_id', () => {
  const ev = reduce({
    hook_event_name: 'PreToolUse', session_id: 's1', cwd: '/p',
    tool_name: 'Read', tool_use_id: 'tu1', tool_input: { file_path: '/p/src/a.js' },
  }, now);
  assert.equal(ev.kind, 'tool_call');
  assert.equal(ev.target, 'src/a.js');
  assert.equal(ev.call, 'tu1');
  assert.equal(ev.agent, 'main');
  assert.equal(ev.ts, '2026-10-20T10:00:00.000Z');
});

test('chemins Windows normalisés', () => {
  const ev = reduce({
    hook_event_name: 'PreToolUse', session_id: 's', cwd: 'C:\\p',
    tool_name: 'Edit', tool_input: { file_path: 'C:\\p\\src\\b.js' },
  }, now);
  assert.equal(ev.target, 'src/b.js');
});

test('Bash : seul graphify est reconnu, la commande n\'est jamais stockée', () => {
  const g = reduce({ hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Bash', tool_input: { command: 'graphify query "où est le login ?"' } }, now);
  assert.equal(g.target, 'graphify query');
  const b = reduce({ hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Bash', tool_input: { command: 'curl -H "Authorization: SECRET" x' } }, now);
  assert.equal(b.target, undefined);
  assert.ok(!JSON.stringify([g, b]).includes('SECRET'));
  assert.ok(!JSON.stringify(g).includes('login'));
});

test('aucun contenu, prompt ou sortie stocké', () => {
  const ev = reduce({
    hook_event_name: 'PostToolUse', session_id: 's', prompt: 'PROMPT_SECRET',
    tool_name: 'Write', tool_input: { file_path: 'x.txt', content: 'CONTENT_SECRET' },
    tool_response: { output: 'OUTPUT_SECRET' },
  }, now);
  const s = JSON.stringify(ev);
  for (const secret of ['PROMPT_SECRET', 'CONTENT_SECRET', 'OUTPUT_SECRET']) assert.ok(!s.includes(secret));
  assert.equal(ev.ok, true);
});

test('erreur d\'outil détectée', () => {
  const ev = reduce({ hook_event_name: 'PostToolUse', session_id: 's', tool_name: 'Read', tool_response: { is_error: true } }, now);
  assert.equal(ev.ok, false);
});

test('PostToolUseFailure : échec, durée gardée', () => {
  const ev = reduce({ hook_event_name: 'PostToolUseFailure', session_id: 's', tool_name: 'Read', tool_use_id: 't', duration_ms: 12.4, error: 'ERR_SECRET' }, now);
  assert.deepEqual([ev.kind, ev.ok, ev.ms, ev.call], ['tool_result', false, 12, 't']);
  assert.ok(!JSON.stringify(ev).includes('ERR_SECRET'));
});

test('sous-agent : identifiant et type gardés', () => {
  const ev = reduce({ hook_event_name: 'SubagentStart', session_id: 's', agent_id: 'a1', agent_type: 'Explore' }, now);
  assert.deepEqual([ev.kind, ev.agent, ev.agentType], ['agent_start', 'a1', 'Explore']);
});

test('événement inconnu ignoré', () => {
  assert.equal(reduce({ hook_event_name: 'UserPromptSubmit', prompt: 'x' }, now), null);
});

test('processus : entrée invalide, sortie 0, rien sur stdout ni stderr', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentclass-'));
  const r = spawnSync(process.execPath, [HOOK], { input: '{pas du json', env: { ...process.env, AGENTCLASS_HOME: home } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.length, 0);
  assert.equal(r.stderr.length, 0);
});

test('SessionStart : seule sortie = { systemMessage } avec le lien, rien pour le modèle', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentclass-'));
  // Serveur « vivant » simulé : le PID du test, pour ne rien lancer.
  writeFileSync(join(home, 'server.json'), JSON.stringify({ pid: process.pid, url: 'http://127.0.0.1:47100/?t=x' }));
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ hook_event_name: 'SessionStart', session_id: 's' }), env: { ...process.env, AGENTCLASS_HOME: home } });
  assert.equal(r.status, 0);
  assert.equal(r.stderr.length, 0);
  const out = JSON.parse(r.stdout.toString());
  assert.deepEqual(Object.keys(out), ['systemMessage']);
  assert.match(out.systemMessage, /http:\/\/127\.0\.0\.1:47100\/\?t=x/);
});

test('PreToolUse : toujours rien sur stdout', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentclass-'));
  const r = spawnSync(process.execPath, [HOOK], { input: JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Read' }), env: { ...process.env, AGENTCLASS_HOME: home } });
  assert.equal(r.stdout.length, 0);
});

test('processus : une ligne JSONL écrite dans le fichier du jour', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentclass-'));
  const input = JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 's', tool_name: 'Read', tool_input: { file_path: 'a.js' } });
  const r = spawnSync(process.execPath, [HOOK], { input, env: { ...process.env, AGENTCLASS_HOME: home } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout.length, 0);
  const [file] = readdirSync(join(home, 'events'));
  assert.match(file, /^claude-\d{4}-\d{2}-\d{2}\.jsonl$/);
  const lines = readFileSync(join(home, 'events', file), 'utf8').trim().split('\n');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).target, 'a.js');
});

test('processus : AGENTCLASS_OFF n\'écrit rien', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentclass-'));
  const input = JSON.stringify({ hook_event_name: 'SessionStart', session_id: 's' });
  const r = spawnSync(process.execPath, [HOOK], { input, env: { ...process.env, AGENTCLASS_HOME: home, AGENTCLASS_OFF: '1' } });
  assert.equal(r.status, 0);
  assert.deepEqual(readdirSync(home), []);
});
