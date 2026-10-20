# PRD : AgentClass
Date : 2026-10-20 · Statut : brouillon

## Résumé
AgentClass est un tableau de bord local, en forme de salle de classe, qui montre en direct ce que font une IA de code et ses agents. Il sert d'abord à son auteur, puis à tout utilisateur de Claude Code ou de Codex. Il ne consomme aucun token : il lit seulement des événements locaux.

Accroche du README : « Vois en direct ce que font tes agents IA, sans consommer un seul token. »

## Problème
Quand une IA de code travaille avec des sous-agents, on ne voit pas d'un coup d'œil qui travaille, sur quoi, ni si le travail avance ou tourne en boucle. Les outils qui existent coûtent des tokens ou restent textuels.

## Utilisateurs cibles
- D'abord : l'auteur (dev, streamer, Windows 11, Claude Code et Codex).
- Ensuite : les utilisateurs de Claude Code ou de Codex, dont les streamers.

## Objectif et critères de réussite
- 0 token consommé. Plafond toléré : 500 tokens par 30 minutes. Aucun hook n'injecte de contexte.
- Pendant une vraie session avec 2 sous-agents, chaque agent actif s'allume en moins d'une seconde.
- Chaque lecture de fichier, Grep ou `graphify query` produit un aller (rouge) et un retour (vert) appariés, sans point bloqué en rouge.
- Les hooks n'ajoutent pas de latence sensible à Claude Code. Seuil à fixer après la mesure du lot 0.
- Le mode stream masqué ne laisse passer aucun chemin complet.

## Fonctionnalités de la première version
| # | Fonctionnalité | Description | Critère d'acceptation |
|---|---|---|---|
| F1 | Capture des événements | Hooks Claude Code (SessionStart, PreToolUse, PostToolUse, SubagentStart, SubagentStop) qui écrivent un JSONL local réduit au minimum | Une vraie session produit un JSONL lisible. Le hook sort toujours en 0 et n'écrit rien sur stdout. |
| F2 | Serveur local | Node sur 127.0.0.1, flux SSE, jeton aléatoire, vérification de `Host` et `Origin`, port configurable, fichier PID, arrêt propre | Une page d'un autre site ne peut pas lire le flux. Un deuxième lancement ne crée pas de doublon. |
| F3 | Mode démo | `--demo` rejoue des événements factices | L'interface se développe sans lancer Claude. |
| F4 | Salle et chaises | Une chaise par agent connu ; l'agent s'allume quand il est actif | Les chaises s'ajoutent quand un agent apparaît. L'agent s'allume au SubagentStart et s'éteint au SubagentStop. |
| F5 | Bureau du prof | Agent principal, avec un petit écran qui montre le logo de l'IA source | Le logo change selon la source (Claude ou Codex). |
| F6 | Indicateurs | Durée par agent ; alerte de boucle quand un même fichier est lu N fois | L'alerte s'affiche dans le cas de test. |
| F7 | Tableau | Liste des fichiers touchés par défaut ; graphe Graphify en option, avec un point rouge à l'aller et vert au retour | Sans `graph.json`, le tableau reste utile. Avec, les points vont vers le bon nœud ou vers une zone « hors graphe ». |
| F8 | Clics | Clic sur une chaise : panneau de l'agent. Clic sur un nœud : nom du fichier. | Les panneaux s'ouvrent et se ferment au clavier. |
| F9 | Sessions | Une salle par session, avec des onglets | Deux sessions en parallèle, deux onglets. |
| F10 | Mode stream masqué | Cache les chemins (nom de fichier seul ou alias) | Aucun chemin complet à l'écran quand le mode est actif. |
| F11 | Habillage | Rendu isométrique, FR/EN avec bascule, thèmes clair et sombre, réglage de la vitesse des animations | Tout marche à 375 px, sur tablette et sur ordinateur, dans les deux thèmes. |
| F12 | Démarrage auto et cycle de vie | Démarrage au SessionStart avec un verrou, purge du JSONL au-delà de 7 jours, désinstallation propre | Pas de serveur en double. La désinstallation retire nos hooks et laisse ceux des autres. |
| F13 | Adaptateur Codex | Lecture de `~/.codex/sessions/*.jsonl` vers le format commun | Une session Codex s'affiche (au minimum le prof et le tableau). |
| F14 | Icône Claude desktop | Bouton ou panneau dans l'app, via un mod | Un clic ouvre la salle. Rien n'est promis publiquement avant que ça marche. |

## Plus tard
- Adaptateurs pour d'autres IA (Gemini CLI, Cursor, Aider, OpenCode), sur le format commun.
- Overlay OBS transparent, seulement en mode masqué.
- Statistiques locales (fichiers les plus lus, agents les plus actifs).
- Image instantanée « ma session du jour ».
- Thèmes de salle (labo, bureau).
- Historique visible et replay.

## Hors périmètre
- Aucune action sur l'IA : lecture seule.
- Aucun appel à un modèle, aucun service en ligne.
- Le texte des prompts n'est jamais affiché ni stocké.
- Pas d'icône dans Codex : il n'a que la page localhost.

## Plateforme, langues, public ou privé
- Plugin Claude Code, paquet npm pour Codex, page web locale.
- Ordinateur d'abord, utilisable dès 375 px.
- FR et EN, avec une bascule.
- Dépôt GitHub public, gratuit et open source, marqué alpha jusqu'au lot 5.

## Contraintes (échéance, budget, services)
- Pas d'échéance.
- Budget nul : aucun service payant.
- Windows 11 en priorité ; macOS et Linux ne doivent pas être cassés.

## Références
- Graphify : format `graphify-out/graph.json`.
- Mods existants de l'auteur (`token-meter`) pour l'intégration à Claude desktop.

## Questions ouvertes
- Licence du dépôt : MIT proposée.
- Logos Claude et OpenAI : vérifier leurs règles d'usage de la marque avant de publier. Sinon, icône neutre avec le nom de l'IA.
- Nom « AgentClass » : chercher une éventuelle marque déposée avant la publication npm.
- Valeur de N pour l'alerte de boucle : à fixer après le lot 0.
