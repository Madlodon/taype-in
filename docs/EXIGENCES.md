# Exigences

Matrice de traçabilité des exigences de l'énoncé (*Web V — Travail de session*). Chaque exigence → statut → fichiers → tests → issues.

Statut :

- **Fait** : livré et testé.
- **Partiel** : une partie est livrée ; la note dit ce qui manque.
- **À faire** : rien n'est livré ; une issue est ouverte.

Bilan : 90 exigences, 87 faites, 3 partielles, 0 à faire.

Les choix faits devant une exigence ambiguë sont dans la colonne « Notes et choix ».

## 3. Contraintes techniques (TECH)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| TECH-01 | Next.js (App Router) avec React | Fait | [`app/layout.tsx`](../app/layout.tsx), [`server.ts`](../server.ts) | Toute la suite ; build dans la CI | [#7][i7] | Next.js 16, serveur personnalisé pour Socket.IO sur le même port. |
| TECH-02 | TypeScript à 100 % | Fait | [`tsconfig.json`](../tsconfig.json), [`eslint.config.mjs`](../eslint.config.mjs) | [typescript-only.test.ts](../__tests__/typescript-only.test.ts) | [#137][i137] | `strict`, `allowJs` désactivé, `no-explicit-any` en erreur, `@ts-expect-error` seulement avec une description. |
| TECH-03 | Tailwind CSS | Fait | [`app/globals.css`](../app/globals.css) | — | [#7][i7] | Tailwind v4 ; jetons de couleur dans `globals.css`. |
| TECH-04 | PostgreSQL, migrations versionnées, script de seed | Fait | [`db/schema.ts`](../db/schema.ts), [`db/migrations`](../db/migrations), [`scripts/seed.ts`](../scripts/seed.ts) | [db/schema.test.ts](../__tests__/db/schema.test.ts), [db/migrate.test.ts](../__tests__/db/migrate.test.ts), [seed.test.ts](../__tests__/seed.test.ts) | [#5][i5], [#2][i2], [#135][i135] | Drizzle. Le corpus de textes est dans les migrations ; `bun run db:seed` crée le compte de démo, cinq adversaires et 24 courses. Relancer le script réinitialise ces données ; en local seulement. |
| TECH-05 | Déployé sur un VPS, public en HTTPS | Fait | [`compose.prod.yml`](../compose.prod.yml), [`Caddyfile`](../Caddyfile) | Vérifié à la main sur https://laniproject.dev | [#13][i13], [#38][i38] | AWS EC2 + Docker Compose ; Caddy obtient le certificat Let's Encrypt. |
| TECH-06 | Progression en temps réel | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#4][i4], [#7][i7], [#57][i57] | Socket.IO auto-hébergé ; voir l'[ADR 0001](adr/0001-realtime.md). |
| TECH-07 | Entrées serveur validées par un schéma | Fait | [`lib/socket-messages.ts`](../lib/socket-messages.ts), [`app/actions/lobbies.ts`](../app/actions/lobbies.ts), [`app/actions/auth.ts`](../app/actions/auth.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [auth-actions.test.ts](../__tests__/auth-actions.test.ts), [avatar-actions.test.ts](../__tests__/avatar-actions.test.ts) | [#7][i7], [#8][i8], [#9][i9] | Zod pour les actions serveur, les routes et chaque message Socket.IO avec des données. La photo est vérifiée par son contenu réel (octets) et sa taille. |
| TECH-08 | Aucun coût pour l'enseignant | Fait | — | — | [#13][i13] | Seul le serveur EC2 est payant, à mes frais. Les photos sont dans PostgreSQL : aucun service de stockage externe. |
| TECH-09 | CI GitHub Actions à chaque push : lint, `tsc --noEmit`, tests unitaires | Fait | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | La CI elle-même | [#12][i12], [#40][i40], [#136][i136] | Roule aussi les tests de bout en bout. |
| TECH-10 | `.env.example` documente toutes les variables, aucun secret commité | Fait | [`.env.example`](../.env.example) | [env-example.test.ts](../__tests__/env-example.test.ts) | [#157][i157] | Le test vérifie que chaque variable lue dans `process.env` est dans le fichier. |

## 4. Identité visuelle et design (DES)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| DES-01 | Nom trouvé sans IA, démarche documentée | Fait | [`docs/DEMARCHE-CREATIVE.md`](../docs/DEMARCHE-CREATIVE.md) | — | [#1][i1] | Noms envisagés et raison du choix dans la démarche créative. |
| DES-02 | Logo conçu sans IA, croquis, utilisé dans l'app et en favicon | Partiel | [`app/layout.tsx`](../app/layout.tsx), [`app/icon.svg`](../app/icon.svg) | [site-header.test.tsx](../__tests__/site-header.test.tsx), [e2e/logo.spec.ts](../e2e/logo.spec.ts) | [#39][i39] | Logo et favicon en place. Il manque la photo des croquis dans la démarche créative. |
| DES-03 | Direction artistique : moodboard, palette, typographies | Fait | [`docs/DEMARCHE-CREATIVE.md`](../docs/DEMARCHE-CREATIVE.md), [`docs/moodboard`](../docs/moodboard) | [palette.test.ts](../__tests__/palette.test.ts) | [#1][i1], [#41][i41] |  |
| DES-04 | Design unique, piste comme élément signature | Fait | [`components/arena.tsx`](../components/arena.tsx), [`components/race-typing.tsx`](../components/race-typing.tsx) | [track.test.ts](../__tests__/track.test.ts), [e2e/design.spec.ts](../e2e/design.spec.ts) | [#1][i1], [#57][i57] | Course dans une arène inspirée de Rocket League, vue en coupe. |
| DES-05 | Thèmes clair et sombre, préférence système, aucun flash | Fait | [`components/theme-switcher.tsx`](../components/theme-switcher.tsx) | [theme-switcher.test.tsx](../__tests__/theme-switcher.test.tsx), [e2e/theme.spec.ts](../e2e/theme.spec.ts) | [#11][i11] | next-themes avec la stratégie `class` : le thème est appliqué avant l'affichage. |
| DES-06 | Responsive dès 360 px ; sur mobile, message pour un clavier physique | Fait | [`components/keyboard-note.tsx`](../components/keyboard-note.tsx), [`app/globals.css`](../app/globals.css) | [e2e/responsive.spec.ts](../e2e/responsive.spec.ts) | [#62][i62], [#134][i134] | Toutes les pages sont utilisables dès 360 px. Sur téléphone (pointeur tactile, moins de 768 px), la zone de frappe est remplacée par un message ; la piste reste visible pour regarder. |

## 5.2 Comptes et profil (AUTH)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| AUTH-01 | OAuth Discord et GitHub ; nom d'utilisateur et mot de passe permis | Fait | [`lib/auth.ts`](../lib/auth.ts), [`lib/oauth.ts`](../lib/oauth.ts), [`app/actions/auth.ts`](../app/actions/auth.ts), [`app/auth/[provider]`](../app/auth/%5Bprovider%5D) | [auth.test.ts](../__tests__/auth.test.ts), [auth-actions.test.ts](../__tests__/auth-actions.test.ts), [oauth.test.ts](../__tests__/oauth.test.ts), [oauth-routes.test.ts](../__tests__/oauth-routes.test.ts), [oauth-signup-action.test.ts](../__tests__/oauth-signup-action.test.ts), [e2e/auth.spec.ts](../e2e/auth.spec.ts) | [#8][i8], [#71][i71] | Mot de passe, ou Discord et GitHub en OAuth 2 (fournisseur simulé dans les tests). Un nouveau compte OAuth choisit son nom et reçoit la photo du compte externe. Un fournisseur sans clés dans le .env n'est pas offert. |
| AUTH-02 | Pseudonyme d'invité (3 à 20 caractères), session par cookie | Fait | [`lib/auth.ts`](../lib/auth.ts), [`lib/session-cookie.ts`](../lib/session-cookie.ts) | [auth.test.ts](../__tests__/auth.test.ts), [auth-actions.test.ts](../__tests__/auth-actions.test.ts), [e2e/auth.spec.ts](../e2e/auth.spec.ts) | [#8][i8] | Choix : le cookie porte un jeton de session aléatoire (httpOnly), vérifié en base, plutôt qu'un cookie signé. Il ne peut pas être forgé non plus. |
| AUTH-03 | Un invité ne crée pas de salle ; pas d'historique ni de photo, avatar généré | Fait | [`app/actions/lobbies.ts`](../app/actions/lobbies.ts), [`app/actions/avatar.ts`](../app/actions/avatar.ts), [`app/avatars/[userId]/route.ts`](../app/avatars/%5BuserId%5D/route.ts) | [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [avatar-actions.test.ts](../__tests__/avatar-actions.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#111][i111], [#65][i65] | L'invité voit des initiales. Ses résultats sont gardés en base seulement pour les transférer s'il s'inscrit ; il n'a pas de page d'historique. |
| AUTH-04 | Photo de profil JPEG, PNG ou WebP, 2 Mo max, redimensionnée | Fait | [`lib/avatars.ts`](../lib/avatars.ts), [`app/actions/avatar.ts`](../app/actions/avatar.ts) | [avatars.test.ts](../__tests__/avatars.test.ts), [avatar-actions.test.ts](../__tests__/avatar-actions.test.ts), [avatar-route.test.ts](../__tests__/avatar-route.test.ts), [avatar-form.test.tsx](../__tests__/avatar-form.test.tsx), [e2e/profile.spec.ts](../e2e/profile.spec.ts) | [#65][i65], [#158][i158] | Type et taille validés côté serveur. À l'envoi, l'image est recadrée au centre en WebP 256 × 256 (sharp) ; seule cette version est gardée. |
| AUTH-05 | Modifier son pseudonyme | Fait | [`lib/username.ts`](../lib/username.ts), [`app/actions/username.ts`](../app/actions/username.ts), [`components/username-form.tsx`](../components/username-form.tsx) | [username.test.ts](../__tests__/username.test.ts), [username-actions.test.ts](../__tests__/username-actions.test.ts), [profile-page.test.tsx](../__tests__/profile-page.test.tsx) | [#67][i67] | Une fois par 30 jours. L'ancien nom reste réservé pendant ce délai et peut être repris ; l'ancienne adresse du profil redirige vers la nouvelle. |
| AUTH-06 | Profil : meilleur MPM, moyennes, courses, victoires, graphique | Fait | [`lib/profile.ts`](../lib/profile.ts), [`app/profile/[username]/page.tsx`](../app/profile/%5Busername%5D/page.tsx), [`components/progression-chart.tsx`](../components/progression-chart.tsx) | [profile.test.ts](../__tests__/profile.test.ts), [profile-page.test.tsx](../__tests__/profile-page.test.tsx), [e2e/profile.spec.ts](../e2e/profile.spec.ts) | [#64][i64], [#69][i69], [#131][i131] | Victoire = 1re place dans une course terminée. |

## 5.3 Salles et visibilité (SALLE)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| SALLE-01 | Un connecté crée une salle et en est l'hôte ; participant ou spectateur | Fait | [`app/actions/lobbies.ts`](../app/actions/lobbies.ts), [`lib/lobbies.ts`](../lib/lobbies.ts) | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#9][i9], [#73][i73], [#111][i111] | L'hôte choisit au départ de chaque course : « Lancer » ou « Lancer et regarder ». |
| SALLE-02 | Code unique de 6 caractères, sans caractères ambigus | Fait | [`lib/lobbies.ts`](../lib/lobbies.ts) | [lobbies.test.ts](../__tests__/lobbies.test.ts) | [#9][i9] | Alphabet sans 0, O, 1, I ni L. |
| SALLE-03 | Visibilités publique, sur code, privée | Fait | [`lib/lobbies.ts`](../lib/lobbies.ts), [`db/schema.ts`](../db/schema.ts) | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#9][i9], [#26][i26], [#118][i118] | Les trois existent. Une salle « sur code » accepte aussi les liens d'invitation ; le code seul n'ouvre jamais une salle privée. |
| SALLE-04 | Liens d'invitation uniques, liés à une IP, révocables | Fait | [`lib/lobbies.ts`](../lib/lobbies.ts), [`lib/client-ip.ts`](../lib/client-ip.ts), [`components/invite-links.tsx`](../components/invite-links.tsx), [`app/invite`](../app/invite) | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#26][i26], [#118][i118] | Un lien par invité, statut affiché, jeton de 128 bits. Au premier usage, le lien est lié à l'IP ; une autre IP est refusée, la même IP peut le réutiliser pour revenir. Révoqué à l'expulsion, invalide à la fermeture. |
| SALLE-05 | Capacité choisie par l'hôte (2 à 30), spectateurs exclus | Fait | [`components/lobby-settings-fields.tsx`](../components/lobby-settings-fields.tsx), [`lib/socket-server.ts`](../lib/socket-server.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#112][i112] | 30 par défaut, modifiable avant une relance. Les bots comptent. L'hôte compte à l'entrée, car il ne choisit de regarder qu'au départ : une course regardée a au plus capacité − 1 coureurs. |
| SALLE-06 | Une seule salle à la fois, garanti en base | Fait | [`db/schema.ts`](../db/schema.ts), [`lib/lobbies.ts`](../lib/lobbies.ts), [`lib/socket-server.ts`](../lib/socket-server.ts), [`components/lobby-room.tsx`](../components/lobby-room.tsx) | [db/schema.test.ts](../__tests__/db/schema.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx) | [#113][i113] | Index unique sur `lobby_participants.user_id`. Rejoindre une autre salle demande de quitter la première ; ses onglets encore ouverts en sortent. Un second onglet dans la même salle ne crée pas de doublon. |
| SALLE-07 | L'hôte expulse un participant ou un spectateur | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`lib/lobbies.ts`](../lib/lobbies.ts), [`components/lobby-room.tsx`](../components/lobby-room.tsx) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx) | [#114][i114] | À tout moment, avec confirmation. L'expulsé est banni de la salle (`lobby_bans`) et son lien d'invitation est supprimé ; en course, il compte comme abandon. |
| SALLE-08 | Transfert d'hôte au plus ancien humain, sinon fermeture | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`lib/lobbies.ts`](../lib/lobbies.ts), [`components/lobby-room.tsx`](../components/lobby-room.tsx) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx) | [#115][i115] | Le plus ancien selon `joined_at` ; les bots ne sont pas en base, donc jamais choisis. L'hôte a 10 s pour revenir (rechargement) ; s'il part pour une autre salle, le transfert est immédiat. Le nouvel hôte reçoit ses boutons en direct et la page se rafraîchit pour le code ou les liens. |
| SALLE-09 | Rejoindre seulement en attente ou aux résultats | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`lib/lobby-state.ts`](../lib/lobby-state.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#116][i116] |  |
| SALLE-10 | Limite d'essais de code par IP | Fait | [`lib/rate-limit.ts`](../lib/rate-limit.ts), [`lib/socket-server.ts`](../lib/socket-server.ts), [`app/actions/lobbies.ts`](../app/actions/lobbies.ts) | [rate-limit.test.ts](../__tests__/rate-limit.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#117][i117] | Choix : seuls les codes introuvables comptent, 10 par minute et par IP, un compteur partagé par l'action serveur et Socket.IO. Revenir dans sa salle n'est donc jamais bloqué. |

## 5.4 Rejoindre une course (JOIN)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| JOIN-01 | Champ « rejoindre par code » dès la page d'accueil | Fait | [`components/join-lobby-form.tsx`](../components/join-lobby-form.tsx), [`app/page.tsx`](../app/page.tsx), [`app/lobbies/page.tsx`](../app/lobbies/page.tsx) | [page.test.tsx](../__tests__/page.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#9][i9], [#159][i159] | Le champ est aussi sur l'accueil ; sans session, un code valide mène à la connexion (ou au mode invité) puis à la course. |
| JOIN-02 | Explorateur : infos, filtres langue et complexité, mise à jour en direct | Fait | [`components/lobby-explorer.tsx`](../components/lobby-explorer.tsx), [`lib/socket-server.ts`](../lib/socket-server.ts), [`lib/lobbies.ts`](../lib/lobbies.ts) | [lobby-explorer.test.tsx](../__tests__/lobby-explorer.test.tsx), [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobbies.test.ts](../__tests__/lobbies.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#9][i9], [#119][i119], [#121][i121] | Chaque salle montre participants/capacité (bots compris), langue, complexité, hôte et état (en attente, en course, résultats). Filtres de langue et de complexité dans l'URL (`?lang=`, `?complexity=`). La liste arrive par Socket.IO à chaque changement. |
| JOIN-03 | Bouton « Faire une course » | Fait | [`components/lobby-explorer.tsx`](../components/lobby-explorer.tsx), [`lib/lobbies.ts`](../lib/lobbies.ts), [`lib/socket-server.ts`](../lib/socket-server.ts) | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-explorer.test.tsx](../__tests__/lobby-explorer.test.tsx), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#120][i120] | Bouton « Course rapide » dans l'explorateur : la salle publique ouverte avec le moins de places libres, puis la plus ancienne. Aucune : un connecté en crée une avec les réglages par défaut. |

## 5.5 Configuration de la course (CONF)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| CONF-01 | Temps maximal : aucun, ou 30 s à 10 min | Fait | [`components/lobby-settings-fields.tsx`](../components/lobby-settings-fields.tsx), [`lib/lobbies.ts`](../lib/lobbies.ts) | [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [races.test.ts](../__tests__/races.test.ts) | [#58][i58], [#160][i160] | Liste par pas de 30 s, de 30 s à 10 min, ou aucun. Une valeur hors liste devient 5 min. |
| CONF-02 | Langue du texte, indépendante de l'interface | Fait | [`lib/texts.ts`](../lib/texts.ts), [`components/lobby-settings-fields.tsx`](../components/lobby-settings-fields.tsx) | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#54][i54] |  |
| CONF-03 | Texte cohérent (corpus en base) ou aléatoire (dictionnaire) | Fait | [`lib/texts.ts`](../lib/texts.ts), [`db/migrations`](../db/migrations), [`components/lobby-settings-fields.tsx`](../components/lobby-settings-fields.tsx) | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#54][i54], [#75][i75] | Cohérent : textes originaux pour 12-16 ans. Aléatoire : mots tirés des textes de la langue. Choix : un texte personnalisé (2000 caractères max) peut aussi remplacer le corpus. |
| CONF-04 | Longueur en nombre de mots | Fait | [`lib/texts.ts`](../lib/texts.ts) | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#54][i54] | Choix parmi 50, 100 et 200 mots ; le texte est coupé à la fin de la phrase. |
| CONF-05 | Complexité facile, moyen, difficile, critères documentés | Fait | [`lib/texts.ts`](../lib/texts.ts), [`components/lobby-settings-fields.tsx`](../components/lobby-settings-fields.tsx) | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#121][i121] | Critères : longueur moyenne des mots et caractères spéciaux pour 100 mots, seuils par langue (voir [ARCHITECTURE.md](ARCHITECTURE.md)). Trois textes par niveau et par langue. |
| CONF-06 | Ponctuation, nombres, majuscules, accents | Fait | [`lib/texts.ts`](../lib/texts.ts), [`components/lobby-settings-fields.tsx`](../components/lobby-settings-fields.tsx) | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#121][i121] | Cases cochées par défaut ; décocher retire ce contenu du texte tiré. |
| CONF-07 | Caractères à inclure ou exclure | Fait | [`lib/texts.ts`](../lib/texts.ts), [`components/lobby-settings-fields.tsx`](../components/lobby-settings-fields.tsx) | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#75][i75], [#121][i121] | Inclure (mode aléatoire) : accents, cédille, virgule, apostrophe, chiffres, caractères spéciaux et lettres au choix ; environ la moitié des mots les contiennent. Exclure : les cases de CONF-06. |
| CONF-08 | Mode d'erreur : correction obligatoire ou libre | Fait | [`lib/typing.ts`](../lib/typing.ts) | [typing.test.ts](../__tests__/typing.test.ts), [races.test.ts](../__tests__/races.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#56][i56] | Choix : en mode libre, chaque faute ajoute une pénalité de temps au classement. |
| CONF-09 | Bonus activés ou non | Fait | [`components/lobby-settings-fields.tsx`](../components/lobby-settings-fields.tsx), [`lib/race-bonuses.ts`](../lib/race-bonuses.ts) | [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#79][i79] | Désactivés : aucun tir ni but pendant la course. |
| CONF-10 | Ajout et retrait de bots, avec leur niveau | Fait | [`lib/bots.ts`](../lib/bots.ts), [`lib/socket-server.ts`](../lib/socket-server.ts) | [bots.test.ts](../__tests__/bots.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#76][i76] | Cinq niveaux (BOT-01). |
| CONF-11 | Visibilité et capacité | Fait | [`app/actions/lobbies.ts`](../app/actions/lobbies.ts) | [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#9][i9], [#112][i112] |  |
| CONF-12 | Tous voient la configuration en temps réel | Fait | [`components/lobby-room.tsx`](../components/lobby-room.tsx), [`components/lobby-settings-summary.tsx`](../components/lobby-settings-summary.tsx), [`lib/socket-server.ts`](../lib/socket-server.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#122][i122] | L'hôte modifie les réglages dans la salle d'attente (aussi après une relance) ; `lobby:settings` les envoie à toute la salle. Un texte personnalisé reste caché jusqu'au départ. |

## 5.6 Déroulement d'une course (COURSE)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| COURSE-01 | États explicites, machine à états documentée | Fait | [`lib/lobby-state.ts`](../lib/lobby-state.ts), [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) | [lobby-state.test.ts](../__tests__/lobby-state.test.ts), [player-state.test.ts](../__tests__/player-state.test.ts) | [#3][i3] | `waiting` → `countdown` → `racing` → `finished` → (`waiting` \| `closed`) ; voir [ARCHITECTURE.md](ARCHITECTURE.md). |
| COURSE-02 | Lancer avec 2 participants minimum, dont 1 humain | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx) | [#55][i55], [#161][i161] | Le serveur exige 2 coureurs, bots compris, dont au moins un humain : l'hôte qui regarde ne compte pas. |
| COURSE-03 | Décompte synchronisé 3, 2, 1 | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`components/lobby-room.tsx`](../components/lobby-room.tsx) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx) | [#55][i55], [#123][i123] | Choix : le texte apparaît au « Go », pas au début du décompte, pour que personne ne lise d'avance. |
| COURSE-04 | Zone de frappe : retour immédiat, MPM et précision en direct, coller désactivé | Fait | [`components/race-typing.tsx`](../components/race-typing.tsx) | [race-typing.test.tsx](../__tests__/race-typing.test.tsx), [typing.test.ts](../__tests__/typing.test.ts) | [#56][i56], [#124][i124] | MPM et précision en direct avec les formules de l'annexe A (`lib/typing.ts`), recalculés à chaque frappe et chaque seconde. |
| COURSE-05 | Piste : avatar, nom, position, MPM ; fluide ; joueur local en évidence ; spectateurs | Fait | [`components/arena.tsx`](../components/arena.tsx), [`components/lobby-room.tsx`](../components/lobby-room.tsx), [`lib/track.ts`](../lib/track.ts) | [track.test.ts](../__tests__/track.test.ts), [field-motion.test.ts](../__tests__/field-motion.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#57][i57], [#125][i125], [#183][i183] | Choix : le terrain montre les cinq premiers, avec leur nom ; à côté, un classement défilant liste chaque coureur avec avatar, nom, MPM et précision, le joueur local en évidence. Visible des spectateurs. |
| COURSE-06 | Serveur autoritaire, progressions impossibles rejetées | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`lib/progress-check.ts`](../lib/progress-check.ts) | [progress-check.test.ts](../__tests__/progress-check.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#78][i78] | Le serveur décide du départ, de la fin et du classement. Il refuse un compteur qui recule, un texte qui ne suit pas les touches et plus de 300 MPM depuis le départ. |
| COURSE-07 | Abandon avec confirmation | Fait | [`components/lobby-room.tsx`](../components/lobby-room.tsx), [`lib/player-state.ts`](../lib/player-state.ts) | [player-state.test.ts](../__tests__/player-state.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#59][i59] | Le joueur qui abandonne devient spectateur. |
| COURSE-08 | Reprise si retour dans les 30 s, sinon abandon | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`lib/player-state.ts`](../lib/player-state.ts) | [player-state.test.ts](../__tests__/player-state.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [race-typing.test.tsx](../__tests__/race-typing.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#59][i59], [#126][i126] | Le joueur revenu dans les 30 s reprend où il était ; après, il est considéré comme ayant abandonné. |
| COURSE-09 | Fin quand tous ont fini ou abandonné, ou au temps maximal | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`lib/lobby-state.ts`](../lib/lobby-state.ts) | [lobby-state.test.ts](../__tests__/lobby-state.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx) | [#58][i58] | Choix : la course finit aussi après 2 min sans aucune frappe. |
| COURSE-10 | Classement final : terminés, puis temps écoulé, puis abandons | Fait | [`lib/results.ts`](../lib/results.ts) | [results.test.ts](../__tests__/results.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#60][i60], [#128][i128] | Terminés par temps, puis temps écoulé, puis abandons, ces deux derniers par progression. |
| COURSE-11 | Aux résultats, l'hôte relance (avec nouvelle configuration) ou ferme | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`components/lobby-room.tsx`](../components/lobby-room.tsx) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#61][i61], [#73][i73] |  |

## 5.7 Bots (BOT)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| BOT-01 | Cinq niveaux, valeurs documentées | Fait | [`lib/bots.ts`](../lib/bots.ts) | [bots.test.ts](../__tests__/bots.test.ts) | [#76][i76], [#132][i132] | Noob, Débutant, Intermédiaire, Expert, Impossible ; valeurs dans [ARCHITECTURE.md](ARCHITECTURE.md#bots). |
| BOT-02 | Vitesse variable : accélérations, hésitations, mots difficiles | Fait | [`lib/bots.ts`](../lib/bots.ts) | [bots.test.ts](../__tests__/bots.test.ts) | [#132][i132] | Vitesse tirée dans la plage du niveau, séries rapides ou hésitantes, mots difficiles 1,5 fois plus lents. |
| BOT-03 | Erreurs avec temps de correction, selon le mode d'erreur | Fait | [`lib/bots.ts`](../lib/bots.ts) | [bots.test.ts](../__tests__/bots.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#76][i76], [#132][i132] | Une faute coûte le temps de deux touches ; la saisie passe par la même fonction que les joueurs. |
| BOT-04 | Bots identifiés ; soumis aux bonus | Fait | [`components/bot-badge.tsx`](../components/bot-badge.tsx), [`lib/race-bonuses.ts`](../lib/race-bonuses.ts) | [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [race-results.test.tsx](../__tests__/race-results.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#76][i76], [#79][i79], [#132][i132] | Badge « BOT ». Les bots marquent et reçoivent des bonus comme les joueurs ; le ralentissement agit sur le serveur, le flou et le texte réduit ne les visent pas. |
| BOT-05 | Moteur déterministe à partir d'une graine | Fait | [`lib/bots.ts`](../lib/bots.ts) | [bots.test.ts](../__tests__/bots.test.ts) | [#132][i132] | Graine tirée de la course et du bot, générateur mulberry32 ; même graine, même course. |

## 5.8 Bonus de remontée (BONUS)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| BONUS-01 | Bonus aux points de contrôle 25, 50, 75 % pour le joueur en retard | Fait | [`lib/race-bonuses.ts`](../lib/race-bonuses.ts), [`lib/socket-server.ts`](../lib/socket-server.ts) | [race-bonuses.test.ts](../__tests__/race-bonuses.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#79][i79], [#133][i133] | Quand le meneur passe 25, 50 puis 75 % du texte, chaque joueur en retard (dernier, ou plus de 25 % du texte derrière le meneur) tire un but qui donne un bonus. Un seul par point de contrôle : au plus 3 par joueur et par course. Les phrases finies tirent toujours à côté. Le meneur ne reçoit jamais de bonus ; bots compris, abandons exclus. |
| BONUS-02 | Au moins 3 types, dont un qui aide et un qui ralentit le meneur | Fait | [`lib/race-bonuses.ts`](../lib/race-bonuses.ts) | [race-bonuses.test.ts](../__tests__/race-bonuses.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#79][i79] | Six effets : retirer des mots aide celui qui marque ; ajouter des mots, flou, texte réduit, lettres ralenties et mot mélangé visent le plus avancé encore en course. |
| BONUS-03 | Activation annoncée sur la piste et chez la cible | Fait | [`components/lobby-room.tsx`](../components/lobby-room.tsx), [`components/arena.tsx`](../components/arena.tsx) | [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#79][i79], [#133][i133] | Le but est visible de tous sur la piste, puis une bannière sous la piste annonce à toute la salle qui a marqué, la cible et l'effet (4 s). Celui qui marque et la cible ont aussi leur message sous le texte. |
| BONUS-04 | Progression et MPM cohérents si le texte change | Fait | [`lib/race-bonuses.ts`](../lib/race-bonuses.ts), [`lib/socket-server.ts`](../lib/socket-server.ts) | [race-bonuses.test.ts](../__tests__/race-bonuses.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#79][i79] | Chaque joueur a son propre texte ; sa progression est ramenée à la longueur du texte d'origine. Quand le texte change, la saisie est gardée jusqu'au premier caractère différent. |

## 5.9 Résultats et statistiques (RES)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| RES-01 | Podium des 3 premiers | Fait | [`components/race-results.tsx`](../components/race-results.tsx) | [race-results.test.tsx](../__tests__/race-results.test.tsx), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#60][i60] |  |
| RES-02 | Tableau complet : MPM brut, statut, bonus reçus… | Fait | [`components/race-results.tsx`](../components/race-results.tsx), [`lib/results.ts`](../lib/results.ts) | [results.test.ts](../__tests__/results.test.ts), [race-results.test.tsx](../__tests__/race-results.test.tsx) | [#60][i60], [#128][i128] | MPM brut = toutes les touches pressées. Bonus reçus = buts marqués (chacun donne un bonus). |
| RES-03 | Au moins 2 graphiques : MPM dans le temps, touches manquées | Fait | [`components/wpm-chart.tsx`](../components/wpm-chart.tsx), [`components/keyboard-heatmap.tsx`](../components/keyboard-heatmap.tsx), [`lib/heatmap.ts`](../lib/heatmap.ts) | [wpm-chart.test.tsx](../__tests__/wpm-chart.test.tsx), [heatmap.test.ts](../__tests__/heatmap.test.ts), [keyboard-heatmap.test.tsx](../__tests__/keyboard-heatmap.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#77][i77], [#129][i129] | MPM de chaque coureur relevé toutes les secondes, sur un même graphique. |
| RES-04 | Indicateur de record personnel | Fait | [`lib/results.ts`](../lib/results.ts), [`components/race-results.tsx`](../components/race-results.tsx) | [results.test.ts](../__tests__/results.test.ts), [race-results.test.tsx](../__tests__/race-results.test.tsx), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#130][i130] | Badge « Nouveau record » quand le MPM bat celui des courses terminées sans bonus ; pas à la première course. |
| RES-05 | Résultats des humains connectés persistés, avec la série de MPM | Fait | [`lib/results.ts`](../lib/results.ts), [`db/schema.ts`](../db/schema.ts) | [results.test.ts](../__tests__/results.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#60][i60], [#129][i129] | Série de MPM gardée dans `results.wpm_series`. |

## 5.10 Historique (HIST)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| HIST-01 | Historique des courses avec pagination | Fait | [`lib/profile.ts`](../lib/profile.ts), [`app/profile/[username]/page.tsx`](../app/profile/%5Busername%5D/page.tsx) | [profile.test.ts](../__tests__/profile.test.ts), [profile-page.test.tsx](../__tests__/profile-page.test.tsx), [e2e/profile.spec.ts](../e2e/profile.spec.ts) | [#64][i64], [#131][i131] | 10 courses par page (`?page=`). |
| HIST-02 | Cliquer une course réaffiche ses résultats | Fait | [`app/races/[id]/page.tsx`](../app/races/%5Bid%5D/page.tsx), [`lib/results.ts`](../lib/results.ts) | [past-race-page.test.tsx](../__tests__/past-race-page.test.tsx), [results.test.ts](../__tests__/results.test.ts) | [#131][i131] | Page publique `/races/[id]`, liée depuis l'historique. Les bots n'y sont pas : ils ne sont pas enregistrés. |

## 5.11 Internationalisation (I18N)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| I18N-01 | Toute l'interface en français et en anglais | Fait | [`messages/fr.json`](../messages/fr.json), [`messages/en.json`](../messages/en.json) | [messages.test.ts](../__tests__/messages.test.ts), [locale.test.ts](../__tests__/locale.test.ts) | [#10][i10] | Le test vérifie que les deux fichiers ont les mêmes clés. |
| I18N-02 | Sélecteur de langue partout, choix conservé, langue du navigateur par défaut | Fait | [`components/locale-switcher.tsx`](../components/locale-switcher.tsx), [`app/actions/locale.ts`](../app/actions/locale.ts) | [locale-switcher.test.tsx](../__tests__/locale-switcher.test.tsx), [locale-actions.test.ts](../__tests__/locale-actions.test.ts), [e2e/locale.spec.ts](../e2e/locale.spec.ts) | [#10][i10] | Cookie, sinon `Accept-Language`. |
| I18N-03 | Dates et nombres formatés selon la langue | Fait | [`components/race-results.tsx`](../components/race-results.tsx), [`app/profile/[username]/page.tsx`](../app/profile/%5Busername%5D/page.tsx) | [race-results.test.tsx](../__tests__/race-results.test.tsx), [profile-page.test.tsx](../__tests__/profile-page.test.tsx) | [#10][i10], [#60][i60], [#64][i64] | `useFormatter` de next-intl. |

## 6.1 Tests (TEST)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| TEST-01 | Tests unitaires sur la logique | Fait | [`__tests__`](../__tests__) | Vitest, avec PostgreSQL | [#6][i6], [#12][i12] |  |
| TEST-02 | Tests de bout en bout avec Playwright | Fait | [`e2e`](../e2e) | Playwright (Chromium, téléphone, tablette) | [#6][i6], [#40][i40] |  |
| TEST-03 | Bout en bout avec nom d'utilisateur et mot de passe | Fait | [`e2e/auth.spec.ts`](../e2e/auth.spec.ts) | [e2e/auth.spec.ts](../e2e/auth.spec.ts) | [#40][i40] |  |

## 6.2 Performance (PERF)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| PERF-01 | Lighthouse 90+ dans chaque catégorie (accueil) | Fait | [`lib/garage.ts`](../lib/garage.ts) | Mesuré avec Lighthouse 12 | [#138][i138] | Ordinateur : 100 partout. Mobile : performance 91 à 93, 100 ailleurs. zod a été sorti du paquet client de l'accueil. |
| PERF-02 | Progression limitée (≈ 10 messages/s), aucune écriture en base par frappe | Fait | [`components/lobby-room.tsx`](../components/lobby-room.tsx), [`lib/socket-server.ts`](../lib/socket-server.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx) | [#127][i127] | Aucune écriture en base pendant la course. Le client envoie au plus un message par 100 ms ; la frappe finale part tout de suite. |
| PERF-03 | Piste fluide à la capacité maximale | Fait | [`scripts/load-test.ts`](../scripts/load-test.ts), [`components/lobby-room.tsx`](../components/lobby-room.tsx) | [load-test.test.ts](../__tests__/load-test.test.ts) | [#63][i63], [#127][i127], [#183][i183] | Test de charge du serveur avec 300 joueurs (p95 < 500 ms), dix fois la capacité maximale. Côté client, messages limités (PERF-02) et cinq voitures au plus sur le terrain. |

## 6.3 Accessibilité (A11Y)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| A11Y-01 | Contraste WCAG AA dans les deux thèmes | Fait | [`app/globals.css`](../app/globals.css) | [palette.test.ts](../__tests__/palette.test.ts) | [#1][i1], [#138][i138] | Contrastes calculés par le test ; tableau dans la [démarche créative](DEMARCHE-CREATIVE.md#contrastes-wcag-22-aa). |
| A11Y-02 | Balises sémantiques | Fait | [`app/layout.tsx`](../app/layout.tsx) | [e2e/a11y.spec.ts](../e2e/a11y.spec.ts) | [#138][i138] | `header`, `nav`, `main`, `footer`, `table` des résultats. axe (WCAG 2.2 AA) sur chaque page, thèmes clair et sombre, connecté ou non. |
| A11Y-03 | Texte alternatif et libellés | Fait | — | [e2e/a11y.spec.ts](../e2e/a11y.spec.ts) | [#138][i138] | Vérifié par axe sur chaque page. |
| A11Y-04 | Navigation au clavier, focus visible | Fait | [`app/globals.css`](../app/globals.css) | [e2e/a11y.spec.ts](../e2e/a11y.spec.ts) | [#138][i138] | Lien d'évitement et focus visible ; le test vérifie le lien d'évitement au clavier. |

## 6.4 Sécurité (SEC)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| SEC-01 | Actions de l'hôte autorisées côté serveur | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`app/actions/lobbies.ts`](../app/actions/lobbies.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#55][i55], [#26][i26], [#61][i61] | Lancer, configurer, générer des liens, expulser et fermer sont vérifiés par le serveur. |
| SEC-02 | Téléversements validés : type réel et taille | Fait | [`lib/avatars.ts`](../lib/avatars.ts) | [avatars.test.ts](../__tests__/avatars.test.ts), [avatar-actions.test.ts](../__tests__/avatar-actions.test.ts) | [#65][i65] | Le type est lu dans les premiers octets du fichier, pas dans son nom. |
| SEC-03 | Mots de passe hachés (Argon2…), jamais en clair | Fait | [`lib/auth.ts`](../lib/auth.ts) | [auth.test.ts](../__tests__/auth.test.ts) | [#8][i8] | Argon2id avec un poivre (`PASSWORD_PEPPER`). |

[i1]: https://github.com/Madlodon/taype-in/issues/1
[i2]: https://github.com/Madlodon/taype-in/issues/2
[i3]: https://github.com/Madlodon/taype-in/issues/3
[i4]: https://github.com/Madlodon/taype-in/issues/4
[i5]: https://github.com/Madlodon/taype-in/issues/5
[i6]: https://github.com/Madlodon/taype-in/issues/6
[i7]: https://github.com/Madlodon/taype-in/issues/7
[i8]: https://github.com/Madlodon/taype-in/issues/8
[i9]: https://github.com/Madlodon/taype-in/issues/9
[i10]: https://github.com/Madlodon/taype-in/issues/10
[i11]: https://github.com/Madlodon/taype-in/issues/11
[i12]: https://github.com/Madlodon/taype-in/issues/12
[i13]: https://github.com/Madlodon/taype-in/issues/13
[i26]: https://github.com/Madlodon/taype-in/issues/26
[i38]: https://github.com/Madlodon/taype-in/issues/38
[i39]: https://github.com/Madlodon/taype-in/issues/39
[i40]: https://github.com/Madlodon/taype-in/issues/40
[i41]: https://github.com/Madlodon/taype-in/issues/41
[i54]: https://github.com/Madlodon/taype-in/issues/54
[i55]: https://github.com/Madlodon/taype-in/issues/55
[i56]: https://github.com/Madlodon/taype-in/issues/56
[i57]: https://github.com/Madlodon/taype-in/issues/57
[i58]: https://github.com/Madlodon/taype-in/issues/58
[i59]: https://github.com/Madlodon/taype-in/issues/59
[i60]: https://github.com/Madlodon/taype-in/issues/60
[i61]: https://github.com/Madlodon/taype-in/issues/61
[i62]: https://github.com/Madlodon/taype-in/issues/62
[i63]: https://github.com/Madlodon/taype-in/issues/63
[i64]: https://github.com/Madlodon/taype-in/issues/64
[i65]: https://github.com/Madlodon/taype-in/issues/65
[i67]: https://github.com/Madlodon/taype-in/issues/67
[i69]: https://github.com/Madlodon/taype-in/issues/69
[i71]: https://github.com/Madlodon/taype-in/issues/71
[i73]: https://github.com/Madlodon/taype-in/issues/73
[i75]: https://github.com/Madlodon/taype-in/issues/75
[i76]: https://github.com/Madlodon/taype-in/issues/76
[i77]: https://github.com/Madlodon/taype-in/issues/77
[i78]: https://github.com/Madlodon/taype-in/issues/78
[i79]: https://github.com/Madlodon/taype-in/issues/79
[i111]: https://github.com/Madlodon/taype-in/issues/111
[i112]: https://github.com/Madlodon/taype-in/issues/112
[i113]: https://github.com/Madlodon/taype-in/issues/113
[i114]: https://github.com/Madlodon/taype-in/issues/114
[i115]: https://github.com/Madlodon/taype-in/issues/115
[i116]: https://github.com/Madlodon/taype-in/issues/116
[i117]: https://github.com/Madlodon/taype-in/issues/117
[i118]: https://github.com/Madlodon/taype-in/issues/118
[i119]: https://github.com/Madlodon/taype-in/issues/119
[i120]: https://github.com/Madlodon/taype-in/issues/120
[i121]: https://github.com/Madlodon/taype-in/issues/121
[i122]: https://github.com/Madlodon/taype-in/issues/122
[i123]: https://github.com/Madlodon/taype-in/issues/123
[i124]: https://github.com/Madlodon/taype-in/issues/124
[i125]: https://github.com/Madlodon/taype-in/issues/125
[i126]: https://github.com/Madlodon/taype-in/issues/126
[i127]: https://github.com/Madlodon/taype-in/issues/127
[i128]: https://github.com/Madlodon/taype-in/issues/128
[i129]: https://github.com/Madlodon/taype-in/issues/129
[i130]: https://github.com/Madlodon/taype-in/issues/130
[i131]: https://github.com/Madlodon/taype-in/issues/131
[i132]: https://github.com/Madlodon/taype-in/issues/132
[i133]: https://github.com/Madlodon/taype-in/issues/133
[i134]: https://github.com/Madlodon/taype-in/issues/134
[i135]: https://github.com/Madlodon/taype-in/issues/135
[i136]: https://github.com/Madlodon/taype-in/issues/136
[i137]: https://github.com/Madlodon/taype-in/issues/137
[i138]: https://github.com/Madlodon/taype-in/issues/138
[i157]: https://github.com/Madlodon/taype-in/issues/157
[i158]: https://github.com/Madlodon/taype-in/issues/158
[i159]: https://github.com/Madlodon/taype-in/issues/159
[i160]: https://github.com/Madlodon/taype-in/issues/160
[i161]: https://github.com/Madlodon/taype-in/issues/161
[i183]: https://github.com/Madlodon/taype-in/issues/183
