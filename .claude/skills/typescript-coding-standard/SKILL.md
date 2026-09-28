---
name: typescript-coding-standard
description: Standard de codage TypeScript basé sur le Google TypeScript Style Guide, les règles typescript-eslint recommandées et les bonnes pratiques officielles du typage (strict mode, types utilitaires, génériques). À utiliser dès qu'il est question de code TypeScript — définir des types ou interfaces, écrire un service, un composant React typé, une API Node, configurer tsconfig — ou pour réviser, migrer depuis JavaScript et corriger du code TS existant, même sans mention explicite d'un « standard ».
---

# Standard de codage TypeScript

Référence : Google TypeScript Style Guide + typescript-eslint. Ce document complète le standard JavaScript : **tout ce qui vaut pour JS vaut ici** (`const`, `===`, async/await, gestion d'erreurs). Ce qui suit concerne le typage.

Si le projet a un `tsconfig.json` et une config ESLint, **ils font foi**.

## Configuration attendue

Sur un nouveau projet, active au minimum : `strict: true`, `noUncheckedIndexedAccess`, `noImplicitOverride`, `exactOptionalPropertyTypes`, `forceConsistentCasingInFileNames`. Sur un projet existant qui n'est pas en strict, ne casse pas la compilation : propose une migration fichier par fichier.

## Principe directeur

Le typage sert à rendre les états invalides impossibles à représenter, pas à décorer le code. Avant d'ajouter un type, demande-toi quel bug il empêche.

## Typage de base

- **N'annote pas ce que l'inférence fait bien** : `const count = 0` suffit. Annote les **frontières** : paramètres, valeurs de retour publiques, structures de données exportées.
- `any` est un renoncement — il désactive toutes les vérifications en aval. Utilise `unknown` puis restreins par un garde de type. Si `any` est vraiment nécessaire, isole-le et commente pourquoi.
- Pas d'assertion `as` pour faire taire le compilateur : elle ment. Préfère un garde de type (`function isUser(x: unknown): x is User`) ou corrige le type source. `as const` reste légitime pour figer des littéraux.
- `!` (non-null assertion) uniquement quand tu peux justifier l'invariant en une phrase.
- Types de retour explicites sur les fonctions exportées : ils documentent le contrat et évitent qu'un refactor change silencieusement l'API.

## Types vs interfaces

- `interface` pour les formes d'objets extensibles et les contrats publics.
- `type` pour les unions, intersections, tuples, types mappés et alias de fonctions.
- Ne mélange pas les deux styles pour la même chose dans un même module.

## Modélisation

- **Unions discriminées** plutôt que des champs optionnels qui s'excluent :
  `type Result<T> = { status: 'ok'; data: T } | { status: 'error'; error: Error }`.
  Le compilateur peut alors vérifier l'exhaustivité (`never` dans le `default`).
- Types littéraux et unions de chaînes plutôt que `string` nu : `type Role = 'admin' | 'user'`.
- Enum : préfère `as const` + union dérivée, ou `enum` uniquement si le projet en utilise déjà. Évite les enums numériques.
- `readonly` sur les propriétés et `readonly T[]` sur les entrées que tu ne modifies pas.
- Types utilitaires plutôt que duplication : `Partial`, `Pick`, `Omit`, `Record`, `ReturnType`.
- Types dérivés d'une source unique : `type UserId = User['id']`.
- `null` vs `undefined` : choisis une convention par projet et tiens-la (`undefined` pour « absent », `null` pour « vidé explicitement » est un choix courant).

## Génériques

Un générique n'a de sens que si le type d'entrée influence le type de sortie. Nomme-les de façon parlante (`TItem`, `TResponse`) dès qu'il y en a plus d'un, et contrains-les (`<T extends { id: string }>`) plutôt que de laisser `T` libre. Si tu écris un type conditionnel de trois lignes pour un cas simple, recule : la lisibilité prime.

## Données externes

Tout ce qui vient du réseau, d'un fichier, du stockage local ou d'une variable d'environnement arrive en `unknown`, quelle que soit la signature. Valide à la frontière avec un schéma (Zod, Valibot, io-ts) ou un garde de type écrit à la main, puis le reste du code peut faire confiance aux types. Ne type jamais une réponse HTTP par simple `as ApiResponse`.

## Modules et fichiers

- `import type { X } from '...'` pour les imports uniquement typés.
- Un fichier de types partagés par domaine, pas un `types.ts` fourre-tout global.
- Pas de namespaces (obsolètes) ; utilise les modules ES.
- Nommage : PascalCase pour types, interfaces et classes ; camelCase pour le reste. Pas de préfixe `I` sur les interfaces.

## Tests

Type les fixtures comme le code réel — un `as any` dans un test masque exactement le bug que le test devrait attraper. Si un type rend le test pénible à écrire, c'est souvent le type de production qui est mal conçu.

## En mode révision

1. **Trous de typage** — `any` explicite ou implicite, `as` non justifié, `!` abusif, réponse externe non validée.
2. **Correctness** — union non exhaustive, index non vérifié, promesse non attendue.
3. **Modélisation** — champs optionnels qui s'excluent mutuellement, `string` là où une union suffirait, duplication de types au lieu de dérivation.
4. **Conventions** — annotations redondantes, imports de type non marqués, nommage.

Explique pour chaque point le bug d'exécution que le typage laisserait passer — c'est ça qui rend la remarque actionnable.
