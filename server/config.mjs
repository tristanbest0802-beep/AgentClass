// Configuration persistante : jeton et port gardés d'un démarrage à l'autre,
// pour que le lien de la salle reste toujours le même.
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_PORT = 47100;
export const home = () => process.env.AGENTCLASS_HOME || join(homedir(), '.agentclass');

/**
 * Lit config.json, le crée (jeton aléatoire, droits utilisateur seulement) s'il manque.
 * @param {string} [dir] @param {{ reset?: boolean }} [opts]
 * `announce` (défaut vrai) : Claude donne le lien en tête de sa première réponse ; false pour 0 token strict.
 * @returns {{ token: string, port: number, announce: boolean }}
 */
export function config(dir = home(), { reset = false } = {}) {
  const file = join(dir, 'config.json');
  if (!reset) {
    try {
      const c = JSON.parse(readFileSync(file, 'utf8'));
      if (typeof c.token === 'string' && c.token.length >= 32) return { token: c.token, port: Number(c.port) || DEFAULT_PORT, announce: c.announce !== false };
    } catch {
      // Absent ou illisible : on le recrée.
    }
  }
  const c = { token: randomBytes(32).toString('base64url'), port: Number(process.env.AGENTCLASS_PORT) || DEFAULT_PORT, announce: true };
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, JSON.stringify(c), { mode: 0o600 });
  return c;
}

/** @param {number} port @param {string} token */
export const roomUrl = (port, token) => `http://127.0.0.1:${port}/?t=${token}`;
