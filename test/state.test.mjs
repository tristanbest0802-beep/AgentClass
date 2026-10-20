import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { apply, classKey, createState, view } from '../web/state.mjs';

const P = '/p';
const T0 = Date.parse('2026-10-20T10:00:00Z');
const ev = (kind, rest = {}, dt = 0) => ({ v: 1, source: 'claude', session: 's', project: P, agent: 'main', kind, ts: new Date(T0 + dt).toISOString(), ...rest });
const roster = (ids) => ({ claude: { agents: ids.map((id) => ({ id, label: { fr: id, en: id }, job: { fr: 'Job', en: 'Job' } })), byProject: {} } });
const K = classKey('claude', P);

test('IA jamais vue : 3 places vides, même si ses agents sont connus', () => {
  const st = createState();
  st.agents = roster(['Explore', 'Plan']);
  const v = view(st, K, T0);
  assert.equal(v.connected, false);
  assert.deepEqual(v.desks, [null, null, null]);
});

test('IA branchée : une table par agent connu, tous endormis au départ', () => {
  const st = createState();
  st.agents = roster(['Explore', 'Plan']);
  apply(st, ev('session_start'));
  const v = view(st, K, T0);
  assert.deepEqual(v.desks.map((d) => [d.id, d.awake, d.temp]), [['Explore', false, false], ['Plan', false, false]]);
});

test('agent connu : s\'éveille au début, montre sa tâche, se rendort à la fin', () => {
  const st = createState();
  st.agents = roster(['Explore']);
  apply(st, ev('agent_start', { agent: 'a1', agentType: 'Explore' }));
  apply(st, ev('tool_call', { agent: 'a1', agentType: 'Explore', tool: 'Read', target: 'src/cart.js', call: 'c1' }, 100));
  let d = view(st, K, T0 + 200).desks[0];
  assert.deepEqual([d.awake, d.task, d.temp], [true, 'Read cart.js', false]);
  apply(st, ev('agent_stop', { agent: 'a1', agentType: 'Explore' }, 300));
  d = view(st, K, T0 + 400).desks[0];
  assert.equal(d.awake, false);
});

test('sous-agent temporaire : table ajoutée pendant la tâche, retirée après', () => {
  const st = createState();
  st.agents = roster(['Explore']);
  apply(st, ev('session_start'));
  apply(st, ev('agent_start', { agent: 't1', agentType: 'one-shot-helper' }, 10));
  apply(st, ev('tool_call', { agent: 't1', agentType: 'one-shot-helper', tool: 'Grep', target: 'src' }, 20));
  let v = view(st, K, T0 + 30);
  assert.equal(v.desks.length, 2);
  assert.deepEqual([v.desks[1].temp, v.desks[1].task, v.desks[1].label.fr], [true, 'Grep src', 'one-shot-helper']);
  apply(st, ev('agent_stop', { agent: 't1', agentType: 'one-shot-helper' }, 40));
  v = view(st, K, T0 + 50);
  assert.equal(v.desks.length, 1);
});

test('deux instances du même agent : la seconde prend une table temporaire', () => {
  const st = createState();
  st.agents = roster(['Explore']);
  apply(st, ev('agent_start', { agent: 'a1', agentType: 'Explore' }));
  apply(st, ev('agent_start', { agent: 'a2', agentType: 'Explore' }, 5));
  const v = view(st, K, T0 + 10);
  assert.deepEqual(v.desks.map((d) => [d.temp, d.awake]), [[false, true], [true, true]]);
});

test('sous-agent sans nouvelles depuis 10 min : retiré (fin manquée)', () => {
  const st = createState();
  st.agents = roster([]);
  apply(st, ev('agent_start', { agent: 't1', agentType: 'x' }));
  assert.equal(view(st, K, T0 + 11 * 60 * 1000).desks[0], null);
});

test('alerte de boucle : même fichier lu 4 fois par le même agent', () => {
  const st = createState();
  st.agents = roster(['Explore']);
  for (let i = 0; i < 4; i++) apply(st, ev('tool_call', { agent: 'a1', agentType: 'Explore', tool: 'Read', target: 'a.js' }, i));
  assert.equal(view(st, K, T0 + 10).desks[0].loop, true);
});

test('tableau : aller puis retour, échec signalé, plus récent en premier', () => {
  const st = createState();
  apply(st, ev('tool_call', { tool: 'Read', target: 'a.js', call: 'c1' }));
  apply(st, ev('tool_call', { tool: 'Read', target: 'b.js', call: 'c2' }, 10));
  assert.equal(view(st, K, T0 + 20).files[0].state, 'go');
  apply(st, ev('tool_result', { tool: 'Read', target: 'b.js', call: 'c2', ok: true }, 30));
  apply(st, ev('tool_result', { tool: 'Read', target: 'a.js', call: 'c1', ok: false }, 40));
  const f = view(st, K, T0 + 50).files;
  assert.deepEqual(f.map((x) => [x.path, x.state]), [['a.js', 'fail'], ['b.js', 'back']]);
});

test('prof : éveillé pendant un appel, endormi 20 s après', () => {
  const st = createState();
  apply(st, ev('tool_call', { tool: 'Bash', call: 'c1' }));
  assert.equal(view(st, K, T0 + 60000).prof.awake, true, 'appel en cours');
  apply(st, ev('tool_result', { tool: 'Bash', call: 'c1', ok: true }, 1000));
  assert.equal(view(st, K, T0 + 30000).prof.awake, false);
});

test('cd pendant une session : le projet reste celui du début', () => {
  const st = createState();
  apply(st, ev('session_start'));
  apply(st, ev('tool_call', { project: '/p/docs', tool: 'Read', target: 'a.md' }, 10));
  assert.deepEqual([...st.classes.keys()], [K]);
});

test('une classe par projet', () => {
  const st = createState();
  apply(st, ev('session_start'));
  apply(st, ev('session_start', { session: 's2', project: '/autre' }));
  assert.deepEqual([...st.classes.keys()], [K, classKey('claude', '/autre')]);
});

test('capture réelle : 2 sous-agents Explore en parallèle, puis plus rien d\'actif', () => {
  const st = createState();
  st.agents = roster(['Explore']);
  const lines = readFileSync(new URL('./fixtures/claude-two-subagents.jsonl', import.meta.url), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const key = classKey('claude', lines[0].project);
  let maxActive = 0;
  for (const l of lines) { apply(st, l); maxActive = Math.max(maxActive, view(st, key, Date.parse(l.ts)).active); }
  assert.equal(maxActive, 2);
  assert.equal(view(st, key, Date.parse(lines.at(-1).ts)).active, 0);
});
