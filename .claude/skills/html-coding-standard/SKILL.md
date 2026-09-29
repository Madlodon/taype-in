---
name: html-coding-standard
description: Standard de codage HTML basé sur les spécifications WHATWG/W3C, le Google HTML Style Guide et les critères d'accessibilité WCAG 2.2 AA. À utiliser dès qu'il est question de balisage — structurer une page, écrire un formulaire, un tableau, un composant, des métadonnées, ou vérifier l'accessibilité et la sémantique — que ce soit pour écrire du nouveau markup ou pour réviser, nettoyer et corriger du HTML existant, même sans mention explicite d'un « standard ». Pour les feuilles de style, utiliser plutôt le standard CSS.
---

# Standard de codage HTML

Référence : spécification HTML WHATWG + Google HTML Style Guide + WCAG 2.2 niveau AA. Si le projet a une convention maison, un linter (HTMLHint, `eslint-plugin-jsx-a11y`) ou un moteur de templates, **suis-le** : la cohérence l'emporte sur la préférence.

## Avant d'écrire

1. Repère la technologie : HTML statique, moteur de templates (Twig, Razor, Blade) ou JSX. La syntaxe des attributs et l'échappement changent.
2. Vérifie s'il existe déjà des composants ou partiels réutilisables avant d'en créer un nouveau.
3. Vérifie la cible navigateur avant d'employer un élément récent (`<dialog>`, `popover`, `<search>`).

## Squelette et métadonnées

- `<!DOCTYPE html>`, `<html lang="fr">` (la langue conditionne la prononciation des lecteurs d'écran et la césure).
- `<meta charset="utf-8">` en premier dans le `<head>`.
- `<meta name="viewport" content="width=device-width, initial-scale=1">`.
- Un `<title>` unique et descriptif par page, et une `<meta name="description">`.
- Métadonnées sociales (Open Graph) si la page est partageable.

## Mise en forme

- Indentation 2 espaces, un niveau par imbrication.
- Balises et attributs en minuscules, valeurs entre guillemets doubles.
- Attributs booléens sans valeur : `<input required disabled>`.
- Omets `type="text/javascript"` et `type="text/css"`, devenus inutiles.
- Ferme les éléments non vides ; ne ferme pas les éléments vides avec `/>` en HTML pur (nécessaire en JSX).
- Ordre lisible des attributs : `id`, `class`, `name`, `data-*`, attributs spécifiques, ARIA, événements.

## Sémantique

Le choix d'élément détermine le comportement clavier, le rôle d'accessibilité et le référencement. C'est une décision fonctionnelle, pas esthétique — c'est le point le plus important de ce document.

- Structure : `<header>`, `<nav>`, `<main>` (un seul par page), `<section>` (avec un titre), `<article>`, `<aside>`, `<footer>`. Une `<div>` ne se justifie que comme conteneur de style sans signification.
- Titres : un seul `<h1>`, hiérarchie sans saut de niveau. Ne choisis pas un niveau de titre pour sa taille.
- Action → `<button type="button">`. Navigation → `<a href>`. Ne fabrique jamais un contrôle avec `<div onclick>` : tu perds le focus clavier, la touche Entrée et le rôle.
- Listes pour les listes (`<ul>`, `<ol>`, `<dl>`), `<table>` avec `<caption>`, `<thead>`, `<th scope="col|row">` pour les données tabulaires — jamais pour la mise en page.
- `<time datetime="…">`, `<address>`, `<figure>`/`<figcaption>`, `<abbr title>` quand ils s'appliquent.
- `<strong>`/`<em>` pour l'importance et l'emphase ; `<b>`/`<i>` seulement pour un style sans signification.

## Formulaires

- Chaque champ a un `<label for="id">` visible. Un `placeholder` n'est pas un label : il disparaît à la saisie.
- Regroupe les cases à cocher et boutons radio liés dans `<fieldset>` + `<legend>`.
- Utilise les types natifs (`email`, `tel`, `url`, `number`, `date`) et `autocomplete` : ils déclenchent le bon clavier mobile et le remplissage automatique.
- Validation native (`required`, `pattern`, `min`/`max`) en première ligne — mais **revalide toujours côté serveur**.
- Messages d'erreur reliés au champ (`aria-describedby`) et annoncés (`aria-live`), pas seulement colorés en rouge.
- `<button type="submit">` explicite ; attention au type par défaut dans un formulaire.

## Accessibilité (WCAG 2.2 AA)

- `alt` sur chaque `<img>` : description utile si l'image porte du sens, `alt=""` si elle est purement décorative. Ne commence pas par « image de ».
- Tout doit être atteignable et actionnable au clavier, dans un ordre logique. N'utilise `tabindex` qu'avec `0` ou `-1`, jamais de valeurs positives.
- Un lien d'évitement (« Aller au contenu ») en début de page.
- ARIA seulement si le HTML natif ne suffit pas — un mauvais ARIA est pire que pas d'ARIA. Si tu écris `role="button"` sur une `<div>`, utilise plutôt un `<button>`.
- Les textes de lien décrivent la destination : pas de « cliquez ici ».
- Les régions dynamiques utilisent `aria-live` pour être annoncées.
- Les `<iframe>` ont un `title`.

## Médias et performance

- `width` et `height` sur les images et vidéos pour éviter le décalage de mise en page.
- `loading="lazy"` hors du premier écran ; `<picture>`/`srcset` pour le responsive.
- Scripts en fin de `<body>` ou avec `defer` ; `async` seulement pour les scripts indépendants.
- `preconnect`/`preload` pour les ressources critiques uniquement.
- Sous-titres et transcriptions pour l'audio et la vidéo.

## Séparation des responsabilités

Pas d'attribut `style=` ni de gestionnaire `onclick=` dans le markup : le style va dans les feuilles CSS, le comportement dans les modules JS. Utilise des classes et des `data-*` comme points d'accroche. Les identifiants (`id`) servent aux ancres, aux `label for` et aux références ARIA — pas au style.

## Sécurité

Échappe toute donnée utilisateur injectée dans le markup. `rel="noopener noreferrer"` sur les liens `target="_blank"` externes. Ne place jamais de secret dans un attribut `data-*` ou un commentaire HTML — tout est visible côté client.

## En mode révision

1. **Accessibilité** — `alt` manquant, `<div>` cliquable, label absent, ordre de titres cassé, piège clavier.
2. **Sémantique** — soupe de `<div>`, tableau de mise en page, titre choisi pour sa taille.
3. **Validité** — imbrication illégale, `id` dupliqué, attribut obsolète, balise non fermée.
4. **Conventions** — style ou événement en ligne, indentation, ordre des attributs.

Priorise ce qui casse l'usage réel : navigation clavier, lecteur d'écran, mobile. Le cosmétique vient après.
