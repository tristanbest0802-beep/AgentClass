# Plan d'implémentation : AgentClass
Date : 2026-10-20 · Statut : brouillon

Chaque lot laisse le projet dans un état qui marche. Une relecture par lot.

## Ordre des lots
| Lot | Objectif | Dépend de | Fait quand |
|---|---|---|---|
| 0 | Squelette et capture réelle | — | `node --test` passe, une vraie session avec 2 sous-agents est capturée, la latence est mesurée |
| 1 | Serveur local sécurisé, flux brut, mode démo | 0 | La page affiche la liste brute des événements en direct ; les tests de sécurité passent |
| 2 | Salle à plat : chaises, prof, indicateurs, onglets | 1 | F4, F5, F6, F8 (chaises), F9 en mode démo et en réel |
| 3 | Tableau : liste des fichiers, puis Graphify en option avec points | 2 | F7, F8 (nœuds) |
| 4 | Mode stream, isométrique, FR/EN, thèmes, accessibilité | 3 | F10, F11, contrastes mesurés |
| 5 | Démarrage auto, purge, désinstallation, dépôt alpha public | 4 | F12, README avec accroche et GIF |
| 6 | Packaging marketplace Claude et npm | 5 | Installation propre sur une machine neuve |
| 7 | Icône dans Claude desktop (mod) | 5 | F14, ou repli par la commande `/agentclass` |
| 8 | Adaptateur Codex | 1 | F13 |
| 9 | Autres IA, overlay OBS (plus tard) | 8, 4 | Hors V1 |

## Détail des lots

### Lot 0 : squelette et capture réelle
- Objectif : savoir ce que les hooks fournissent vraiment avant tout design.
- Fichiers : `package.json`, `.gitignore`, `.editorconfig`, `LICENSE`, `jsconfig.json`, `hooks/hook.mjs`, `.claude-plugin/plugin.json` (hooks), `test/hook.test.mjs`.
- Étapes : hook en 20 lignes environ (stdin, réduction, append, exit 0) ; branchement sur SessionStart, PreToolUse, PostToolUse, SubagentStart, SubagentStop ; vraie session avec 2 sous-agents ; lecture du JSONL ; copie d'extraits anonymisés dans `test/fixtures/`.
- Mesure : durée du hook sous Windows (médiane sur 50 appels).
- Fonctionnalités : F1.
- Tests : le hook sort en 0 même avec une entrée invalide, n'écrit rien sur stdout, ne stocke ni prompt ni contenu.
- Critère de fin : rapport court ajouté à `docs/02-TRD.md` (champs disponibles, latence, décision sur l'appariement).

### Lot 1 : serveur local sécurisé
- Fichiers : `server/server.mjs`, `server/readers/claude.mjs`, `server/demo.mjs`, `bin/agentclass.mjs`, `web/index.html`.
- Fonctionnalités : F2, F3.
- Tests : lecteur Claude sur fixtures (contrat), 403 si Host, Origin ou jeton est mauvais, pas de serveur en double (PID et verrou).
- Critère de fin : `agentclass demo` et une vraie session affichent la liste brute en direct.

### Lot 2 : salle à plat
- Fichiers : `web/app.js`, `web/style.css`, lecture des définitions d'agents dans le serveur.
- Fonctionnalités : F4, F5, F6, F8 (chaises), F9.
- Tests : alerte de boucle et durée par agent (unitaires), test manuel.
- Critère de fin : deux sessions en parallèle donnent deux onglets ; les chaises s'allument au bon moment.

### Lot 3 : tableau
- Fichiers : `server/graph.mjs`, rendu du tableau dans `web/`.
- Fonctionnalités : F7, F8 (nœuds).
- Étapes : liste des fichiers touchés d'abord ; puis lecture d'un vrai `graph.json`, correspondance par chemin, zone « hors graphe », points d'aller et de retour appariés.
- Tests : réduction du graphe, correspondance fichier vers nœud, aucun point ne reste bloqué en rouge (expiration).
- Critère de fin : utile sans graphe, et juste avec un graphe.

### Lot 4 : habillage
- Fonctionnalités : F10, F11.
- Tests : captures à 375 px, en tablette et sur ordinateur, en clair et en sombre ; contrastes mesurés ; navigation au clavier ; `prefers-reduced-motion`.
- Critère de fin : vérification visuelle et critique de design passées.

### Lot 5 : cycle de vie et dépôt alpha
- Fonctionnalités : F12.
- Tests : désinstallation sur un `settings.json` qui contient d'autres hooks ; purge à 7 jours.
- Critère de fin : dépôt public marqué alpha, README avec accroche, GIF de 10 secondes, licence.

### Lot 6 : distribution
- Manifeste de la marketplace, paquet npm sans `postinstall`, provenance npm.
- Critère de fin : installation et désinstallation propres sur une machine neuve.

### Lot 7 : icône Claude desktop
- Étude des capacités des mods, prototype, repli par une commande.
- Critère de fin : un clic ouvre la salle, ou le repli est documenté.

### Lot 8 : adaptateur Codex
- Fichier : `server/readers/codex.mjs` et ses fixtures.
- Critère de fin : une session Codex s'affiche (prof, logo, tableau).

## Jalons
- J1 : fin du lot 1, les données arrivent en direct.
- J2 : fin du lot 3, la V1 fonctionnelle à plat.
- J3 : fin du lot 5, l'alpha publique.

## Mise en ligne
Dépôt public au lot 5. Il peut être poussé plus tôt en privé.

## Contrôle final
- [ ] build (sans objet : pas de build) ; `tsc --checkJs` passe
- [ ] tests
- [ ] lint
- [ ] audit des dépendances
- [ ] vérification visuelle mobile et ordinateur
- [ ] documents de docs/ à jour

## Questions ouvertes
- Dépôt public dès le lot 0 (choix initial) ou au lot 5 (conseil) ? Proposition : pousser dès le lot 0, avec un README « alpha, ne pas installer ».
