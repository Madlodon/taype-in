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
[i66]: https://github.com/Madlodon/taype-in/issues/66
[i67]: https://github.com/Madlodon/taype-in/issues/67
[i68]: https://github.com/Madlodon/taype-in/issues/68
[i69]: https://github.com/Madlodon/taype-in/issues/69
[i70]: https://github.com/Madlodon/taype-in/issues/70
[i71]: https://github.com/Madlodon/taype-in/issues/71
[i72]: https://github.com/Madlodon/taype-in/issues/72
[i73]: https://github.com/Madlodon/taype-in/issues/73
[i74]: https://github.com/Madlodon/taype-in/issues/74
[i75]: https://github.com/Madlodon/taype-in/issues/75
[i76]: https://github.com/Madlodon/taype-in/issues/76
[i77]: https://github.com/Madlodon/taype-in/issues/77
[i78]: https://github.com/Madlodon/taype-in/issues/78
[i79]: https://github.com/Madlodon/taype-in/issues/79
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
[p52]: https://github.com/Madlodon/taype-in/pull/52
[p81]: https://github.com/Madlodon/taype-in/pull/81
[p82]: https://github.com/Madlodon/taype-in/pull/82

## Authentification (AUTH)

| ID     | Exigence                                     | Prio. | Issue      | PR         | Tests                                                                                                                                         | Statut   |
| ------ | -------------------------------------------- | ----- | ---------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| AUTH-1 | Compte avec nom d'utilisateur + mot de passe | E     | [#8][i8]   | [#25][p25] | [auth.test.ts](../__tests__/auth.test.ts), [auth-actions.test.ts](../__tests__/auth-actions.test.ts), [e2e/auth.spec.ts](../e2e/auth.spec.ts) | Fait     |
| AUTH-2 | OAuth Discord et GitHub                      | S     | [#71][i71] | —          | —                                                                                                                                             | En cours |
| AUTH-3 | Utiliser la plateforme en invité             | E     | [#8][i8]   | [#25][p25] | [auth.test.ts](../__tests__/auth.test.ts), [e2e/auth.spec.ts](../e2e/auth.spec.ts)                                                            | Fait     |
| AUTH-4 | « Se souvenir de moi »                       | S     | [#72][i72] | —          | —                                                                                                                                             | En cours |
| AUTH-5 | Aucune récupération de mot de passe          | E     | [#8][i8]   | [#25][p25] | Aucun (absence de fonction)                                                                                                                   | Fait     |
| AUTH-6 | Mots de passe hachés, cookies httpOnly       | E     | [#8][i8]   | [#25][p25] | [auth.test.ts](../__tests__/auth.test.ts), [auth-actions.test.ts](../__tests__/auth-actions.test.ts), [e2e/auth.spec.ts](../e2e/auth.spec.ts) | Fait     |
| AUTH-7 | L'invité qui s'inscrit garde ses stats       | S     | [#70][i70] | —          | —                                                                                                                                             | En cours |

## Profil et statistiques (PROF)

| ID     | Exigence                                    | Prio. | Issue                  | PR  | Tests | Statut   |
| ------ | ------------------------------------------- | ----- | ---------------------- | --- | ----- | -------- |
| PROF-1 | Photo de profil                             | S     | [#65][i65], [#71][i71] | —   | —     | En cours |
| PROF-2 | Historique des courses                      | E     | [#64][i64]             | —   | —     | En cours |
| PROF-3 | Statistiques globales                       | E     | [#64][i64]             | —   | —     | En cours |
| PROF-4 | Graphique de progression                    | S     | [#69][i69]             | —   | —     | En cours |
| PROF-5 | Statistiques de session de courses          | S     | [#70][i70]             | —   | —     | En cours |
| PROF-6 | Signaler une photo de profil                | —     | [#66][i66]             | —   | —     | En cours |
| PROF-7 | Changer son nom d'utilisateur               | —     | [#67][i67]             | —   | —     | En cours |
| PROF-8 | Bloquer les noms d'utilisateur inappropriés | —     | [#68][i68]             | —   | —     | En cours |

## Lobbys et accès (LOB)

| ID     | Exigence                                   | Prio. | Issue                  | PR                     | Tests                                                                                                                                                                                                                                                                               | Statut   |
| ------ | ------------------------------------------ | ----- | ---------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| LOB-1  | Course publique dans la liste              | E     | [#9][i9]               | [#27][p27]             | [lobbies.test.ts](../__tests__/lobbies.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts)                                                                                                                                                                                      | Fait     |
| LOB-2  | Course non répertoriée rejointe par code   | E     | [#9][i9]               | [#27][p27]             | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts)                                                                                                                         | Fait     |
| LOB-3  | Course privée, liens à usage unique        | S     | [#26][i26]             | [#52][p52]             | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [auth-actions.test.ts](../__tests__/auth-actions.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | Fait     |
| LOB-4  | Accueil → page des lobbys                  | E     | [#9][i9]               | [#27][p27]             | [page.test.tsx](../__tests__/page.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts)                                                                                                                                                                                          | Fait     |
| LOB-5  | Tout utilisateur peut créer et être hôte   | E     | [#9][i9]               | [#27][p27]             | [lobbies.test.ts](../__tests__/lobbies.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts)                                                                                                                                                                        | Fait     |
| LOB-6  | Seul l'hôte démarre ; 2 à 300 participants | E     | [#55][i55], [#63][i63] | —                      | —                                                                                                                                                                                                                                                                                   | En cours |
| LOB-7  | Seul l'hôte invite                         | E     | [#26][i26]             | [#52][p52]             | [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts)                                                                                                                                                                          | Fait     |
| LOB-8  | L'hôte participe ou regarde                | S     | [#73][i73]             | —                      | —                                                                                                                                                                                                                                                                                   | En cours |
| LOB-9  | Relancer le même lobby                     | S     | [#3][i3], [#73][i73]   | [#20][p20]             | [lobby-state.test.ts](../__tests__/lobby-state.test.ts)                                                                                                                                                                                                                             | En cours |
| LOB-10 | L'hôte ferme le lobby                      | E     | [#3][i3], [#61][i61]   | [#20][p20], [#82][p82] | [lobby-state.test.ts](../__tests__/lobby-state.test.ts), [lobbies.test.ts](../__tests__/lobbies.test.ts), [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts)       | Fait     |

## Déroulement de la course (CRS)

| ID    | Exigence                                          | Prio. | Issue                | PR         | Tests                                                                                                              | Statut   |
| ----- | ------------------------------------------------- | ----- | -------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------ | -------- |
| CRS-1 | Même texte, compte à rebours                      | E     | [#3][i3], [#55][i55] | [#20][p20] | [lobby-state.test.ts](../__tests__/lobby-state.test.ts)                                                            | En cours |
| CRS-2 | Positions en temps réel (piste)                   | E     | [#57][i57]           | —          | —                                                                                                                  | En cours |
| CRS-3 | Indicateur de dépassement                         | S     | [#74][i74]           | —          | —                                                                                                                  | En cours |
| CRS-4 | Minuterie optionnelle                             | E     | [#58][i58]           | —          | —                                                                                                                  | En cours |
| CRS-5 | Fin de course (tous finis, minuterie, inactivité) | E     | [#3][i3], [#58][i58] | [#20][p20] | [lobby-state.test.ts](../__tests__/lobby-state.test.ts), [player-state.test.ts](../__tests__/player-state.test.ts) | En cours |
| CRS-6 | Reprise après perte de connexion                  | E     | [#3][i3], [#59][i59] | [#20][p20] | [player-state.test.ts](../__tests__/player-state.test.ts)                                                          | En cours |
| CRS-7 | Bouton « Abandonner » → spectateur                | E     | [#3][i3], [#59][i59] | [#20][p20] | [player-state.test.ts](../__tests__/player-state.test.ts)                                                          | En cours |
| CRS-8 | Interface centrée sur le texte                    | E     | [#56][i56]           | —          | —                                                                                                                  | En cours |

## Textes (TXT)

| ID    | Exigence                            | Prio. | Issue      | PR         | Tests                                                                                                    | Statut   |
| ----- | ----------------------------------- | ----- | ---------- | ---------- | -------------------------------------------------------------------------------------------------------- | -------- |
| TXT-1 | Langue du texte (FR ou EN)          | E     | [#54][i54] | [#81][p81] | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | Fait     |
| TXT-2 | Longueur du texte                   | E     | [#54][i54] | [#81][p81] | [texts.test.ts](../__tests__/texts.test.ts), [lobby-actions.test.ts](../__tests__/lobby-actions.test.ts) | Fait     |
| TXT-3 | Banque de textes pour 12-16 ans     | E     | [#54][i54] | [#81][p81] | [texts.test.ts](../__tests__/texts.test.ts)                                                              | Fait     |
| TXT-4 | Phrases suivies ou mots en désordre | S     | [#75][i75] | —          | —                                                                                                        | En cours |
| TXT-5 | Caractères à inclure ou à cibler    | S     | [#75][i75] | —          | —                                                                                                        | En cours |
| TXT-6 | L'hôte écrit ou modifie le texte    | S     | [#75][i75] | —          | —                                                                                                        | En cours |
| TXT-7 | Génération de textes par IA         | M     | —          | —          | —                                                                                                        | À faire  |
| TXT-8 | Extraits de films                   | M     | —          | —          | —                                                                                                        | À faire  |

## Erreurs de frappe (ERR)

| ID    | Exigence                               | Prio. | Issue      | PR  | Tests | Statut   |
| ----- | -------------------------------------- | ----- | ---------- | --- | ----- | -------- |
| ERR-1 | Mode bloquant ou tolérant              | E     | [#56][i56] | —   | —     | En cours |
| ERR-2 | Caractère erroné mis en évidence       | E     | [#56][i56] | —   | —     | En cours |
| ERR-3 | Fautes dans la précision et la heatmap | E     | [#60][i60] | —   | —     | En cours |

## Bots (BOT)

| ID    | Exigence                     | Prio. | Issue      | PR  | Tests | Statut   |
| ----- | ---------------------------- | ----- | ---------- | --- | ----- | -------- |
| BOT-1 | L'hôte ajoute des bots       | S     | [#76][i76] | —   | —     | En cours |
| BOT-2 | Niveaux de bots              | S     | [#76][i76] | —   | —     | En cours |
| BOT-3 | Bots identifiés visuellement | S     | [#76][i76] | —   | —     | En cours |

## Bonus (BON)

| ID    | Exigence                          | Prio. | Issue      | PR  | Tests | Statut   |
| ----- | --------------------------------- | ----- | ---------- | --- | ----- | -------- |
| BON-1 | Activer ou désactiver les bonus   | M     | [#79][i79] | —   | —     | En cours |
| BON-2 | Bonus pour les 50 % moins avancés | M     | [#79][i79] | —   | —     | En cours |
| BON-3 | Effets des bonus                  | M     | [#79][i79] | —   | —     | En cours |

## Fin de course et résultats (FIN)

| ID    | Exigence                              | Prio. | Issue      | PR  | Tests | Statut   |
| ----- | ------------------------------------- | ----- | ---------- | --- | ----- | -------- |
| FIN-1 | Podium du top 3                       | E     | [#60][i60] | —   | —     | En cours |
| FIN-2 | Classement et statistiques par joueur | E     | [#60][i60] | —   | —     | En cours |
| FIN-3 | Heatmap du clavier                    | S     | [#77][i77] | —   | —     | En cours |
| FIN-4 | Résultats dans l'historique           | E     | [#60][i60] | —   | —     | En cours |

## Interface (UI)

| ID   | Exigence                         | Prio. | Issue                            | PR                                                         | Tests                                                                                                                                                                                                            | Statut   |
| ---- | -------------------------------- | ----- | -------------------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| UI-1 | Interface en français et anglais | E     | [#10][i10]                       | [#28][p28]                                                 | [locale.test.ts](../__tests__/locale.test.ts), [messages.test.ts](../__tests__/messages.test.ts), [locale-switcher.test.tsx](../__tests__/locale-switcher.test.tsx), [e2e/locale.spec.ts](../e2e/locale.spec.ts) | Fait     |
| UI-2 | Responsive                       | E     | [#62][i62]                       | [#49][p49]                                                 | [e2e/design.spec.ts](../e2e/design.spec.ts) (375, 768 et 1440 px)                                                                                                                                                | En cours |
| UI-3 | Mode clair et mode sombre        | S     | [#11][i11]                       | [#29][p29]                                                 | [theme-switcher.test.tsx](../__tests__/theme-switcher.test.tsx), [e2e/theme.spec.ts](../e2e/theme.spec.ts)                                                                                                       | Fait     |
| UI-4 | Direction artistique             | S     | [#1][i1], [#39][i39], [#41][i41] | [#37][p37], [#46][p46], [#47][p47], [#48][p48], [#49][p49] | [palette.test.ts](../__tests__/palette.test.ts), [e2e/home.spec.ts](../e2e/home.spec.ts), [e2e/logo.spec.ts](../e2e/logo.spec.ts), [e2e/design.spec.ts](../e2e/design.spec.ts)                                   | Fait     |

## Technique (TECH)

| ID     | Exigence                                | Prio. | Issue                              | PR                                 | Tests                                                                                                                                                               | Statut   |
| ------ | --------------------------------------- | ----- | ---------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| TECH-1 | React + Next.js + TypeScript + Tailwind | E     | [#7][i7]                           | [#23][p23]                         | Toute la suite (build dans la CI)                                                                                                                                   | Fait     |
| TECH-2 | PostgreSQL                              | E     | [#5][i5], [#2][i2]                 | [#17][p17], [#19][p19]             | [schema.test.ts](../__tests__/db/schema.test.ts), [migrate.test.ts](../__tests__/db/migrate.test.ts)                                                                | Fait     |
| TECH-3 | Hébergé en HTTPS                        | E     | [#13][i13]                         | [#18][p18]                         | Vérifié à la main (https://laniproject.dev)                                                                                                                         | Fait     |
| TECH-4 | Temps réel auto-hébergé (WebSocket)     | E     | [#4][i4], [#7][i7]                 | [#21][p21], [#23][p23]             | [socket-server.test.ts](../__tests__/socket-server.test.ts), [lobby-room.test.tsx](../__tests__/lobby-room.test.tsx), [e2e/lobbies.spec.ts](../e2e/lobbies.spec.ts) | Fait     |
| TECH-5 | Progression validée par le serveur      | S     | [#78][i78]                         | —                                  | —                                                                                                                                                                   | En cours |
| TECH-6 | Tests unitaires et End-to-End           | E     | [#6][i6], [#12][i12], [#40][i40]   | [#16][p16], [#30][p30], [#44][p44] | Vitest (avec PostgreSQL) et Playwright (Chromium), lancés par la [CI](../.github/workflows/ci.yml) sur chaque PR                                                    | Fait     |
| TECH-7 | Code sur GitHub avec documentation      | E     | [#14][i14], [#15][i15], [#42][i42] | [#31][p31], [#32][p32], [#50][p50] | Aucun (documentation)                                                                                                                                               | Fait     |
