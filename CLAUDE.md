# AgentClass

Lire `docs/` avant toute modification. Suivre l'ordre des lots de `docs/06-PLAN.md`.

- Règle absolue : 0 token. Aucun hook n'injecte de contexte (ni texte brut sur stdout, ni `additionalContext`). Seule exception : au SessionStart, un JSON `{ systemMessage }` affiché à l'utilisateur, qui ne va pas au modèle. Le hook sort toujours en 0.
- Ne jamais stocker ni afficher le texte des prompts, le contenu des fichiers ou la sortie des outils (voir `docs/05-SCHEMA.md`).
- Si une décision change, mettre à jour le document concerné dans le même lot.
