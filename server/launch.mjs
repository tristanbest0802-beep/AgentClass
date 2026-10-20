// Démarrage du serveur en arrière-plan et ouverture de la page.
// Partagé par le hook (SessionStart) et la CLI (start.bat, agentclass open).
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config, home as defaultHome, roomUrl } from './config.mjs';

/** @param {string} dir @returns {{ url: string } | null} */
function alive(dir) {
  try {
    const s = JSON.parse(readFileSync(join(dir, 'server.json'), 'utf8'));
    process.kill(s.pid, 0);
    return s;
  } catch {
    return null;
  }
}

/**
 * Lance le serveur s'il ne tourne pas (processus détaché, sans fenêtre). Rend le lien.
 * @param {string} [dir] @param {{ wait?: number }} [opts] wait : ms d'attente max du démarrage
 * @returns {Promise<{ url: string, started: boolean }>}
 */
export async function ensureServer(dir = defaultHome(), { wait = 0 } = {}) {
  const s = alive(dir);
  if (s) return { url: s.url, started: false };
  const c = config(dir);
  const bin = fileURLToPath(new URL('../bin/agentclass.mjs', import.meta.url));
  spawn(process.execPath, [bin, 'start'], { detached: true, stdio: 'ignore', windowsHide: true, env: { ...process.env, AGENTCLASS_HOME: dir } }).unref();
  for (let t = 0; t < wait; t += 100) {
    await new Promise((r) => setTimeout(r, 100));
    const up = alive(dir);
    if (up) return { url: up.url, started: true };
  }
  return { url: roomUrl(c.port, c.token), started: true };
}

/** Ouvre un lien dans le navigateur par défaut. @param {string} url */
export function openBrowser(url) {
  const [cmd, args] = process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]];
  spawn(cmd, args, { detached: true, stdio: 'ignore', windowsHide: true }).unref();
}
