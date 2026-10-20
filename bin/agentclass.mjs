#!/usr/bin/env node
// CLI : agentclass [start|demo|stop]
import { clearState, home, running, serve, writeState } from '../server/server.mjs';
import { config } from '../server/config.mjs';
import { ensureServer, openBrowser } from '../server/launch.mjs';

const cmd = process.argv[2] ?? 'start';
const dir = home();
const port = config(dir).port;

if (cmd === 'stop') {
  const s = running(dir);
  if (!s) {
    clearState(dir);
    console.log('Aucun serveur AgentClass lancé.');
  } else {
    const r = await fetch(`http://127.0.0.1:${s.port}/shutdown?t=${s.token}`, { method: 'POST' }).catch(() => null);
    console.log(r?.status === 204 ? 'Serveur arrêté.' : `Arrêt refusé ou serveur muet. PID ${s.pid} à arrêter à la main.`);
    if (!r) process.exitCode = 1;
  }
} else if (cmd === 'demo') {
  // La démo n'utilise pas server.json : elle peut tourner à côté du vrai serveur.
  const srv = await serve({ demo: true, port: port + 10 });
  console.log(`AgentClass (démo) : ${srv.url}
Ferme cette fenêtre pour arrêter la démo.`);
  if (process.argv.includes('--open')) openBrowser(srv.url);
} else if (cmd === 'start') {
  const s = running(dir);
  if (s) {
    console.log(`AgentClass tourne déjà : ${s.url}`);
  } else {
    let owner = false;
    const srv = await serve({ port, onClose: () => owner && clearState(dir) });
    const state = { port: srv.port, pid: process.pid, token: srv.token, url: srv.url, startedAt: new Date().toISOString() };
    // server.json périmé (PID mort) : on l'efface juste avant de réessayer, jamais avant.
    // ponytail: PID réutilisé après un crash = faux « tourne déjà » ; sonde HTTP au lot 5 si besoin.
    let won = writeState(dir, state);
    if (!won && !running(dir)) {
      clearState(dir);
      won = writeState(dir, state);
    }
    if (!won) {
      // Un autre démarrage a gagné la course : on lui laisse la place.
      await srv.close();
      console.log(`AgentClass tourne déjà : ${running(dir)?.url ?? ''}`);
    } else {
      owner = true;
      const quit = () => srv.close().then(() => process.exit(0));
      process.on('SIGINT', quit);
      process.on('SIGTERM', quit);
      console.log(`AgentClass : ${srv.url}`);
    }
  }
} else if (cmd === 'open') {
  // Lance le serveur en arrière-plan s'il ne tourne pas, puis ouvre la salle.
  const { url, started } = await ensureServer(dir, { wait: 4000 });
  console.log(`${started ? 'Serveur lancé' : 'Serveur déjà lancé'} : ${url}`);
  openBrowser(url);
} else if (cmd === 'reset-token') {
  config(dir, { reset: true });
  console.log('Nouveau lien créé. Relance le serveur : agentclass stop puis agentclass start.');
} else {
  console.log('Usage : agentclass [open|start|demo|stop|reset-token]');
  process.exitCode = 1;
}
