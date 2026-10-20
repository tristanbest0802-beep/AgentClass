// Mode démo : rejoue en boucle un scénario factice (principal, deux sous-agents
// en parallèle, une lecture en boucle, un échec) pour développer l'interface
// sans lancer Claude.

const PROJECT = '/home/demo/boutique';

/**
 * Étapes du scénario : [délai en ms, agent, action, outil?, cible?, ok?]
 * @type {Array<[number, string, string, string?, string?, boolean?]>}
 */
const SCRIPT = [
  [0, 'main', 'session_start'],
  [600, 'main', 'tool', 'Read', 'package.json'],
  [900, 'main', 'tool', 'Grep', 'src'],
  [900, 'main', 'tool', 'Bash', 'graphify query'],
  [700, 'main', 'call', 'Agent'],
  [300, 'explore', 'agent_start'],
  [100, 'reviewer', 'agent_start'],
  [500, 'explore', 'tool', 'Read', 'src/cart.js'],
  [300, 'reviewer', 'tool', 'Read', 'src/api/orders.js'],
  [600, 'explore', 'tool', 'Read', 'src/app.js'],
  [400, 'reviewer', 'tool', 'Grep', 'src/api'],
  [500, 'explore', 'tool', 'Read', 'src/cart.js'],
  [500, 'reviewer', 'tool', 'Read', 'test/cart.test.js', false],
  [500, 'explore', 'tool', 'Read', 'src/cart.js'],
  [600, 'explore', 'tool', 'Read', 'src/cart.js'],
  [500, 'reviewer', 'agent_stop'],
  [700, 'explore', 'agent_stop'],
  [200, 'main', 'result', 'Agent'],
  [800, 'main', 'tool', 'Edit', 'src/cart.js'],
  [900, 'main', 'tool', 'Edit', 'src/ui/Button.jsx'],
  [900, 'main', 'tool', 'Bash'],
];

const TYPES = /** @type {Record<string, string>} */ ({ explore: 'Explore', reviewer: 'code-reviewer' });

/**
 * Lance la démo. Rend une fonction d'arrêt.
 * @param {(ev: any) => void} emit
 */
export function startDemo(emit) {
  let round = 0;
  let n = 0;
  /** @type {ReturnType<typeof setTimeout> | undefined} */
  let timer;
  /** @type {string | undefined} */
  let agentCall;

  /** @param {string} agent @param {Record<string, unknown>} rest */
  const ev = (agent, rest) => {
    const e = { v: 1, ts: new Date().toISOString(), source: 'claude', session: `demo-${round}`, agent: agent === 'main' ? 'main' : `${agent}-${round}`, project: PROJECT, ...rest };
    if (TYPES[agent]) e.agentType = TYPES[agent];
    emit(e);
  };

  const run = (/** @type {number} */ i) => {
    if (i >= SCRIPT.length) { round++; timer = setTimeout(() => run(0), 4000); return; }
    const [delay, agent, action, tool, target, ok = true] = SCRIPT[i];
    timer = setTimeout(() => {
      if (action === 'session_start' || action === 'agent_start' || action === 'agent_stop') ev(agent, { kind: action });
      else if (action === 'call') ev(agent, { kind: 'tool_call', tool, call: (agentCall = `demo-${++n}`) });
      else if (action === 'result') ev(agent, { kind: 'tool_result', tool, call: agentCall, ok: true });
      else {
        const call = `demo-${++n}`;
        ev(agent, { kind: 'tool_call', tool, target, call });
        const ms = 150 + Math.round(Math.random() * 500);
        setTimeout(() => ev(agent, { kind: 'tool_result', tool, target, call, ok, ms }), ms);
      }
      run(i + 1);
    }, delay);
  };

  run(0);
  return () => clearTimeout(timer);
}
