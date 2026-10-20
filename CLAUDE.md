# AgentClass

Lire `docs/` avant toute modification. Suivre l'ordre des lots de `docs/06-PLAN.md`.

- Règle : 0 token par appel d'outil. Aucun hook n'injecte de contexte, sauf au SessionStart d'une nouvelle conversation : une consigne d'une phrase pour que Claude donne le lien de la salle (~50 tokens par session, décision de l'utilisateur du 2026-10-20, coupable par `announce: false`). Le hook sort toujours en 0.
- Ne jamais stocker ni afficher le texte des prompts, le contenu des fichiers ou la sortie des outils (voir `docs/05-SCHEMA.md`).
- Si une décision change, mettre à jour le document concerné dans le même lot.
