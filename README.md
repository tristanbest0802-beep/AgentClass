<div align="center">

<!-- Logo à venir : assets/logo.png -->

# AgentClass

**Vois en direct ce que font tes agents IA, sans consommer un seul token.**

Une salle de classe animée, sur ton ordinateur : chaque agent a sa chaise,
l'agent principal tient le bureau du prof, et le tableau montre en temps réel
quels fichiers l'IA va chercher. Pour Claude Code d'abord, Codex ensuite.

<!-- GIF de démo à venir : docs/promo/demo.gif -->

![Statut](https://img.shields.io/badge/statut-alpha%20%C2%B7%20lot%200-2F4A3F?style=flat-square)
![Tokens](https://img.shields.io/badge/tokens%20consomm%C3%A9s-0-30A46C?style=flat-square)
![Node](https://img.shields.io/badge/node-%E2%89%A5%2020-2F4A3F?style=flat-square&logo=nodedotjs&logoColor=F2F0E9)
![IA](https://img.shields.io/badge/IA-Claude%20Code%20%C2%B7%20Codex%20(pr%C3%A9vu)-2F4A3F?style=flat-square)
![Licence](https://img.shields.io/badge/licence-MIT-2F4A3F?style=flat-square)

</div>

---

> **Projet en alpha.** Seul le lot 0 existe : le hook qui capte les événements
> de Claude Code. La salle de classe arrive dans les lots suivants (voir la
> [feuille de route](#feuille-de-route)). Ne l'installe pas encore pour un
> usage quotidien.

### En 30 secondes

- **Le problème** : quand une IA de code lance des sous-agents, tu ne vois pas qui travaille, sur quoi, ni si ça avance ou si ça tourne en boucle.
- **La solution** : AgentClass dessine une salle de classe en direct. Les agents s'allument sur leur chaise, et un point part vers chaque fichier lu puis revient quand le résultat arrive.
- **Zéro token** : aucun appel à un modèle. AgentClass lit seulement des événements écrits sur ton disque par les hooks.
- **100 % local** : serveur sur `127.0.0.1`, aucun compte, aucune télémétrie, aucun appel réseau sortant.

### In 30 seconds

- **The problem**: when a coding AI spawns subagents, you can't see who is working, on what, or whether it's progressing or looping.
- **The fix**: AgentClass draws a live classroom. Agents light up at their desks, and a dot travels to every file being read, then comes back with the result.
- **Zero tokens**: no model calls. AgentClass only reads events that hooks write to your disk.
- **100% local**: server on `127.0.0.1`, no account, no telemetry, no outbound network calls.

---

## Sommaire

1. [Présentation](#présentation)
2. [Fonctionnalités](#fonctionnalités)
3. [Prérequis](#prérequis)
4. [Installation](#installation)
5. [Premier démarrage](#premier-démarrage)
6. [Guide d'utilisation](#guide-dutilisation)
   - [La salle de classe](#la-salle-de-classe)
   - [Le bureau du prof](#le-bureau-du-prof)
   - [Le tableau](#le-tableau)
   - [Sessions et onglets](#sessions-et-onglets)
   - [Mode stream](#mode-stream)
   - [Réglages](#réglages)
7. [Configuration avancée](#configuration-avancée)
8. [Données, sécurité et confidentialité](#données-sécurité-et-confidentialité)
9. [Performances](#performances)
10. [Dépannage](#dépannage)
11. [Développement](#développement)
12. [Architecture](#architecture)
13. [Feuille de route](#feuille-de-route)
14. [Traductions](#traductions)
15. [Limites connues](#limites-connues)
16. [Licence et marques](#licence-et-marques)

---

## Présentation

AgentClass est un tableau de bord local pour les IA de code qui travaillent
avec plusieurs agents. Il prend la forme d'une salle de classe :

- **les chaises** sont les agents que tu as définis (tes sous-agents et ceux
  de tes plugins). Une chaise s'ajoute quand un nouvel agent apparaît ;
- **le bureau du prof** est l'agent principal, celui qui distribue le
  travail. Un petit écran posé dessus montre le logo de l'IA en cours ;
- **le tableau** montre le projet : la liste des fichiers touchés, ou le
  graphe de connaissance [Graphify](#le-tableau) si ton projet en a un.

Quand l'IA va chercher une information, un **point rouge** part du nœud
« IA » vers le fichier visé. Quand le résultat revient, il repart en
**vert** jusqu'à l'IA.

AgentClass regarde seulement : il ne donne aucun ordre à l'IA, ne lit pas
tes prompts et ne stocke ni le contenu de tes fichiers ni la sortie des
outils.

### Comment ça marche

```
  Claude Code               Disque local                    Navigateur
  ───────────               ────────────                    ──────────
  hooks (SessionStart, ───► ~/.agentclass/events/     ───►  serveur 127.0.0.1
  PreToolUse, Post…)        claude-AAAA-MM-JJ.jsonl         flux SSE + jeton
  hook.mjs, 1 ligne                                         └► salle de classe
  par événement             ~/.codex/sessions/*.jsonl ───►     (onglet par
                            (Codex, lu tel quel)                session)
```

1. **Capture** (`hooks/hook.mjs`). Claude Code lance le hook à chaque
   événement utile. Le hook garde le strict minimum (type d'événement,
   outil, chemin relatif du fichier, identifiants), écrit une ligne JSONL
   et rend la main. Il n'écrit **jamais** sur la sortie standard : un texte
   renvoyé à Claude Code pourrait entrer dans le contexte et coûter des
   tokens.
2. **Lecture** (`server/`, lot 1). Un petit serveur Node suit les fichiers
   d'événements, les convertit dans un format commun à toutes les IA et les
   pousse au navigateur en temps réel (Server-Sent Events).
3. **Affichage** (`web/`, lots 2 à 4). Une page HTML, CSS et JavaScript, sans
   framework ni étape de build, dessine la salle et anime les points.

Pourquoi zéro token ? Parce que rien, dans cette chaîne, n'appelle un modèle.
Les hooks sont des commandes locales exécutées par Claude Code lui-même.

---

## Fonctionnalités

| Fonctionnalité | État |
|---|---|
| Capture des événements Claude Code (hooks) | **Prêt** (lot 0) |
| Mesure de la latence du hook | **Prêt** (lot 0) |
| Serveur local sécurisé, flux en direct, mode démo | Prévu (lot 1) |
| Salle avec chaises et bureau du prof | Prévu (lot 2) |
| Durée par agent, alerte de boucle (même fichier lu N fois) | Prévu (lot 2) |
| Une salle par session, avec des onglets | Prévu (lot 2) |
| Tableau : fichiers touchés, puis graphe Graphify avec points | Prévu (lot 3) |
| Mode stream qui masque les chemins | Prévu (lot 4) |
| Vue isométrique, français et anglais, thèmes clair et sombre | Prévu (lot 4) |
| Démarrage automatique, purge à 7 jours, désinstallation propre | Prévu (lot 5) |
| Installation par la marketplace de plugins Claude et par npm | Prévu (lot 6) |
| Icône dans l'application Claude desktop | Prévu (lot 7) |
| Codex | Prévu (lot 8) |
| Autres IA, overlay OBS | Plus tard |

Le détail de chaque lot est dans [docs/06-PLAN.md](docs/06-PLAN.md).

---

## Prérequis

- **Node.js 20 ou plus récent** (testé avec Node 24 sous Windows 11).
- **Claude Code** (CLI, extension IDE ou application desktop).
- Facultatif : **Graphify**, pour afficher le graphe du projet sur le tableau.
- Facultatif, plus tard : **Codex**.

Systèmes : Windows 11 en priorité. macOS et Linux sont visés, mais pas encore
testés.

---

## Installation

### Option A : marketplace de plugins Claude (lot 6)

Pas encore disponible.

### Option B : depuis les sources (alpha)

```bash
git clone https://github.com/<ton-compte>/AgentClass.git
cd AgentClass
npm test
```

AgentClass n'a **aucune dépendance** à installer : pas de `npm install`
nécessaire.

Pour essayer le hook sur ce dépôt seulement, crée
`.claude/settings.local.json` (le fichier est ignoré par Git) :

```json
{
  "hooks": {
    "SessionStart":  [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/hook.mjs\"" }] }],
    "SubagentStart": [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/hook.mjs\"" }] }],
    "SubagentStop":  [{ "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/hook.mjs\"" }] }],
    "PreToolUse":    [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/hook.mjs\"" }] }],
    "PostToolUse":   [{ "matcher": "*", "hooks": [{ "type": "command", "command": "node \"$CLAUDE_PROJECT_DIR/hooks/hook.mjs\"" }] }]
  }
}
```

Pour l'activer sur tous tes projets, tu peux charger le dossier comme plugin :
le manifeste est dans `.claude-plugin/plugin.json` et les hooks dans
`hooks/hooks.json`.

### Option C : npm pour Codex (lot 8)

Pas encore disponible.

---

## Premier démarrage

### 1. Ouvrir une nouvelle session

Claude Code charge les hooks au démarrage d'une session. Ouvre donc une
**nouvelle** session dans un projet où les hooks sont actifs.

### 2. Faire travailler l'IA

Demande une tâche qui lit quelques fichiers et lance au moins un sous-agent.

### 3. Vérifier la capture

```bash
tail -n 5 ~/.agentclass/events/claude-*.jsonl
```

Chaque ligne est un événement. Exemple :

```json
{"v":1,"ts":"2026-10-20T10:00:00.000Z","source":"claude","session":"…","agent":"main","kind":"tool_call","project":"…","call":"toolu_…","tool":"Read","target":"src/app.js"}
```

À partir du lot 1, une commande ouvrira directement la salle dans ton
navigateur.

---

## Guide d'utilisation

> Cette partie décrit l'interface prévue. Elle sera mise à jour à chaque lot.

### La salle de classe

- Chaque **chaise** représente un agent connu : tes agents de
  `~/.claude/agents/`, ceux de tes plugins, et ceux vus pendant la session.
- Une chaise **s'allume** quand son agent démarre, et s'éteint quand il a
  fini. La durée de travail s'affiche à côté.
- Un **badge d'alerte** apparaît quand un agent lit le même fichier trop
  souvent : signe possible d'une boucle.
- **Clic sur une chaise** : panneau avec le nom de l'agent, sa description,
  son état, sa durée et son dernier outil.

### Le bureau du prof

L'agent principal est assis au bureau. Son petit écran affiche le logo de
l'IA qui tourne (Claude ou Codex). Sans session active, le prof dort et la
salle affiche « En attente de l'IA ».

### Le tableau

- **Sans Graphify** : le tableau liste les fichiers touchés pendant la
  session. Il reste utile sans rien installer.
- **Avec Graphify** (`graphify-out/graph.json` dans ton projet) : le tableau
  affiche le graphe. Un **point rouge** (rond avec une flèche) part du nœud
  « IA » vers le fichier lu, cherché ou interrogé (`Read`, `Grep`,
  `graphify query`). Au résultat, il revient en **vert** (losange avec une
  coche). Les formes s'ajoutent aux couleurs pour rester lisibles par les
  personnes daltoniennes.
- Un fichier absent du graphe envoie le point vers une zone « hors graphe ».
- **Clic sur un nœud** : nom du fichier.

### Sessions et onglets

Chaque session ouverte a sa propre salle, dans un onglet en haut de la page.
Tu peux lancer plusieurs sessions en parallèle et passer de l'une à l'autre.

### Mode stream

Pensé pour les lives : il masque les chemins complets et n'affiche que le nom
des fichiers. Les prompts, eux, ne sont jamais affichés, mode stream ou non.

### Réglages

Thème clair ou sombre, langue (français ou anglais), vitesse des animations.
Les animations respectent le réglage système « réduire les animations ».

---

## Configuration avancée

| Variable | Rôle | Défaut |
|---|---|---|
| `AGENTCLASS_HOME` | Dossier des données | `~/.agentclass` |
| `AGENTCLASS_OFF` | Désactive le hook sans le désinstaller (toute valeur non vide) | non défini |
| `AGENTCLASS_PORT` | Port du serveur local (lot 1) | à fixer |

---

## Données, sécurité et confidentialité

### Où vivent tes données

| Emplacement | Contenu |
|---|---|
| `~/.agentclass/events/claude-AAAA-MM-JJ.jsonl` | Un événement par ligne, un fichier par jour |
| `~/.agentclass/server.json` (lot 1) | Port, PID et jeton du serveur |
| `~/.codex/sessions/` | Lu par AgentClass, jamais modifié |
| `localStorage` du navigateur | Tes réglages d'affichage |

### Ce qui est stocké, et ce qui ne l'est jamais

| Stocké | Jamais stocké |
|---|---|
| Type d'événement, horodatage | Texte des prompts |
| Nom de l'outil (`Read`, `Grep`…) | Contenu des fichiers |
| Chemin du fichier, relatif au projet (200 caractères au plus) | Sortie des outils |
| Identifiants de session, d'agent et d'appel | Commandes `Bash` (seul `graphify query` est reconnu, sans sa question) |
| Dossier du projet | Arguments de recherche |

Pendant l'alpha, chaque ligne contient aussi les **noms** des champs reçus
par le hook (sans leurs valeurs), pour découvrir le format exact de Claude
Code. Ce champ `keys` sera retiré après le lot 0.

### Réseau

- Aucun appel réseau sortant. Aucune télémétrie.
- Le serveur écoute seulement sur `127.0.0.1`.
- Une page web ouverte dans ton navigateur peut tenter de joindre un port
  local. Le serveur s'en protège : jeton aléatoire à chaque démarrage,
  vérification des en-têtes `Host` et `Origin`, aucun en-tête CORS.

### Purge

À partir du lot 5, les fichiers d'événements de plus de 7 jours sont
supprimés au démarrage du serveur. Tu peux aussi supprimer `~/.agentclass`
à tout moment.

---

## Performances

Le hook démarre un processus Node à chaque événement. Mesure sous Windows 11
et Node 24, sur 50 appels :

| Médiane | p90 | Max |
|---|---|---|
| 55 ms | 59 ms | 60 ms |

Soit environ 110 ms en plus par outil (un aller et un retour). Pour mesurer
sur ta machine :

```bash
npm run bench:hook
```

---

## Dépannage

### Aucun événement n'est écrit

- Les hooks se chargent au **démarrage** de la session : ouvre une nouvelle
  session après avoir changé la configuration.
- Vérifie que `node` est dans le `PATH` du shell utilisé par Claude Code.
- Vérifie que `AGENTCLASS_OFF` n'est pas défini.
- Lance le hook à la main :

  ```bash
  echo '{"hook_event_name":"SessionStart","session_id":"test"}' | node hooks/hook.mjs
  ```

  Une ligne doit apparaître dans `~/.agentclass/events/`.

### Claude Code semble plus lent

Mesure le hook avec `npm run bench:hook`. Si la médiane dépasse nettement
100 ms, ouvre une issue avec le résultat et ta configuration.

### Le hook affiche une erreur

Il ne doit jamais rien afficher ni sortir avec un code différent de 0. Si
c'est le cas, c'est un bug : ouvre une issue.

### Signaler un bug

Ouvre une issue avec ton système, ta version de Node et de Claude Code, et
quelques lignes de ton JSONL. Relis-les avant : elles contiennent des
chemins de fichiers.

---

## Développement

```bash
npm test             # tests (node:test, aucune dépendance)
npm run bench:hook   # latence du hook
```

Règles du projet (voir aussi [CLAUDE.md](CLAUDE.md)) :

- **0 token** : aucun hook n'écrit sur la sortie standard ni n'injecte de
  contexte. Le hook sort toujours avec le code 0.
- **Données minimales** : jamais de prompt, de contenu de fichier ni de
  sortie d'outil.
- **Sans build** : JavaScript en modules ES, typé avec JSDoc.
- **Lot par lot**, dans l'ordre de [docs/06-PLAN.md](docs/06-PLAN.md).

### Tests

Les tests couvrent la réduction des événements (chemins Unix et Windows,
reconnaissance de `graphify`, absence de contenu sensible) et le
comportement du processus (entrée invalide, sortie silencieuse, fichier du
jour, désactivation).

### Documents de conception

| Document | Contenu |
|---|---|
| [01-PRD](docs/01-PRD.md) | Produit, fonctionnalités, critères de réussite |
| [02-TRD](docs/02-TRD.md) | Technique, architecture, risques |
| [03-APP-FLOW](docs/03-APP-FLOW.md) | Écrans, parcours, états |
| [04-UI-BRIEF](docs/04-UI-BRIEF.md) | Direction visuelle, palette, typographie |
| [05-SCHEMA](docs/05-SCHEMA.md) | Format des événements et des données |
| [06-PLAN](docs/06-PLAN.md) | Plan d'implémentation lot par lot |

---

## Architecture

```
AgentClass/
├── .claude-plugin/plugin.json   manifeste du plugin Claude Code
├── hooks/
│   ├── hook.mjs                 capture des événements (lot 0)
│   └── hooks.json               branchement des hooks du plugin
├── scripts/bench-hook.mjs       mesure de latence
├── test/                        tests node:test et fixtures
├── docs/                        documents de conception
├── server/                      serveur local et lecteurs (lot 1)
├── web/                         page de la salle (lots 2 à 4)
├── bin/                         commande agentclass (lot 1)
└── mod/                         icône Claude desktop (lot 7)
```

### Format commun des événements

Toutes les IA passent par le même format. Ajouter une IA revient donc à
écrire un adaptateur.

| Champ | Exemple | Rôle |
|---|---|---|
| `v` | `1` | Version du format |
| `ts` | `2026-10-20T10:00:00.000Z` | Horodatage |
| `source` | `claude`, `codex` | IA d'origine |
| `session` | `…` | Session |
| `agent` | `main`, identifiant de sous-agent | Qui agit |
| `kind` | `session_start`, `agent_start`, `agent_stop`, `tool_call`, `tool_result` | Type |
| `call` | `toolu_…` | Relie l'aller et le retour |
| `tool` | `Read` | Outil |
| `target` | `src/app.js` | Fichier visé |
| `ok` | `true` | Résultat réussi ou non |

Détail complet : [docs/05-SCHEMA.md](docs/05-SCHEMA.md).

---

## Feuille de route

| Lot | Contenu | État |
|---|---|---|
| 0 | Squelette, hook, mesure de latence, capture réelle | En cours |
| 1 | Serveur local sécurisé, flux brut, mode démo | À faire |
| 2 | Salle à plat : chaises, prof, indicateurs, onglets | À faire |
| 3 | Tableau : fichiers touchés, Graphify, points | À faire |
| 4 | Mode stream, isométrique, FR/EN, thèmes, accessibilité | À faire |
| 5 | Démarrage auto, purge, désinstallation, alpha publique | À faire |
| 6 | Marketplace Claude et npm | À faire |
| 7 | Icône dans Claude desktop | À faire |
| 8 | Adaptateur Codex | À faire |
| Plus tard | Gemini CLI, Cursor, Aider, OpenCode ; overlay OBS ; statistiques locales | Idées |

---

## Traductions

L'interface sera disponible en **français** et en **anglais**, avec une
bascule. Les textes seront regroupés dans `web/i18n/` pour faciliter
l'ajout d'autres langues.

---

## Limites connues

- **Alpha** : seul le hook existe pour l'instant.
- Le format exact des événements de Claude Code est en cours de vérification
  (présence de `tool_use_id` et de l'identifiant des sous-agents).
- Le format des sessions Codex n'est pas documenté officiellement et peut
  changer.
- L'icône dans Claude desktop dépend de ce que l'application permet. Si
  elle n'est pas possible, une commande ouvrira la salle.
- Une commande `Grep` sans chemin ne vise aucun fichier précis : elle
  n'envoie pas de point vers un nœud.
- Testé seulement sous Windows 11 pour l'instant.

---

## Licence et marques

Code sous licence [MIT](LICENSE).

Claude et Claude Code sont des marques d'Anthropic. ChatGPT et Codex sont des
marques d'OpenAI. Graphify appartient à ses auteurs. AgentClass est un
projet indépendant, sans lien avec ces entreprises. Les logos des IA ne
seront utilisés que dans le respect de leurs règles de marque.
