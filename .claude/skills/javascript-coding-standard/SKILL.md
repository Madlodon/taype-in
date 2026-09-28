---
name: javascript-coding-standard
description: Standard de codage JavaScript moderne (ES2015+) basé sur l'Airbnb JavaScript Style Guide, le Google JavaScript Style Guide, les règles ESLint recommandées et Prettier. À utiliser dès qu'il est question de code JS — modules, fonctions, composants front-end, scripts Node.js, tests — que ce soit pour écrire du nouveau code ou pour réviser, moderniser et corriger du code existant, même sans demande explicite de « standard ». Couvre le nommage, l'asynchrone, l'égalité, les erreurs et les pièges du langage.
---

# Standard de codage JavaScript

Référence : Airbnb JavaScript Style Guide + règles ESLint recommandées. Si le projet a un `.eslintrc`, un `eslint.config.js` ou un `.prettierrc`, **c'est lui la référence** — lis-le avant d'écrire et signale les divergences plutôt que de les contourner.

## Avant d'écrire

1. Regarde le système de modules (`"type": "module"` vs CommonJS) et la cible (navigateur, Node, les deux).
2. Regarde si le formatage est automatisé (Prettier) : dans ce cas ne discute pas de virgules ni de guillemets, concentre-toi sur la logique.
3. Imite les patterns du fichier voisin avant d'introduire les tiens.

## Variables et types

- `const` par défaut, `let` si réassignation, **jamais** `var`.
- Une déclaration par ligne.
- `===` et `!==` toujours ; `==` seulement dans `x == null` pour couvrir `null` et `undefined`.
- Ne te fie pas à la coercition implicite : `Number(x)`, `String(x)`, `Boolean(x)` explicites. Attention aux valeurs falsy (`0`, `''`, `NaN`) dans les tests de présence — préfère `x != null` ou `x === undefined`.
- Littéraux `[]` et `{}` plutôt que `new Array()` / `new Object()`.
- Déstructuration pour extraire plusieurs propriétés ; opérateurs `?.` et `??` plutôt que des chaînes de `&&`.

## Nommage

| Élément | Convention |
|---|---|
| Variable, fonction | camelCase |
| Classe, composant | PascalCase |
| Constante globale figée | UPPER_SNAKE_CASE |
| Fichier | kebab-case (ou le style du projet) |
| Booléen | préfixe `is`, `has`, `can`, `should` |

Les noms de fonctions commencent par un verbe (`fetchUser`, `formatDate`). Pas d'abréviations obscures, pas de `data`/`info`/`temp` seuls.

## Fonctions

- Fonctions fléchées pour les callbacks et les fonctions courtes ; `function` nommée quand tu as besoin de `this` dynamique ou d'une meilleure trace de pile.
- Paramètres par défaut plutôt que `x = x || valeur`, rest (`...args`) plutôt que `arguments`.
- Au-delà de 3 paramètres, passe un objet d'options.
- Ne réassigne pas les paramètres ; ne mute pas les objets reçus — retourne une nouvelle valeur (`{...obj}`, `map`, `filter`).
- Une fonction fait une chose et retourne un seul type de valeur. Sorties anticipées plutôt qu'imbrication profonde.

## Asynchrone

- `async`/`await` plutôt que des chaînes de `.then()`, et jamais de callbacks imbriqués.
- **Chaque `await` peut lancer** : entoure d'un `try/catch` ou gère la rejection en amont.
- Opérations indépendantes → `Promise.all` (ou `Promise.allSettled` si les échecs partiels sont tolérables), pas des `await` en série dans une boucle.
- Ne mélange pas `await` et `.then()` sur la même promesse.
- Toute promesse doit être attendue ou avoir un `.catch()` — pas de rejet non géré.

## Erreurs

- Lève des `Error` (ou des sous-classes), jamais des chaînes.
- Pas de `catch` vide ; si tu avales une erreur, écris pourquoi en commentaire.
- Conserve le contexte : `throw new Error('Échec du chargement', { cause: err })`.
- Valide les entrées aux frontières (API, formulaire, fichier), pas partout.

## Modules et organisation

- Modules ES (`import`/`export`) ; exports nommés par défaut, `export default` seulement pour un module à responsabilité unique.
- Pas d'effet de bord au chargement d'un module.
- Un module = une responsabilité ; pas d'imports circulaires.
- Pas de variables globales ; pas de `eval` ni de `with`.

## Collections

`map`/`filter`/`reduce`/`find` pour transformer, `for...of` quand il y a des effets de bord ou un `break`. Ne mute pas le tableau source pendant l'itération. `Object.entries/values/keys` plutôt que `for...in` (qui parcourt la chaîne de prototypes).

## Commentaires

Le commentaire explique le *pourquoi* : une contrainte métier, un contournement de bug, un compromis de performance. Si le commentaire décrit ce que fait le code, renomme le code. JSDoc sur les fonctions exportées d'une bibliothèque.

## Tests

Un comportement par test, nom descriptif (`should return null when the user is not found`), pas de dépendance à l'ordre, mocks limités aux frontières externes (réseau, horloge, système de fichiers).

## En mode révision

1. **Correctness** — promesse non attendue, `await` dans une boucle qui devrait être parallèle, `catch` vide, mutation partagée, fuite de `this`.
2. **Sécurité** — `innerHTML` avec des données utilisateur, `eval`, dépendances non vérifiées, secrets en dur.
3. **Conception** — fonctions trop longues, état global, couplage fort.
4. **Conventions** — `var`, `==`, nommage, code mort.

Donne des diffs ciblés avec le risque concret. Si un linter existe, référence la règle (`no-await-in-loop`, `eqeqeq`) plutôt que ta préférence personnelle.
