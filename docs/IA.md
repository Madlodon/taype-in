# Utilisation de l'IA

## Agents et outils

- **Claude Code** (application de bureau et terminal) : l'outil principal. Il a servi à planifier les issues, écrire le code et les tests, lancer les tests et l'application dans son navigateur intégré, et déplacer les issues sur le tableau GitHub Projects.
- **Codex** : surtout pour le visuel de l'arène et du garage (branches `codex/…` : voitures, chapeaux, effets de boost, interface inspirée de Rocket League).

Le nom (DES-01) et le logo (DES-02) ne viennent pas de l'IA : voir [DEMARCHE-CREATIVE.md](DEMARCHE-CREATIVE.md).

## Fichiers d'instructions

Tous sont dans le dépôt :

- [`AGENTS.md`](../AGENTS.md) : les règles du dépôt, lues par Claude Code et Codex. Commits petits et en anglais, jamais de `push` ni de réécriture de l'historique, déplacement des issues sur le tableau, code simple, poser une question en cas de doute, pas de dépendance sans demander, tests obligatoires.
- [`CLAUDE.md`](../CLAUDE.md) : importe `AGENTS.md` pour Claude Code.
- [`.claude/agents/`](../.claude/agents) : sous-agents spécialisés (`css`, `html`, `js-ts`, `database`, `test-writer`, `qa`, `ui-designer`, `explorer`), chacun avec ses outils et sa consigne.
- [`.claude/skills/`](../.claude/skills) : standards de codage (CSS, HTML, JavaScript, TypeScript), rédaction de tests unitaires et `grilling`, qui pose des questions sur un plan avant de coder.

## Trois fois où l'IA s'est trompée

### 1. Branches liées à `main` : `push` refusé

- **Erreur** : pour créer une branche à partir de `origin/main`, l'IA utilisait `git switch -c <branche> origin/main`. Cette commande fait de `origin/main` la branche suivie (*upstream*) de la nouvelle branche.
- **Détection** : au moment de pousser, `git push` visait `main` et a été refusé ; impossible d'ouvrir la PR.
- **Correction** : les branches sont maintenant créées avec `--no-track`, puis poussées avec `git push -u origin <branche>`. La règle a été ajoutée à la mémoire de l'agent pour ne pas recommencer.

### 2. Le mauvais cahier des charges

- **Erreur** : l'IA a construit plusieurs fonctionnalités à partir du cahier des charges de l'équipe au lieu de l'énoncé de l'enseignant : 300 joueurs par salle au lieu de 2 à 30, compte à rebours de 5 s au lieu de 3, invités qui créent des salles, 4 niveaux de bots au lieu de 5. La matrice d'exigences utilisait aussi nos propres identifiants (LOB-6, CRS-6) au lieu de ceux de l'énoncé (SALLE-05, COURSE-03).
- **Détection** : en relisant l'énoncé avant le checkpoint, une comparaison exigence par exigence a montré les écarts.
- **Correction** : chaque écart est devenu une issue (#111 à #139), corrigée une à une (ex. #123 pour le compte à rebours, #112 pour la capacité). La matrice [EXIGENCES.md](EXIGENCES.md) a été refaite avec les identifiants de l'énoncé, et chaque nouvelle tâche part maintenant du texte de l'énoncé.

### 3. Reconnecté après la déconnexion

- **Erreur** : après une déconnexion, la session revenait parfois. Un préchargement de lien (*prefetch*) lancé avant la déconnexion passait par le proxy, qui prolongeait la session et renvoyait le cookie. L'IA a d'abord voulu ignorer ces requêtes en lisant leurs en-têtes dans `proxy()`, mais Next.js retire ces en-têtes avant d'appeler le proxy : le correctif ne pouvait pas marcher. Pour le test, elle a aussi utilisé `unstable_doesProxyMatch`, le nom donné par la documentation, mais cette fonction n'existe pas dans la version installée (16.3.6).
- **Détection** : le bogue a été reproduit à la main dans le navigateur, puis le test unitaire du correctif a échoué à l'import.
- **Correction** : le filtre a été déplacé dans le `matcher` du proxy (`missing` sur les en-têtes de préchargement), le seul endroit où ils sont encore visibles. Le test utilise `unstable_doesMiddlewareMatch`, la fonction réellement exportée (#150).

## Réflexion

<!-- À compléter : courte réflexion personnelle sur la façon de travailler avec les agents. -->
