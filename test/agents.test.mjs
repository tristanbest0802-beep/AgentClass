import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { claudeAgents, displayName, jobTitle, parseAgent } from '../server/agents.mjs';

test('front matter : nom, description simple et bloc sur plusieurs lignes', () => {
  assert.deepEqual(parseAgent('---\nname: code-reviewer\ndescription: "Senior reviewer"\n---\nCorps', 'x.md'), { name: 'code-reviewer', description: 'Senior reviewer' });
  const multi = parseAgent('---\nname: cavecrew-reviewer\ndescription: >\n  Diff reviewer. One line\n  per finding.\nmodel: haiku\n---\n', 'x.md');
  assert.equal(multi.description, 'Diff reviewer. One line per finding.');
  assert.equal(parseAgent('pas de front matter', 'mon-agent.md').name, 'mon-agent', 'nom du fichier en repli');
  assert.equal(parseAgent('---\r\nname: a\r\ndescription: b\r\n---\r\n', 'x.md').description, 'b', 'fins de ligne Windows');
});

test('métier déduit : du nom d\'abord, puis de la description', () => {
  const cases = [
    ['code-reviewer', '', 'Relecteur'], ['planner', '', 'Chef de projet'], ['architect', '', 'Architecte'],
    ['security-auditor', '', 'Auditeur sécurité'], ['web-performance-auditor', '', 'Optimiseur'], ['doc-updater', '', 'Écrivain'],
    ['build-error-resolver', '', 'Dépanneur'], ['tdd-guide', '', 'Testeur'], ['chief-of-staff', '', 'Secrétaire'],
    ['worker-1', 'Creates motion graphics and animations', 'Motion designer'],
    ['worker-2', 'Cuts and edits video footage', 'Monteur vidéo'],
    ['agent', 'Designs UI mockups in Figma', 'Designer'],
    ['helper', 'Writes blog articles and marketing copy', 'Commercial'],
    ['bot', '', 'Assistant polyvalent'],
  ];
  for (const [name, desc, want] of cases) assert.equal(jobTitle(name, desc).fr, want, `${name} / ${desc}`);
  assert.equal(jobTitle('worker-1', 'Translates the UI').en, 'Translator');
});

test('nom affiché : le vrai nom s\'il dit quelque chose, sinon le métier', () => {
  assert.equal(displayName({ name: 'caveman:cavecrew-reviewer' }), 'cavecrew-reviewer');
  assert.equal(displayName({ name: 'Explore' }), 'Explore');
  assert.equal(displayName({ name: 'worker-3', description: 'Writes the documentation' }), 'Écrivain');
  assert.equal(displayName({ name: 'general-purpose', description: 'multi-step tasks' }, 'en'), 'All-rounder');
});

test('liste : intégrés, utilisateur, projet et plugins activés seulement', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentclass-claude-'));
  const proj = mkdtempSync(join(tmpdir(), 'agentclass-proj-'));
  const plugOn = join(home, 'p-on'), plugOff = join(home, 'p-off');
  for (const d of [join(home, 'agents'), join(proj, '.claude', 'agents'), join(plugOn, 'agents'), join(plugOff, 'agents')]) mkdirSync(d, { recursive: true });
  writeFileSync(join(home, 'agents', 'mine.md'), '---\nname: mine\ndescription: perso\n---\n');
  writeFileSync(join(proj, '.claude', 'agents', 'local.md'), '---\nname: local\n---\n');
  writeFileSync(join(plugOn, 'agents', 'rev.md'), '---\nname: rev\n---\n');
  writeFileSync(join(plugOff, 'agents', 'off.md'), '---\nname: off\n---\n');
  mkdirSync(join(home, 'plugins'));
  writeFileSync(join(home, 'settings.json'), JSON.stringify({ enabledPlugins: { 'on@m': true, 'off@m': false } }));
  writeFileSync(join(home, 'plugins', 'installed_plugins.json'), JSON.stringify({ plugins: { 'on@m': [{ installPath: plugOn }], 'off@m': [{ installPath: plugOff }] } }));
  const ids = claudeAgents({ claudeHome: home, project: proj }).map((a) => a.id);
  for (const id of ['Explore', 'Plan', 'mine', 'local', 'on:rev']) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes('off:off'), 'plugin désactivé ignoré');
});

test('liste : dossier Claude absent, pas d\'erreur', () => {
  const ids = claudeAgents({ claudeHome: join(tmpdir(), 'nexiste-pas-agentclass') }).map((a) => a.id);
  assert.ok(ids.includes('Explore'));
});
