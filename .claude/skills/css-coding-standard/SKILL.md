---
name: css-coding-standard
description: Standard de codage CSS basé sur le Google CSS Style Guide, les spécifications W3C, la méthodologie BEM et les critères visuels de WCAG 2.2 AA. À utiliser dès qu'il est question de feuilles de style — mise en page Flexbox ou Grid, responsive, thèmes et variables CSS, animations, spécificité, Sass/SCSS, CSS-in-JS ou classes utilitaires — pour écrire de nouveaux styles comme pour réviser, nettoyer, déboguer ou refactorer du CSS existant, même sans mention explicite d'un « standard ». Pour le balisage, utiliser plutôt le standard HTML.
---

# Standard de codage CSS

Référence : Google CSS Style Guide + BEM + WCAG 2.2 AA. Si le projet utilise un framework (Tailwind, Bootstrap), une architecture (CSS Modules, styled-components, Sass) ou un Stylelint, **suis-le** : ne mélange jamais deux paradigmes dans un même fichier.

## Avant d'écrire

1. Identifie l'approche existante : utilitaires, BEM, CSS Modules, CSS-in-JS.
2. Cherche les design tokens (variables CSS, thème Sass, config Tailwind) — utilise-les au lieu de valeurs en dur.
3. Cherche si la règle existe déjà : la première cause de CSS ingérable est la duplication.
4. Vérifie la cible navigateur avant `:has()`, container queries, `subgrid` ou les couleurs `oklch()`.

## Mise en forme

- Indentation 2 espaces, une déclaration par ligne, point-virgule final systématique.
- Espace après `:` et avant `{` ; accolade fermante sur sa propre ligne.
- Sélecteurs multiples : un par ligne, séparés par des virgules.
- Minuscules partout ; couleurs hexadécimales courtes (`#fff`) ou variables.
- Pas d'unité sur zéro (`margin: 0`), zéro initial conservé (`0.5rem`).
- Une ligne vide entre les règles ; commentaires de section pour découper un gros fichier.
- Ordre logique des propriétés : positionnement → modèle de boîte → typographie → décor → transitions/animations.

## Nommage et architecture

- BEM : `.bloc`, `.bloc__element`, `.bloc--modificateur`. Les classes décrivent le **rôle** (`.card__title`, `.btn--danger`), jamais l'apparence (`.big-red`, `.mt-20` en dehors d'un système d'utilitaires assumé).
- Un composant = un fichier ou une section clairement délimitée.
- Sépare les couches : reset/base → tokens → layout → composants → utilitaires. Charge-les dans cet ordre.
- Sass/SCSS : imbrication limitée à 2–3 niveaux, pas de `&__` en chaîne qui rend les classes introuvables par recherche texte. `@use` plutôt que `@import`.

## Spécificité

Une spécificité qui grimpe est la cause n°1 des feuilles de style impossibles à maintenir. Chaque `!important` ajouté en oblige un autre plus tard.

- Vise une seule classe par sélecteur. Évite les sélecteurs de type et les enchaînements descendants profonds.
- Pas d'`id` pour le style (spécificité ingérable) ; réserve-les aux ancres et à ARIA.
- `!important` uniquement pour surcharger du code tiers, avec un commentaire qui l'explique.
- `:where()` pour ajouter des styles sans spécificité, `:is()` pour factoriser.
- Cascade layers (`@layer`) si le projet les adopte — c'est la façon propre de maîtriser l'ordre.

## Variables et thèmes

Définis les couleurs, espacements, rayons, ombres, familles et échelles typographiques comme variables CSS sur `:root`. Une valeur qui apparaît deux fois devient une variable. Nomme par intention (`--color-danger`, `--space-md`) plutôt que par valeur (`--red-500` seul). Pour le mode sombre, redéfinis les variables sous `[data-theme="dark"]` ou `@media (prefers-color-scheme: dark)` plutôt que de dupliquer les règles.

## Mise en page

- Flexbox pour un axe, Grid pour deux. `gap` plutôt que des marges de compensation.
- Évite le positionnement absolu pour la structure générale : réserve-le aux superpositions (badge, tooltip, modale).
- Pas de hauteurs fixes sur du contenu textuel — il grandit avec la traduction et la taille de police système.
- `box-sizing: border-box` global.
- Unités : `rem` pour typographie et espacements, `%`/`fr`/`minmax()`/`clamp()` pour les dimensions fluides, `px` pour bordures et détails fins, `ch` pour les largeurs de texte. Évite `vh` sur mobile (barre d'adresse) — préfère `dvh`.
- Mobile-first : styles de base puis `@media (min-width: …)`. Les points de rupture suivent le contenu, pas des modèles d'appareils.

## Accessibilité visuelle

- Contraste minimum 4,5:1 pour le texte courant, 3:1 pour le grand texte et les bordures de composants.
- Ne supprime jamais `:focus` sans remplacement au moins aussi visible ; `:focus-visible` pour ne cibler que la navigation clavier.
- Ne code pas une information par la seule couleur — ajoute une icône, un texte ou un motif.
- Respecte `@media (prefers-reduced-motion: reduce)` : désactive ou réduis les animations.
- Ne bloque pas le zoom et n'impose pas de taille de police en `px` sur le corps de texte.
- Cibles interactives d'au moins 24×24 px, avec un espacement suffisant.

## Performance

Anime `transform` et `opacity` — les autres propriétés déclenchent des recalculs de mise en page. `will-change` avec parcimonie et seulement sur des éléments réellement animés. Limite le nombre de familles et de graisses de police, précharge celles du rendu initial et utilise `font-display: swap`. Supprime le CSS mort : une feuille de style qui ne fait que grossir cache toujours des règles inutilisées.

## En mode révision

1. **Accessibilité** — contraste, `outline: none` sans remplacement, animation non conditionnée, taille de police non redimensionnable.
2. **Robustesse** — hauteur fixe sur du texte, débordement non géré, valeurs magiques (`margin-top: -37px`), casse au zoom ou en traduction.
3. **Maintenabilité** — spécificité en escalade, chaîne de `!important`, duplication de valeurs au lieu de tokens, sélecteurs profondément imbriqués, règles mortes.
4. **Conventions** — nommage hors BEM, ordre des propriétés, indentation.

Montre des diffs ciblés et explique le symptôme visible (« ce bouton devient illisible au survol en mode sombre »), pas seulement la règle enfreinte.
