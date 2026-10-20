// Mesure la durée d'un appel du hook (démarrage de Node compris), comme Claude Code le lance.
import { spawnSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = fileURLToPath(new URL('../hooks/hook.mjs', import.meta.url));
const RUNS = Number(process.argv[2]) || 50;
const env = { ...process.env, AGENTCLASS_HOME: mkdtempSync(join(tmpdir(), 'agentclass-bench-')) };
const input = JSON.stringify({ hook_event_name: 'PreToolUse', session_id: 'bench', cwd: process.cwd(), tool_name: 'Read', tool_use_id: 'x', tool_input: { file_path: join(process.cwd(), 'a.js') } });

const ms = [];
for (let i = 0; i < RUNS; i++) {
  const t = process.hrtime.bigint();
  spawnSync(process.execPath, [HOOK], { input, env });
  ms.push(Number(process.hrtime.bigint() - t) / 1e6);
}
ms.sort((a, b) => a - b);
const at = (q) => ms[Math.min(ms.length - 1, Math.floor(q * ms.length))].toFixed(1);
console.log(`hook x${RUNS} : médiane ${at(0.5)} ms, p90 ${at(0.9)} ms, max ${at(1)} ms`);
