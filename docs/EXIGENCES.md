# Exigences

Matrice de traçabilité des exigences de l'énoncé (*Web V — Travail de session*). Chaque exigence → statut → fichiers → tests → issues.

Statut :

- **Fait** : livré et testé.
- **Partiel** : une partie est livrée ; la note dit ce qui manque.
- **À faire** : rien n'est livré ; une issue est ouverte.

Bilan : 90 exigences, 39 faites, 32 partielles, 19 à faire.

Les choix faits devant une exigence ambiguë sont dans la colonne « Notes et choix ».

## 3. Contraintes techniques (TECH)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| TECH-01 | Next.js (App Router) avec React | Fait | [`app/layout.tsx`](../app/layout.tsx), [`server.ts`](../server.ts) | Toute la suite ; build dans la CI | [#7][i7] | Next.js 16, serveur personnalisé pour Socket.IO sur le même port. |
| TECH-02 | TypeScript à 100 % | Fait | [`tsconfig.json`](../tsconfig.json), [`eslint.config.mjs`](../eslint.config.mjs) | [typescript-only.test.ts](../__tests__/typescript-only.test.ts) | [#137][i137] | `strict`, `allowJs` désactivé, `no-explicit-any` en erreur, `@ts-expect-error` seulement avec une description. |
| TECH-03 | Tailwind CSS | Fait | [`app/globals.css`](../app/globals.css) | — | [#7][i7] | Tailwind v4 ; jetons de couleur dans `globals.css`. |
| TECH-04 | PostgreSQL, migrations versionnées, script de seed | Partiel | [`db/schema.ts`](../db/schema.ts), [`db/migrations`](../db/migrations) | [db/schema.test.ts](../__tests__/db/schema.test.ts), [db/migrate.test.ts](../__tests__/db/migrate.test.ts) | [#5][i5], [#2][i2], [#135][i135] | Drizzle. Il manque le script de seed (corpus, utilisateurs, historique) : #135. |
| TECH-05 | Déployé sur un VPS, public en HTTPS | Fait | [`compose.prod.yml`](../compose.prod.yml), [`Caddyfile`](../Caddyfile) | Vérifié à la main sur https://laniproject.dev | [#13][i13], [#38][i38] | AWS EC2 + Docker Compose ; Caddy obtient le certificat Let's Encrypt. |
| TECH-06 | Progression en temps réel | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#4][i4], [#7][i7], [#57][i57] | Socket.IO auto-hébergé ; voir l'[ADR 0001](adr/0001-realtime.md). |
| TECH-07 | Entrées serveur validées par un schéma | Fait | [`lib/socket-messages.ts`](../lib/socket-messages.ts), [`app/actions/lobbies.ts`](../app/actions/lobbies.ts), [`app/actions/auth.ts`](../app/actions/auth.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [auth-actions.test.ts](../__tests__/auth-actions.test.ts), [avatar-actions.test.ts](../__tests__/avatar-actions.test.ts) | [#7][i7], [#8][i8], [#9][i9] | Zod pour les actions serveur, les routes et chaque message Socket.IO avec des données. La photo est vérifiée par son contenu réel (octets) et sa taille. |
| TECH-08 | Aucun coût pour l'enseignant | Fait | — | — | [#13][i13] | Seul le serveur EC2 est payant, à mes frais. Les photos sont dans PostgreSQL : aucun service de stockage externe. |
| TECH-09 | CI GitHub Actions à chaque push : lint, `tsc --noEmit`, tests unitaires | Fait | [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) | La CI elle-même | [#12][i12], [#40][i40], [#136][i136] | Roule aussi les tests de bout en bout. |
| TECH-10 | `.env.example` documente toutes les variables, aucun secret commité | Partiel | [`.env.example`](../.env.example) | — | [#157][i157] | `PORT` et `GOAL_CHANCE` sont lues par le code mais absentes du fichier. |

## 4. Identité visuelle et design (DES)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| DES-01 | Nom trouvé sans IA, démarche documentée | Fait | [`docs/DEMARCHE-CREATIVE.md`](../docs/DEMARCHE-CREATIVE.md) | — | [#1][i1] | Noms envisagés et raison du choix dans la démarche créative. |
| DES-02 | Logo conçu sans IA, croquis, utilisé dans l'app et en favicon | Partiel | [`app/layout.tsx`](../app/layout.tsx), [`app/icon.svg`](../app/icon.svg) | [site-header.test.tsx](../__tests__/site-header.test.tsx), [e2e/logo.spec.ts](../e2e/logo.spec.ts) | [#39][i39] | Logo et favicon en place. Il manque la photo des croquis dans la démarche créative. |
| DES-03 | Direction artistique : moodboard, palette, typographies | Fait | [`docs/DEMARCHE-CREATIVE.md`](../docs/DEMARCHE-CREATIVE.md), [`docs/moodboard`](../docs/moodboard) | [palette.test.ts](../__tests__/palette.test.ts) | [#1][i1], [#41][i41] |  |
| DES-04 | Design unique, piste comme élément signature | Fait | [`components/arena.tsx`](../components/arena.tsx), [`components/race-typing.tsx`](../components/race-typing.tsx) | [track.test.ts](../__tests__/track.test.ts), [e2e/design.spec.ts](../e2e/design.spec.ts) | [#1][i1], [#57][i57] | Course dans une arène inspirée de Rocket League, vue en coupe. |
| DES-05 | Thèmes clair et sombre, préférence système, aucun flash | Fait | [`components/theme-switcher.tsx`](../components/theme-switcher.tsx) | [theme-switcher.test.tsx](../__tests__/theme-switcher.test.tsx), [e2e/theme.spec.ts](../e2e/theme.spec.ts) | [#11][i11] | next-themes avec la stratégie `class` : le thème est appliqué avant l'affichage. |
| DES-06 | Responsive dès 360 px ; sur mobile, message pour un clavier physique | Partiel | — | [e2e/responsive.spec.ts](../e2e/responsive.spec.ts) | [#62][i62], [#134][i134] | Toutes les pages sont utilisables sur téléphone. Le message à la place de la course : #134. |

## 5.2 Comptes et profil (AUTH)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| AUTH-01 | OAuth Discord et GitHub ; nom d'utilisateur et mot de passe permis | Partiel | [`lib/auth.ts`](../lib/auth.ts), [`app/actions/auth.ts`](../app/actions/auth.ts) | [auth.test.ts](../__tests__/auth.test.ts), [auth-actions.test.ts](../__tests__/auth-actions.test.ts), [e2e/auth.spec.ts](../e2e/auth.spec.ts) | [#8][i8], [#71][i71] | La connexion par mot de passe fonctionne. OAuth Discord et GitHub : #71. |
| AUTH-02 | Pseudonyme d'invité (3 à 20 caractères), session par cookie | Fait | [`lib/auth.ts`](../lib/auth.ts), [`lib/session-cookie.ts`](../lib/session-cookie.ts) | [auth.test.ts](../__tests__/auth.test.ts), [auth-actions.test.ts](../__tests__/auth-actions.test.ts), [e2e/auth.spec.ts](../e2e/auth.spec.ts) | [#8][i8] | Choix : le cookie porte un jeton de session aléatoire (httpOnly), vérifié en base, plutôt qu'un cookie signé. Il ne peut pas être forgé non plus. |
| AUTH-03 | Un invité ne crée pas de salle ; pas d'historique ni de photo, avatar généré | Fait | [`app/actions/lobbies.ts`](../app/actions/lobbies.ts), [`app/actions/avatar.ts`](../app/actions/avatar.ts), [`app/avatars/[userId]/route.ts`](../app/avatars/%5BuserId%5D/route.ts) | [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [avatar-actions.test.ts](../__tests__/avatar-actions.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#111][i111], [#65][i65] | L'invité voit des initiales. Ses résultats sont gardés en base seulement pour les transférer s'il s'inscrit ; il n'a pas de page d'historique. |
| AUTH-04 | Photo de profil JPEG, PNG ou WebP, 2 Mo max, redimensionnée | Partiel | [`lib/avatars.ts`](../lib/avatars.ts), [`app/actions/avatar.ts`](../app/actions/avatar.ts) | [avatars.test.ts](../__tests__/avatars.test.ts), [avatar-actions.test.ts](../__tests__/avatar-actions.test.ts), [avatar-route.test.ts](../__tests__/avatar-route.test.ts), [avatar-form.test.tsx](../__tests__/avatar-form.test.tsx), [e2e/profile.spec.ts](../e2e/profile.spec.ts) | [#65][i65], [#158][i158] | Type et taille validés côté serveur. L'image n'est pas encore redimensionnée avant l'affichage. |
| AUTH-05 | Modifier son pseudonyme | À faire | — | — | [#67][i67] |  |
| AUTH-06 | Profil : meilleur MPM, moyennes, courses, victoires, graphique | Partiel | [`lib/profile.ts`](../lib/profile.ts), [`app/profile/[username]/page.tsx`](../app/profile/%5Busername%5D/page.tsx), [`components/progression-chart.tsx`](../components/progression-chart.tsx) | [profile.test.ts](../__tests__/profile.test.ts), [profile-page.test.tsx](../__tests__/profile-page.test.tsx), [e2e/profile.spec.ts](../e2e/profile.spec.ts) | [#64][i64], [#69][i69], [#131][i131] | Il manque le nombre de victoires : #131. |

## 5.3 Salles et visibilité (SALLE)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| SALLE-01 | Un connecté crée une salle et en est l'hôte ; participant ou spectateur | Fait | [`app/actions/lobbies.ts`](../app/actions/lobbies.ts), [`lib/lobbies.ts`](../lib/lobbies.ts) | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#9][i9], [#73][i73], [#111][i111] | L'hôte choisit au départ de chaque course : « Lancer » ou « Lancer et regarder ». |
| SALLE-02 | Code unique de 6 caractères, sans caractères ambigus | Fait | [`lib/lobbies.ts`](../lib/lobbies.ts) | [lobbies.test.ts](../__tests__/lobbies.test.ts) | [#9][i9] | Alphabet sans 0, O, 1, I ni L. |
| SALLE-03 | Visibilités publique, sur code, privée | Partiel | [`lib/lobbies.ts`](../lib/lobbies.ts), [`db/schema.ts`](../db/schema.ts) | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#9][i9], [#26][i26], [#118][i118] | Les trois existent. Une salle « sur code » n'accepte pas encore les liens d'invitation : #118. |
| SALLE-04 | Liens d'invitation uniques, liés à une IP, révocables | Partiel | [`lib/lobbies.ts`](../lib/lobbies.ts), [`components/invite-links.tsx`](../components/invite-links.tsx), [`app/invite`](../app/invite) | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#26][i26], [#118][i118] | Faits : un lien par invité, statut affiché, jeton de 128 bits, invalide à la fermeture, code seul refusé. Le lien est lié au compte et non à l'IP ; révocation à l'expulsion : #118. |
| SALLE-05 | Capacité choisie par l'hôte (2 à 30), spectateurs exclus | Fait | [`components/lobby-settings-fields.tsx`](../components/lobby-settings-fields.tsx), [`lib/socket-server.ts`](../lib/socket-server.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#112][i112] | 30 par défaut, modifiable avant une relance. Les bots comptent. L'hôte compte à l'entrée, car il ne choisit de regarder qu'au départ : une course regardée a au plus capacité − 1 coureurs. |
| SALLE-06 | Une seule salle à la fois, garanti en base | À faire | — | — | [#113][i113] |  |
| SALLE-07 | L'hôte expulse un participant ou un spectateur | À faire | — | — | [#114][i114] |  |
| SALLE-08 | Transfert d'hôte au plus ancien humain, sinon fermeture | À faire | — | — | [#115][i115] | `joined_at` est déjà en base pour trouver le plus ancien. |
| SALLE-09 | Rejoindre seulement en attente ou aux résultats | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`lib/lobby-state.ts`](../lib/lobby-state.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#116][i116] |  |
| SALLE-10 | Limite d'essais de code par IP | À faire | — | — | [#117][i117] |  |

## 5.4 Rejoindre une course (JOIN)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| JOIN-01 | Champ « rejoindre par code » dès la page d'accueil | Fait | [`components/join-lobby-form.tsx`](../components/join-lobby-form.tsx), [`app/page.tsx`](../app/page.tsx), [`app/lobbies/page.tsx`](../app/lobbies/page.tsx) | [page.test.tsx](../__tests__/page.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#9][i9], [#159][i159] | Le champ est aussi sur l'accueil ; sans session, un code valide mène à la connexion (ou au mode invité) puis à la course. |
| JOIN-02 | Explorateur : infos, filtres langue et complexité, mise à jour en direct | Partiel | [`app/lobbies/page.tsx`](../app/lobbies/page.tsx) | [lobbies.test.ts](../__tests__/lobbies.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#9][i9], [#119][i119] | La liste des salles publiques existe, sans filtres ni mise à jour en direct : #119. |
| JOIN-03 | Bouton « Faire une course » | À faire | — | — | [#120][i120] |  |

## 5.5 Configuration de la course (CONF)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| CONF-01 | Temps maximal : aucun, ou 30 s à 10 min | Partiel | [`components/lobby-settings-fields.tsx`](../components/lobby-settings-fields.tsx), [`lib/lobbies.ts`](../lib/lobbies.ts) | [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [races.test.ts](../__tests__/races.test.ts) | [#58][i58], [#160][i160] | Aujourd'hui en minutes, de 1 min à 24 h. Les bornes de l'énoncé restent à appliquer. |
| CONF-02 | Langue du texte, indépendante de l'interface | Fait | [`lib/texts.ts`](../lib/texts.ts), [`components/lobby-settings-fields.tsx`](../components/lobby-settings-fields.tsx) | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#54][i54] |  |
| CONF-03 | Texte cohérent (corpus en base) ou aléatoire (dictionnaire) | Partiel | [`lib/texts.ts`](../lib/texts.ts), [`db/migrations`](../db/migrations) | [texts.test.ts](../__tests__/texts.test.ts) | [#54][i54], [#75][i75] | Textes cohérents faits (textes originaux pour 12-16 ans). Mode aléatoire : #75. |
| CONF-04 | Longueur en nombre de mots | Fait | [`lib/texts.ts`](../lib/texts.ts) | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#54][i54] | Choix parmi 50, 100 et 200 mots ; le texte est coupé à la fin de la phrase. |
| CONF-05 | Complexité facile, moyen, difficile, critères documentés | À faire | — | — | [#121][i121] |  |
| CONF-06 | Ponctuation, nombres, majuscules, accents | À faire | — | — | [#121][i121] |  |
| CONF-07 | Caractères à inclure ou exclure | À faire | — | — | [#75][i75] |  |
| CONF-08 | Mode d'erreur : correction obligatoire ou libre | Fait | [`lib/typing.ts`](../lib/typing.ts) | [typing.test.ts](../__tests__/typing.test.ts), [races.test.ts](../__tests__/races.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#56][i56] | Choix : en mode libre, chaque faute ajoute une pénalité de temps au classement. |
| CONF-09 | Bonus activés ou non | À faire | — | — | [#79][i79] | La colonne `races.bonuses_enabled` existe déjà. |
| CONF-10 | Ajout et retrait de bots, avec leur niveau | Fait | [`lib/bots.ts`](../lib/bots.ts), [`lib/socket-server.ts`](../lib/socket-server.ts) | [bots.test.ts](../__tests__/bots.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#76][i76] | Quatre niveaux pour l'instant ; cinq avec #132. |
| CONF-11 | Visibilité et capacité | Fait | [`app/actions/lobbies.ts`](../app/actions/lobbies.ts) | [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#9][i9], [#112][i112] |  |
| CONF-12 | Tous voient la configuration en temps réel | À faire | — | — | [#122][i122] |  |

## 5.6 Déroulement d'une course (COURSE)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| COURSE-01 | États explicites, machine à états documentée | Fait | [`lib/lobby-state.ts`](../lib/lobby-state.ts), [`docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md) | [lobby-state.test.ts](../__tests__/lobby-state.test.ts), [player-state.test.ts](../__tests__/player-state.test.ts) | [#3][i3] | `waiting` → `countdown` → `racing` → `finished` → (`waiting` \| `closed`) ; voir [ARCHITECTURE.md](ARCHITECTURE.md). |
| COURSE-02 | Lancer avec 2 participants minimum, dont 1 humain | Partiel | [`lib/socket-server.ts`](../lib/socket-server.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx) | [#55][i55], [#161][i161] | Minimum de 2 vérifié par le serveur, bots compris. La règle « au moins 1 humain » n'est pas vérifiée quand l'hôte regarde avec seulement des bots. |
| COURSE-03 | Décompte synchronisé 3, 2, 1 | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`components/lobby-room.tsx`](../components/lobby-room.tsx) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx) | [#55][i55], [#123][i123] | Choix : le texte apparaît au « Go », pas au début du décompte, pour que personne ne lise d'avance. |
| COURSE-04 | Zone de frappe : retour immédiat, MPM et précision en direct, coller désactivé | Partiel | [`components/race-typing.tsx`](../components/race-typing.tsx) | [race-typing.test.tsx](../__tests__/race-typing.test.tsx), [typing.test.ts](../__tests__/typing.test.ts) | [#56][i56], [#124][i124] | Retour visuel et coller bloqué faits. MPM et précision en direct : #124. |
| COURSE-05 | Piste : avatar, nom, position, MPM ; fluide ; joueur local en évidence ; spectateurs | Partiel | [`components/arena.tsx`](../components/arena.tsx), [`lib/track.ts`](../lib/track.ts) | [track.test.ts](../__tests__/track.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#57][i57], [#125][i125] | Positions en direct, joueur local en évidence, piste visible des spectateurs. Avatar et MPM sur la piste : #125. |
| COURSE-06 | Serveur autoritaire, progressions impossibles rejetées | Partiel | [`lib/socket-server.ts`](../lib/socket-server.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#78][i78] | Le serveur décide du départ, de la fin et du classement. Le rejet des sauts et vitesses irréalistes : #78. |
| COURSE-07 | Abandon avec confirmation | Fait | [`components/lobby-room.tsx`](../components/lobby-room.tsx), [`lib/player-state.ts`](../lib/player-state.ts) | [player-state.test.ts](../__tests__/player-state.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#59][i59] | Le joueur qui abandonne devient spectateur. |
| COURSE-08 | Reprise si retour dans les 30 s, sinon abandon | Partiel | [`lib/socket-server.ts`](../lib/socket-server.ts), [`lib/player-state.ts`](../lib/player-state.ts) | [player-state.test.ts](../__tests__/player-state.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [race-typing.test.tsx](../__tests__/race-typing.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#59][i59], [#126][i126] | La reprise fonctionne, mais sans limite de 30 s : #126. |
| COURSE-09 | Fin quand tous ont fini ou abandonné, ou au temps maximal | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`lib/lobby-state.ts`](../lib/lobby-state.ts) | [lobby-state.test.ts](../__tests__/lobby-state.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx) | [#58][i58] | Choix : la course finit aussi après 2 min sans aucune frappe. |
| COURSE-10 | Classement final : terminés, puis temps écoulé, puis abandons | Partiel | [`lib/results.ts`](../lib/results.ts) | [results.test.ts](../__tests__/results.test.ts) | [#60][i60], [#128][i128] | Terminés par temps, puis les autres par progression. Les abandons ne sont pas encore classés à part : #128. |
| COURSE-11 | Aux résultats, l'hôte relance (avec nouvelle configuration) ou ferme | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`components/lobby-room.tsx`](../components/lobby-room.tsx) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#61][i61], [#73][i73] |  |

## 5.7 Bots (BOT)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| BOT-01 | Cinq niveaux, valeurs documentées | Partiel | [`lib/bots.ts`](../lib/bots.ts) | [bots.test.ts](../__tests__/bots.test.ts) | [#76][i76], [#132][i132] | Quatre niveaux (25, 45, 70, 100 MPM). Les cinq niveaux de l'énoncé : #132, plan dans [ARCHITECTURE.md](ARCHITECTURE.md#bots). |
| BOT-02 | Vitesse variable : accélérations, hésitations, mots difficiles | Partiel | [`lib/bots.ts`](../lib/bots.ts) | [bots.test.ts](../__tests__/bots.test.ts) | [#132][i132] | Délai aléatoire à chaque touche et hésitations. Ralentir sur les mots difficiles : #132. |
| BOT-03 | Erreurs avec temps de correction, selon le mode d'erreur | Fait | [`lib/bots.ts`](../lib/bots.ts) | [bots.test.ts](../__tests__/bots.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#76][i76] | La saisie passe par la même fonction que les joueurs ; en mode bloquant, le bot retape le bon caractère. |
| BOT-04 | Bots identifiés ; soumis aux bonus | Partiel | [`components/bot-badge.tsx`](../components/bot-badge.tsx) | [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [race-results.test.tsx](../__tests__/race-results.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#76][i76], [#133][i133] | Badge « BOT » fait. Les bonus n'existent pas encore : #133. |
| BOT-05 | Moteur déterministe à partir d'une graine | Partiel | [`lib/bots.ts`](../lib/bots.ts) | [bots.test.ts](../__tests__/bots.test.ts) | [#132][i132] | La fonction de hasard est injectée pour les tests, mais pas encore de graine : #132. |

## 5.8 Bonus de remontée (BONUS)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| BONUS-01 | Bonus aux points de contrôle 25, 50, 75 % pour le joueur en retard | À faire | — | — | [#79][i79], [#133][i133] |  |
| BONUS-02 | Au moins 3 types, dont un qui aide et un qui ralentit le meneur | À faire | — | — | [#79][i79], [#133][i133] |  |
| BONUS-03 | Activation annoncée sur la piste et chez la cible | À faire | — | — | [#79][i79], [#133][i133] |  |
| BONUS-04 | Progression et MPM cohérents si le texte change | À faire | — | — | [#79][i79], [#133][i133] |  |

## 5.9 Résultats et statistiques (RES)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| RES-01 | Podium des 3 premiers | Fait | [`components/race-results.tsx`](../components/race-results.tsx) | [race-results.test.tsx](../__tests__/race-results.test.tsx), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#60][i60] |  |
| RES-02 | Tableau complet : MPM brut, statut, bonus reçus… | Partiel | [`components/race-results.tsx`](../components/race-results.tsx), [`lib/results.ts`](../lib/results.ts) | [results.test.ts](../__tests__/results.test.ts), [race-results.test.tsx](../__tests__/race-results.test.tsx) | [#60][i60], [#128][i128] | Rang, joueur, MPM, précision, erreurs et temps faits. MPM brut, statut et bonus : #128. |
| RES-03 | Au moins 2 graphiques : MPM dans le temps, touches manquées | Partiel | [`components/keyboard-heatmap.tsx`](../components/keyboard-heatmap.tsx), [`lib/heatmap.ts`](../lib/heatmap.ts) | [heatmap.test.ts](../__tests__/heatmap.test.ts), [keyboard-heatmap.test.tsx](../__tests__/keyboard-heatmap.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | [#77][i77], [#129][i129] | Carte de chaleur du clavier faite. MPM dans le temps : #129. |
| RES-04 | Indicateur de record personnel | À faire | — | — | [#130][i130] |  |
| RES-05 | Résultats des humains connectés persistés, avec la série de MPM | Partiel | [`lib/results.ts`](../lib/results.ts), [`db/schema.ts`](../db/schema.ts) | [results.test.ts](../__tests__/results.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#60][i60], [#129][i129] | Résultats enregistrés. La série de MPM dans le temps : #129. |

## 5.10 Historique (HIST)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| HIST-01 | Historique des courses avec pagination | Partiel | [`lib/profile.ts`](../lib/profile.ts), [`app/profile/[username]/page.tsx`](../app/profile/%5Busername%5D/page.tsx) | [profile.test.ts](../__tests__/profile.test.ts), [profile-page.test.tsx](../__tests__/profile-page.test.tsx), [e2e/profile.spec.ts](../e2e/profile.spec.ts) | [#64][i64], [#131][i131] | Historique complet sur le profil, sans pagination : #131. |
| HIST-02 | Cliquer une course réaffiche ses résultats | À faire | — | — | [#131][i131] |  |

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
| PERF-01 | Lighthouse 90+ dans chaque catégorie (accueil) | À faire | — | — | [#138][i138] | Pas encore mesuré. |
| PERF-02 | Progression limitée (≈ 10 messages/s), aucune écriture en base par frappe | Partiel | [`components/race-typing.tsx`](../components/race-typing.tsx), [`lib/socket-server.ts`](../lib/socket-server.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts) | [#127][i127] | Aucune écriture en base pendant la course. Le client envoie encore un message par frappe : #127. |
| PERF-03 | Piste fluide à la capacité maximale | Partiel | [`scripts/load-test.ts`](../scripts/load-test.ts) | [load-test.test.ts](../__tests__/load-test.test.ts) | [#63][i63], [#125][i125] | Test de charge du serveur avec 300 joueurs (p95 < 500 ms). Fluidité côté client : #125. |

## 6.3 Accessibilité (A11Y)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| A11Y-01 | Contraste WCAG AA dans les deux thèmes | Fait | [`app/globals.css`](../app/globals.css) | [palette.test.ts](../__tests__/palette.test.ts) | [#1][i1], [#138][i138] | Contrastes calculés par le test ; tableau dans la [démarche créative](DEMARCHE-CREATIVE.md#contrastes-wcag-22-aa). |
| A11Y-02 | Balises sémantiques | Partiel | [`app/layout.tsx`](../app/layout.tsx) | — | [#138][i138] | `header`, `nav`, `main`, `footer`, `table` des résultats en place ; audit complet : #138. |
| A11Y-03 | Texte alternatif et libellés | Partiel | — | — | [#138][i138] | Audit complet : #138. |
| A11Y-04 | Navigation au clavier, focus visible | Partiel | [`app/globals.css`](../app/globals.css) | — | [#138][i138] | Lien d'évitement et focus visible en place ; audit complet : #138. |

## 6.4 Sécurité (SEC)

| ID | Exigence | Statut | Fichiers principaux | Tests | Issues | Notes et choix |
| -- | -------- | ------ | ------------------- | ----- | ------ | -------------- |
| SEC-01 | Actions de l'hôte autorisées côté serveur | Fait | [`lib/socket-server.ts`](../lib/socket-server.ts), [`app/actions/lobbies.ts`](../app/actions/lobbies.ts) | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | [#55][i55], [#26][i26], [#61][i61] | Lancer, configurer, générer des liens et fermer sont vérifiés par le serveur. Expulser viendra avec #114. |
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
