import { test } from 'node:test';
import assert from 'node:assert/strict';
import { request } from 'node:http';
import { appendFileSync, copyFileSync, mkdirSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve, running, writeState, clearState } from '../server/server.mjs';
import { follow, parseLine } from '../server/readers/claude.mjs';

const FIXTURE = new URL('./fixtures/claude-two-subagents.jsonl', import.meta.url);
const today = () => new Date().toISOString().slice(0, 10);

/** Requête brute : fetch ne laisse pas choisir l'en-tête Host. */
function get(port, path, headers = {}, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port, path, method, headers: { host: `127.0.0.1:${port}`, ...headers } }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; if (res.headers['content-type']?.startsWith('text/event-stream')) { res.destroy(); resolve({ status: res.statusCode, headers: res.headers, body }); } });
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

test('lecteur : la capture réelle se lit sans perte, lignes invalides ignorées', async () => {
  const lines = readFileSync(FIXTURE, 'utf8').trim().split('\n');
  const evs = lines.map(parseLine);
  assert.ok(evs.every(Boolean));
  assert.equal(new Set(evs.filter((e) => e.agent !== 'main').map((e) => e.agent)).size, 2);
  assert.equal(parseLine('{"v":2,"kind":"x","session":"s"}'), null);
  assert.equal(parseLine('pas du json'), null);
  const e = parseLine('{"v":1,"kind":"tool_call","session":"s","prompt":"SECRET","target":"' + 'x'.repeat(500) + '"}');
  assert.equal(e.prompt, undefined, 'champ hors schéma jeté');
  assert.equal(e.target.length, 200);
  assert.equal(e.agent, 'main');
});

test('lecteur : suit les ajouts, y compris une ligne coupée en deux écritures', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'agentclass-'));
  const f = join(dir, `claude-${today()}.jsonl`);
  copyFileSync(FIXTURE, f);
  const got = [];
  const stop = follow(dir, (e) => got.push(e));
  const n = readFileSync(FIXTURE, 'utf8').trim().split('\n').length;
  assert.equal(got.length, n);
  appendFileSync(f, '{"v":1,"session":"s","kin');
  appendFileSync(f, 'd":"tool_call","agent":"main","target":"caf');
  appendFileSync(f, Buffer.from([0xc3]));
  await new Promise((r) => setTimeout(r, 1100)); // force une lecture au milieu du caractère
  appendFileSync(f, Buffer.concat([Buffer.from([0xa9]), Buffer.from('.md"}\nbruit\n')]));
  await new Promise((r) => setTimeout(r, 1300));
  stop();
  assert.equal(got.length, n + 1);
  assert.equal(got.at(-1).kind, 'tool_call');
  assert.equal(got.at(-1).target, 'café.md', 'UTF-8 coupé entre deux écritures');
});

test('sécurité : Host, Origin et jeton vérifiés, pas de CORS', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'agentclass-'));
  const srv = await serve({ home, token: 'bon-jeton' });
  t.after(() => srv.close());
  const p = srv.port;
  assert.equal((await get(p, '/?t=bon-jeton')).status, 200);
  assert.equal((await get(p, '/?t=bon-jeton', { host: `localhost:${p}` })).status, 200);
  assert.equal((await get(p, '/?t=faux')).status, 403);
  assert.equal((await get(p, '/')).status, 403);
  assert.equal((await get(p, '/?t=bon-jeton', { host: 'evil.com' })).status, 403, 'DNS rebinding');
  assert.equal((await get(p, '/events?t=bon-jeton', { origin: 'https://evil.com' })).status, 403);
  assert.equal((await get(p, '/events?t=bon-jeton', { origin: `http://127.0.0.1:${p}` })).status, 200);
  assert.equal((await get(p, '/web/app.js', { host: 'evil.com' })).status, 403);
  assert.notEqual((await get(p, '/web/../server/server.mjs')).status, 200);
  assert.notEqual((await get(p, '/web/%2e%2e/package.json')).status, 200);
  assert.notEqual((await get(p, '/web/..%5cserver%5cserver.mjs')).status, 200);
  assert.equal((await get(p, '/events?t=' + '%C3%A9'.repeat(9))).status, 403, 'jeton non ASCII : pas de crash');
  assert.equal((await get(p, '/?t=bon-jeton')).status, 200, 'serveur toujours vivant');
  const ok = await get(p, '/?t=bon-jeton');
  assert.equal(ok.headers['access-control-allow-origin'], undefined);
  assert.match(ok.headers['content-security-policy'], /frame-ancestors 'none'/);
});

test('SSE : rejoue l\'existant puis diffuse les ajouts', async (t) => {
  const home = mkdtempSync(join(tmpdir(), 'agentclass-'));
  mkdirSync(join(home, 'events'));
  const f = join(home, 'events', `claude-${today()}.jsonl`);
  appendFileSync(f, '{"v":1,"session":"s","kind":"session_start","agent":"main"}\n');
  const srv = await serve({ home, token: 'j' });
  t.after(() => srv.close());
  const body = await new Promise((resolve) => {
    const req = request({ host: '127.0.0.1', port: srv.port, path: '/events?t=j', headers: { host: `127.0.0.1:${srv.port}` } }, (res) => {
      let b = '';
      res.on('data', (c) => {
        b += c;
        if (b.includes('session_start') && !b.includes('tool_call')) appendFileSync(f, '{"v":1,"session":"s","kind":"tool_call","agent":"main"}\n');
        if (b.includes('tool_call')) { res.destroy(); resolve(b); }
      });
    });
    req.end();
  });
  assert.match(body, /session_start[\s\S]*tool_call/);
});

test('pas de serveur en double : server.json sert de verrou', () => {
  const home = mkdtempSync(join(tmpdir(), 'agentclass-'));
  assert.equal(running(home), null);
  assert.equal(writeState(home, { pid: process.pid, port: 1, token: 'a', url: 'u' }), true);
  assert.equal(writeState(home, { pid: process.pid, port: 2, token: 'b', url: 'v' }), false);
  assert.equal(running(home)?.port, 1);
  clearState(home);
  assert.equal(writeState(home, { pid: 999999999, port: 3, token: 'c', url: 'w' }), true);
  assert.equal(running(home), null, 'PID mort : considéré comme arrêté');
});

test('arrêt propre par POST /shutdown', async () => {
  const home = mkdtempSync(join(tmpdir(), 'agentclass-'));
  let closed = false;
  const srv = await serve({ home, token: 'j', onClose: () => { closed = true; } });
  assert.equal((await get(srv.port, '/shutdown?t=faux', {}, 'POST')).status, 403);
  assert.equal((await get(srv.port, '/shutdown?t=j', {}, 'POST')).status, 204);
  await srv.close();
  assert.equal(closed, true);
});
