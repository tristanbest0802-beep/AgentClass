// Agents connus d'une IA : lecture des définitions (front matter des fichiers .md),
// et nom affiché. Si le nom est absent ou générique (worker-1, general-purpose…),
// on affiche un métier déduit de la description, par mots-clés, sans appel d'IA.
import { readFileSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, join } from 'node:path';

// Ordre important : la première règle qui correspond l'emporte (du plus précis au plus large).
/** @type {Array<[RegExp, string, string]>} */
const JOBS = [
  [/general purpose|multi step/, 'Assistant polyvalent', 'All-rounder'],
  [/\ba11y|accessib|wcag/, 'Expert accessibilité', 'Accessibility expert'],
  [/secur|vuln|pentest|threat|owasp|sanitiz/, 'Auditeur sécurité', 'Security auditor'],
  [/motion|animat/, 'Motion designer', 'Motion designer'],
  [/video|montage|footage/, 'Monteur vidéo', 'Video editor'],
  [/translat|locali[sz]/, 'Traducteur', 'Translator'],
  [/perf|optimi|bottleneck|latency/, 'Optimiseur', 'Optimizer'],
  [/review|critique|evaluat|grader|audit/, 'Relecteur', 'Reviewer'],
  [/architect|system design/, 'Architecte', 'Architect'],
  [/design|\bui\b|\bux\b|figma|visual|interface|frontend/, 'Designer', 'Designer'],
  [/plan|roadmap|spec\b|specification/, 'Chef de projet', 'Planner'],
  [/\btest|\bqa\b|e2e|coverage|verif|\btdd\b/, 'Testeur', 'Tester'],
  [/build[- ]?(error|fail)|resolver|debug|troubleshoot|rescue|\bfix/, 'Dépanneur', 'Troubleshooter'],
  [/chief of staff|inbox|email|slack|triage/, 'Secrétaire', 'Assistant'],
  [/lookup|librar/, 'Documentaliste', 'Librarian'],
  [/marketing|outreach|sales|lead|prospect|campaign/, 'Commercial', 'Sales rep'],
  [/\bdocs?\b|document|readme|codemap|writer|writing|copy|redact|blog|article/, 'Écrivain', 'Writer'],
  [/simplif|refactor|clean ?up/, 'Menuisier du code', 'Refactorer'],
  [/database|\bsql\b|postgres|schema|\bdata\b/, 'Analyste de données', 'Data analyst'],
  [/network|router|dns\b/, 'Ingénieur réseau', 'Network engineer'],
  [/machine learning|\bml\b|pytorch|training|\brag\b/, 'Ingénieur IA', 'ML engineer'],
  [/devops|deploy|\bci\b|pipeline|infra|docker|kubernetes/, 'Ingénieur DevOps', 'DevOps engineer'],
  [/explor|search|investigat|research|lookup|locat|analy[sz]/, 'Enquêteur', 'Investigator'],
  [/build|implement|generat|coder|develop|edit/, 'Développeur', 'Developer'],
  [/status ?line|config|setup|install/, 'Technicien', 'Technician'],
  [/guide|help|question/, 'Guide', 'Guide'],
];
const GENERIC = /^(worker|agent|subagent|assistant|helper|bot|task|default|general[- ]purpose|claude)([-_ ]?\d+)?$/i;

/**
 * Métier déduit du nom puis de la description.
 * @param {string} name @param {string} [description]
 * @returns {{ fr: string, en: string }}
 */
export function jobTitle(name, description = '') {
  for (const text of GENERIC.test(name) ? [description] : [name, description]) {
    const t = text.toLowerCase().replace(/[-_]/g, ' ');
    for (const [re, fr, en] of JOBS) if (re.test(t)) return { fr, en };
  }
  return { fr: 'Assistant polyvalent', en: 'All-rounder' };
}

/**
 * Nom affiché : le vrai nom s'il dit quelque chose, sinon le métier.
 * @param {{ name: string, description?: string }} a @param {'fr' | 'en'} [lang]
 */
export function displayName(a, lang = 'fr') {
  const short = a.name.split(':').pop() ?? a.name;
  return GENERIC.test(short) ? jobTitle(short, a.description)[lang] : short;
}

/**
 * Lit le front matter YAML simple d'un fichier d'agent (name, description,
 * y compris les blocs `>` et `|` sur plusieurs lignes).
 * @param {string} text @param {string} file
 * @returns {{ name: string, description: string }}
 */
export function parseAgent(text, file) {
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text)?.[1] ?? '';
  /** @type {Record<string, string>} */
  const out = {};
  const lines = fm.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = /^(name|description):\s*(.*)$/.exec(lines[i]);
    if (!m) continue;
    let v = m[2].trim();
    if (/^[>|][-+]?$/.test(v)) {
      const block = [];
      while (i + 1 < lines.length && /^\s+\S|^\s*$/.test(lines[i + 1])) block.push(lines[++i].trim());
      v = block.join(' ').trim();
    }
    out[m[1]] = v.replace(/^["']|["']$/g, '');
  }
  return { name: out.name || basename(file, '.md'), description: (out.description || '').slice(0, 160) };
}

// Agents intégrés à Claude Code : pas de fichier, toujours présents.
const BUILTIN = [
  ['general-purpose', 'General-purpose agent for researching complex questions and multi-step tasks'],
  ['Explore', 'Read-only search agent for broad searches across the codebase'],
  ['Plan', 'Software architect agent for designing implementation plans'],
  ['statusline-setup', 'Configures the Claude Code status line setting'],
  ['claude-code-guide', 'Answers questions about Claude Code, the Agent SDK and the API'],
];

/** @param {string} dir @param {string} [prefix] */
function readDir(dir, prefix = '') {
  try {
    return readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => {
      const a = parseAgent(readFileSync(join(dir, f), 'utf8'), f);
      return { id: prefix + a.name, ...a };
    });
  } catch {
    return [];
  }
}

/**
 * Agents de Claude Code : intégrés, ceux de l'utilisateur, du projet et des plugins activés.
 * @param {{ claudeHome?: string, project?: string }} [opts]
 * @returns {Array<{ id: string, name: string, description: string, origin: string }>}
 */
export function claudeAgents({ claudeHome = join(homedir(), '.claude'), project } = {}) {
  const list = BUILTIN.map(([name, description]) => ({ id: name, name, description, origin: 'builtin' }));
  list.push(...readDir(join(claudeHome, 'agents')).map((a) => ({ ...a, origin: 'user' })));
  if (project) list.push(...readDir(join(project, '.claude', 'agents')).map((a) => ({ ...a, origin: 'project' })));
  try {
    const enabled = JSON.parse(readFileSync(join(claudeHome, 'settings.json'), 'utf8')).enabledPlugins ?? {};
    const installed = JSON.parse(readFileSync(join(claudeHome, 'plugins', 'installed_plugins.json'), 'utf8')).plugins ?? {};
    for (const [key, on] of Object.entries(enabled)) {
      const path = on && installed[key]?.[0]?.installPath;
      if (path) list.push(...readDir(join(path, 'agents'), `${key.split('@')[0]}:`).map((a) => ({ ...a, origin: 'plugin' })));
    }
  } catch {
    // Pas de réglages lisibles : on garde ce qu'on a.
  }
  const seen = new Set();
  return list.filter((a) => !seen.has(a.id) && seen.add(a.id));
}
