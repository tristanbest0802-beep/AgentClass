#!/usr/bin/env node
// CLI : agentclass [start|demo|stop]
import { clearState, home, running, serve, writeState } from '../server/server.mjs';

const cmd = process.argv[2] ?? 'start';
const port = Number(process.env.AGENTCLASS_PORT) || 47100;
const dir = home();

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
  console.log(`AgentClass (démo) : ${srv.url}`);
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
} else {
  console.log('Usage : agentclass [start|demo|stop]');
  process.exitCode = 1;
}
