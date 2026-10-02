# Matrice des exigences

Chaque exigence du [cahier des charges (v1.1)](cahier-des-charges.pdf) → issue → PR → tests → statut.

Priorité : **E** essentiel, **S** souhaitable, **M** moins prioritaire.

Statut :

- **Fait** : l'exigence est livrée et testée.
- **Partiel** : une partie est livrée (ex. la machine à états), le reste viendra avec la course.
- **En cours** : une issue est ouverte.
- **À faire** : aucune issue pour l'instant.

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
[i14]: https://github.com/Madlodon/taype-in/issues/14
[i15]: https://github.com/Madlodon/taype-in/issues/15
[i26]: https://github.com/Madlodon/taype-in/issues/26
[i39]: https://github.com/Madlodon/taype-in/issues/39
[i40]: https://github.com/Madlodon/taype-in/issues/40
[i41]: https://github.com/Madlodon/taype-in/issues/41
[i42]: https://github.com/Madlodon/taype-in/issues/42
[i54]: https://github.com/Madlodon/taype-in/issues/54
[p16]: https://github.com/Madlodon/taype-in/pull/16
[p17]: https://github.com/Madlodon/taype-in/pull/17
[p18]: https://github.com/Madlodon/taype-in/pull/18
[p19]: https://github.com/Madlodon/taype-in/pull/19
[p20]: https://github.com/Madlodon/taype-in/pull/20
[p21]: https://github.com/Madlodon/taype-in/pull/21
[p23]: https://github.com/Madlodon/taype-in/pull/23
[p25]: https://github.com/Madlodon/taype-in/pull/25
[p27]: https://github.com/Madlodon/taype-in/pull/27
[p28]: https://github.com/Madlodon/taype-in/pull/28
[p29]: https://github.com/Madlodon/taype-in/pull/29
[p30]: https://github.com/Madlodon/taype-in/pull/30
[p31]: https://github.com/Madlodon/taype-in/pull/31
[p32]: https://github.com/Madlodon/taype-in/pull/32
[p37]: https://github.com/Madlodon/taype-in/pull/37
[p44]: https://github.com/Madlodon/taype-in/pull/44
[p46]: https://github.com/Madlodon/taype-in/pull/46
[p47]: https://github.com/Madlodon/taype-in/pull/47
[p48]: https://github.com/Madlodon/taype-in/pull/48
[p49]: https://github.com/Madlodon/taype-in/pull/49
[p50]: https://github.com/Madlodon/taype-in/pull/50

## Authentification (AUTH)

| ID     | Exigence                                      | Prio. | Issue      | PR         | Tests                                                                                                  | Statut  |
| ------ | --------------------------------------------- | ----- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------ | ------- |
| AUTH-1 | Compte avec nom d'utilisateur + mot de passe  | E     | [#8][i8]   | [#25][p25] | [auth.test.ts](../__tests__/auth.test.ts), [auth-actions.test.ts](../__tests__/auth-actions.test.ts), [e2e/auth.spec.ts](../e2e/auth.spec.ts) | Fait    |
| AUTH-2 | OAuth Discord et GitHub                       | S     | —          | —          | —                                                                                                      | À faire |
| AUTH-3 | Utiliser la plateforme en invité              | E     | [#8][i8]   | [#25][p25] | [auth.test.ts](../__tests__/auth.test.ts), [e2e/auth.spec.ts](../e2e/auth.spec.ts)                     | Fait    |
| AUTH-4 | « Se souvenir de moi »                        | S     | —          | —          | —                                                                                                      | À faire |
| AUTH-5 | Aucune récupération de mot de passe           | E     | [#8][i8]   | [#25][p25] | Aucun (absence de fonction)                                                                            | Fait    |
| AUTH-6 | Mots de passe hachés, cookies httpOnly        | E     | [#8][i8]   | [#25][p25] | [auth.test.ts](../__tests__/auth.test.ts), [auth-actions.test.ts](../__tests__/auth-actions.test.ts), [e2e/auth.spec.ts](../e2e/auth.spec.ts) | Fait    |
| AUTH-7 | L'invité qui s'inscrit garde ses stats        | S     | —          | —          | —                                                                                                      | À faire |

## Profil et statistiques (PROF)

| ID     | Exigence                                  | Prio. | Issue | PR | Tests | Statut  |
| ------ | ----------------------------------------- | ----- | ----- | -- | ----- | ------- |
| PROF-1 | Photo de profil                           | S     | —     | —  | —     | À faire |
| PROF-2 | Historique des courses                    | E     | —     | —  | —     | À faire |
| PROF-3 | Statistiques globales                     | E     | —     | —  | —     | À faire |
| PROF-4 | Graphique de progression                  | S     | —     | —  | —     | À faire |
| PROF-5 | Statistiques de session de courses        | S     | —     | —  | —     | À faire |

## Lobbys et accès (LOB)

| ID     | Exigence                                         | Prio. | Issue      | PR         | Tests                                                                                                                                                  | Statut   |
| ------ | ------------------------------------------------ | ----- | ---------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| LOB-1  | Course publique dans la liste                    | E     | [#9][i9]   | [#27][p27] | [lobbies.test.ts](../__tests__/lobbies.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts)                                                         | Fait     |
| LOB-2  | Course non répertoriée rejointe par code         | E     | [#9][i9]   | [#27][p27] | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | Fait     |
| LOB-3  | Course privée, liens à usage unique              | S     | [#26][i26] | —          | —                                                                                                                                                      | En cours |
| LOB-4  | Accueil → page des lobbys                        | E     | [#9][i9]   | [#27][p27] | [page.test.tsx](../__tests__/page.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts)                                                             | Fait     |
| LOB-5  | Tout utilisateur peut créer et être hôte         | E     | [#9][i9]   | [#27][p27] | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts)                                           | Fait     |
| LOB-6  | Seul l'hôte démarre ; 2 à 300 participants       | E     | —          | —          | —                                                                                                                                                      | À faire  |
| LOB-7  | Seul l'hôte invite                               | E     | [#26][i26] | —          | —                                                                                                                                                      | En cours |
| LOB-8  | L'hôte participe ou regarde                      | S     | —          | —          | —                                                                                                                                                      | À faire  |
| LOB-9  | Relancer le même lobby                           | S     | [#3][i3]   | [#20][p20] | [lobby-state.test.ts](../__tests__/lobby-state.test.ts)                                                                                                | Partiel  |
| LOB-10 | L'hôte ferme le lobby                            | E     | [#3][i3]   | [#20][p20] | [lobby-state.test.ts](../__tests__/lobby-state.test.ts)                                                                                                | Partiel  |

## Déroulement de la course (CRS)

| ID    | Exigence                                    | Prio. | Issue    | PR         | Tests                                                     | Statut  |
| ----- | ------------------------------------------- | ----- | -------- | ---------- | --------------------------------------------------------- | ------- |
| CRS-1 | Même texte, compte à rebours                | E     | [#3][i3] | [#20][p20] | [lobby-state.test.ts](../__tests__/lobby-state.test.ts)   | Partiel |
| CRS-2 | Positions en temps réel (piste)             | E     | —        | —          | —                                                         | À faire |
| CRS-3 | Indicateur de dépassement                   | S     | —        | —          | —                                                         | À faire |
| CRS-4 | Minuterie optionnelle                       | E     | —        | —          | —                                                         | À faire |
| CRS-5 | Fin de course (tous finis, minuterie, inactivité) | E | [#3][i3] | [#20][p20] | [lobby-state.test.ts](../__tests__/lobby-state.test.ts), [player-state.test.ts](../__tests__/player-state.test.ts) | Partiel |
| CRS-6 | Reprise après perte de connexion            | E     | [#3][i3] | [#20][p20] | [player-state.test.ts](../__tests__/player-state.test.ts) | Partiel |
| CRS-7 | Bouton « Abandonner » → spectateur          | E     | [#3][i3] | [#20][p20] | [player-state.test.ts](../__tests__/player-state.test.ts) | Partiel |
| CRS-8 | Interface centrée sur le texte              | E     | —        | —          | —                                                         | À faire |

## Textes (TXT)

| ID    | Exigence                                  | Prio. | Issue | PR | Tests | Statut  |
| ----- | ----------------------------------------- | ----- | ----- | -- | ----- | ------- |
| TXT-1 | Langue du texte (FR ou EN)                | E     | [#54][i54] | —  | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | Fait |
| TXT-2 | Longueur du texte                         | E     | [#54][i54] | —  | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | Fait |
| TXT-3 | Banque de textes pour 12-16 ans           | E     | [#54][i54] | —  | [texts.test.ts](../__tests__/texts.test.ts) | Fait |
| TXT-4 | Phrases suivies ou mots en désordre       | S     | —     | —  | —     | À faire |
| TXT-5 | Caractères à inclure ou à cibler          | S     | —     | —  | —     | À faire |
| TXT-6 | L'hôte écrit ou modifie le texte          | S     | —     | —  | —     | À faire |
| TXT-7 | Génération de textes par IA               | M     | —     | —  | —     | À faire |
| TXT-8 | Extraits de films                         | M     | —     | —  | —     | À faire |

## Erreurs de frappe (ERR)

| ID    | Exigence                                  | Prio. | Issue | PR | Tests | Statut  |
| ----- | ----------------------------------------- | ----- | ----- | -- | ----- | ------- |
| ERR-1 | Mode bloquant ou tolérant                 | E     | —     | —  | —     | À faire |
| ERR-2 | Caractère erroné mis en évidence          | E     | —     | —  | —     | À faire |
| ERR-3 | Fautes dans la précision et la heatmap    | E     | —     | —  | —     | À faire |

## Bots (BOT)

| ID    | Exigence                                  | Prio. | Issue | PR | Tests | Statut  |
| ----- | ----------------------------------------- | ----- | ----- | -- | ----- | ------- |
| BOT-1 | L'hôte ajoute des bots                    | S     | —     | —  | —     | À faire |
| BOT-2 | Niveaux de bots                           | S     | —     | —  | —     | À faire |
| BOT-3 | Bots identifiés visuellement              | S     | —     | —  | —     | À faire |

## Bonus (BON)

| ID    | Exigence                                  | Prio. | Issue | PR | Tests | Statut  |
| ----- | ----------------------------------------- | ----- | ----- | -- | ----- | ------- |
| BON-1 | Activer ou désactiver les bonus           | M     | —     | —  | —     | À faire |
| BON-2 | Bonus pour les 50 % moins avancés         | M     | —     | —  | —     | À faire |
| BON-3 | Effets des bonus                          | M     | —     | —  | —     | À faire |

## Fin de course et résultats (FIN)

| ID    | Exigence                                  | Prio. | Issue | PR | Tests | Statut  |
| ----- | ----------------------------------------- | ----- | ----- | -- | ----- | ------- |
| FIN-1 | Podium du top 3                           | E     | —     | —  | —     | À faire |
| FIN-2 | Classement et statistiques par joueur     | E     | —     | —  | —     | À faire |
| FIN-3 | Heatmap du clavier                        | S     | —     | —  | —     | À faire |
| FIN-4 | Résultats dans l'historique               | E     | —     | —  | —     | À faire |

## Interface (UI)

| ID   | Exigence                         | Prio. | Issue                            | PR                                                         | Tests                                                                                                                                                                                                                                       | Statut |
| ---- | -------------------------------- | ----- | -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| UI-1 | Interface en français et anglais | E     | [#10][i10]                       | [#28][p28]                                                 | [locale.test.ts](../__tests__/locale.test.ts), [messages.test.ts](../__tests__/messages.test.ts), [locale-switcher.test.tsx](../__tests__/locale-switcher.test.tsx), [e2e/locale.spec.ts](../e2e/locale.spec.ts)                            | Fait   |
| UI-2 | Responsive                       | E     | —                                | [#49][p49]                                                 | [e2e/design.spec.ts](../e2e/design.spec.ts) (375, 768 et 1440 px)                                                                                                                                                                           | Fait   |
| UI-3 | Mode clair et mode sombre        | S     | [#11][i11]                       | [#29][p29]                                                 | [theme-switcher.test.tsx](../__tests__/theme-switcher.test.tsx), [e2e/theme.spec.ts](../e2e/theme.spec.ts)                                                                                                                                  | Fait   |
| UI-4 | Direction artistique             | S     | [#1][i1], [#39][i39], [#41][i41] | [#37][p37], [#46][p46], [#47][p47], [#48][p48], [#49][p49] | [palette.test.ts](../__tests__/palette.test.ts), [e2e/home.spec.ts](../e2e/home.spec.ts), [e2e/logo.spec.ts](../e2e/logo.spec.ts), [e2e/design.spec.ts](../e2e/design.spec.ts)                                                              | Fait   |

## Technique (TECH)

| ID     | Exigence                                | Prio. | Issue                              | PR                                 | Tests                                                                                                                                                               | Statut  |
| ------ | --------------------------------------- | ----- | ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- |
| TECH-1 | React + Next.js + TypeScript + Tailwind | E     | [#7][i7]                           | [#23][p23]                         | Toute la suite (build dans la CI)                                                                                                                                   | Fait    |
| TECH-2 | PostgreSQL                              | E     | [#5][i5], [#2][i2]                 | [#17][p17], [#19][p19]             | [schema.test.ts](../__tests__/db/schema.test.ts), [migrate.test.ts](../__tests__/db/migrate.test.ts)                                                                | Fait    |
| TECH-3 | Hébergé en HTTPS                        | E     | [#13][i13]                         | [#18][p18]                         | Vérifié à la main (https://laniproject.dev)                                                                                                                         | Fait    |
| TECH-4 | Temps réel auto-hébergé (WebSocket)     | E     | [#4][i4], [#7][i7]                 | [#21][p21], [#23][p23]             | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | Fait    |
| TECH-5 | Progression validée par le serveur      | S     | —                                  | —                                  | —                                                                                                                                                                   | À faire |
| TECH-6 | Tests unitaires et End-to-End           | E     | [#6][i6], [#12][i12], [#40][i40]   | [#16][p16], [#30][p30], [#44][p44] | Vitest (avec PostgreSQL) et Playwright (Chromium), lancés par la [CI](../.github/workflows/ci.yml) sur chaque PR                                                    | Fait    |
| TECH-7 | Code sur GitHub avec documentation      | E     | [#14][i14], [#15][i15], [#42][i42] | [#31][p31], [#32][p32], [#50][p50] | Aucun (documentation)                                                                                                                                               | Fait    |
