// Lot 1 : liste brute des événements en direct. La salle arrive au lot 2.
const token = new URLSearchParams(location.search).get('t') ?? '';
const status = /** @type {HTMLElement} */ (document.getElementById('status'));
const table = /** @type {HTMLTableElement} */ (document.getElementById('log'));
const empty = /** @type {HTMLElement} */ (document.getElementById('empty'));
const body = /** @type {HTMLTableSectionElement} */ (table.tBodies[0]);
const MAX_ROWS = 300;

const LABELS = /** @type {Record<string, string>} */ ({
  session_start: 'session', agent_start: 'agent arrive', agent_stop: 'agent part', tool_call: 'aller', tool_result: 'retour',
});

/** @param {any} ev */
function row(ev) {
  const tr = document.createElement('tr');
  if (ev.ok === false) tr.dataset.ok = 'false';
  const cells = [
    new Date(ev.ts).toLocaleTimeString(),
    String(ev.session).slice(0, 8),
    ev.agent === 'main' ? 'principal' : `${ev.agentType ?? 'agent'} ${String(ev.agent).slice(0, 6)}`,
    (LABELS[ev.kind] ?? ev.kind) + (ev.ok === false ? ' (échec)' : ''),
    ev.tool ?? '',
    ev.target ?? '',
    ev.ms != null ? `${ev.ms} ms` : '',
  ];
  for (const c of cells) tr.insertCell().textContent = c;
  return tr;
}

const es = new EventSource(`/events?t=${encodeURIComponent(token)}`);
es.onopen = () => { status.textContent = 'En direct'; delete status.dataset.state; };
es.onerror = () => { status.textContent = 'Connexion perdue, nouvel essai…'; status.dataset.state = 'error'; };
es.onmessage = (m) => {
  table.hidden = false;
  empty.hidden = true;
  body.prepend(row(JSON.parse(m.data)));
  while (body.rows.length > MAX_ROWS) body.deleteRow(-1);
};
