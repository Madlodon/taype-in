# CLAUDE.md

Règles à suivre dans ce dépôt.

## Git / Commits

- Faire **plusieurs petits commits** : un commit par changement logique.
- Messages de commit **courts** et qui décrivent **ce que le changement fait**.
  - Exemples : `Ajoute la validation du courriel`, `Corrige le calcul du total`, `Renomme UserService en AccountService`
  - Éviter : messages vagues (`fix`, `update`, `wip`) ou paragraphes explicatifs.
- **Ne jamais `push`.** Les commits restent locaux, c'est moi qui pousse.
- **Interdit** : `git rebase`, `git restore`, `git checkout`.
  - Pour changer de branche : `git switch`.
  - Pour créer une branche : `git switch -c`.
- Ne pas modifier l'historique (`amend`, `reset --hard`, `push --force`).
- Commiter uniquement les fichiers liés au changement en cours (pas de `git add .` aveugle).
- Quand une branche est prête à être poussée, écrire dans la conversation une description de PR **en anglais**, **courte et simple**, prête à copier : un titre, quelques puces sur ce que ça change, et `Closes #<numéro de l'issue>` pour fermer l'issue automatiquement.

## Kanban (GitHub Projects)

Tableau : https://github.com/users/Madlodon/projects/5. Déplacer l'issue sur le tableau :

- Au début du travail sur une issue : **In progress**.
- Quand la branche est prête à être poussée : **In review**.
- **Done** se fait tout seul quand la PR est fusionnée et ferme l'issue.

```bash
ITEM=$(gh project item-list 5 --owner Madlodon --limit 500 --format json --jq '.items[] | select(.content.number==<numéro>) | .id')
gh project item-edit --project-id PVT_kwHOC8NMCM4BlBXl --id "$ITEM" --field-id PVTSSF_lAHOC8NMCM4BlBXlzhjvya0 --single-select-option-id <option>
```

Options : In progress = `4d524fb1`, In review = `ede8d74f`.

## Comment coder

- **Simple** : la solution la plus directe qui fonctionne. Pas d'abstraction anticipée.
- **Faire uniquement la feature demandée.** Aucun extra, aucun refactor non demandé, aucun fichier créé « au cas où ».
- **En cas d'incertitude, demander avant de coder.** Une question maintenant coûte moins cher qu'un mauvais code.
- Suivre les conventions déjà présentes dans le projet (style, nommage, structure).
- Ne pas ajouter de dépendance sans demander.

## Tests

- Chaque feature vient avec des tests adaptés à ce qu'elle fait.
- Tester le comportement attendu et les cas limites importants, pas les détails d'implémentation.
- Les tests doivent passer avant de commiter.
- Ne pas supprimer ou désactiver un test qui échoue pour faire passer la suite : le signaler.
