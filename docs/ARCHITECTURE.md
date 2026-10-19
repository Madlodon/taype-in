# Architecture

Modèle de données, machines à états, temps réel et bots.

## Modèle de données

Schéma PostgreSQL défini avec Drizzle dans [`db/schema.ts`](../db/schema.ts).

```mermaid
erDiagram
    users ||--o{ sessions : "possède"
    users ||--o{ oauth_accounts : "se connecte avec"
    users ||--o{ lobbies : "héberge"
    users ||--o{ lobby_participants : "rejoint"
    lobbies ||--o{ lobby_participants : "contient"
    lobbies ||--o{ lobby_invites : "invite par"
    users |o--o{ lobby_invites : "utilise"
    lobbies ||--o{ races : "enchaîne"
    texts |o--o{ races : "source de"
    races ||--o{ results : "produit"
    users ||--o{ results : "obtient"

    users {
        uuid id PK
        text username UK "unique sans égard à la casse"
        text password_hash "null : invité ou OAuth"
        boolean is_guest
        text car "garage : octane par défaut"
        text boost "garage : standard par défaut"
        text hat "garage : none par défaut"
        text ball "garage : none par défaut"
        timestamptz created_at
    }

    oauth_accounts {
        oauth_provider provider PK "discord | github"
        text provider_user_id PK "identifiant chez le fournisseur"
        uuid user_id FK
    }

    sessions {
        text id PK
        uuid user_id FK
        timestamptz expires_at
    }

    texts {
        uuid id PK
        language language "fr | en"
        text title
        text content
        text_complexity complexity "easy | medium | hard"
        timestamptz created_at
    }

    lobbies {
        uuid id PK
        text code UK
        lobby_visibility visibility "public | unlisted | private"
        uuid host_id FK
        language text_language "fr | en"
        integer text_length "50 | 100 | 200 mots"
        text_complexity text_complexity "easy | medium | hard"
        boolean text_punctuation
        boolean text_numbers
        boolean text_capitals
        boolean text_accents
        timestamptz created_at
        timestamptz closed_at "null : ouvert"
    }

    lobby_participants {
        uuid lobby_id PK, FK
        uuid user_id PK, FK
        boolean is_spectator
        timestamptz joined_at
    }

    lobby_invites {
        text token PK
        uuid lobby_id FK
        uuid used_by FK "null : lien pas encore utilisé"
        timestamptz created_at
    }

    races {
        uuid id PK
        uuid lobby_id FK
        uuid text_id FK "null : texte écrit par l'hôte"
        text content "texte réellement tapé"
        language language "fr | en"
        error_mode error_mode "blocking | tolerant"
        integer time_limit_seconds "null : pas de minuterie"
        boolean bonuses_enabled
        timestamptz created_at
        timestamptz started_at
        timestamptz ended_at
    }

    results {
        uuid race_id PK, FK
        uuid user_id PK, FK
        integer rank ">= 1"
        real wpm
        real accuracy "0 à 100"
        integer duration_ms
        integer error_count
        boolean finished
        jsonb key_errors "fautes par touche"
    }
```

### Choix

- **Invités** : un invité est un `users` avec `is_guest = true`. Ses résultats sont liés à son compte, ce qui permet de les garder s'il s'inscrit (AUTH-7).
- **Lobby et course** : un lobby persiste entre plusieurs courses (LOB-9). Les paramètres choisis par l'hôte sont copiés dans chaque `races`, car ils peuvent changer d'une course à l'autre.
- **Texte d'une course** : `races.content` garde le texte exact qui a été tapé (coupé à la longueur choisie ou écrit par l'hôte). `text_id` pointe vers la banque de textes quand il y a lieu ; supprimer un texte de la banque ne touche pas l'historique.
- **Banque de textes** : la migration `0003_banque_de_textes` remplit `texts` avec des textes originaux pour les 12-16 ans (TXT-3). Le lobby garde la langue et la longueur choisies à sa création (`text_language`, `text_length`) ; au départ d'une course, un texte de cette langue est tiré au hasard et coupé à la fin de la phrase qui atteint le nombre de mots.
- **Complexité des textes (CONF-05)** : chaque texte de la banque a un niveau (`texts.complexity`) calculé par `textComplexity` (`lib/texts.ts`) à partir de deux critères mesurables :
  - la **longueur moyenne des mots** (lettres par mot) ;
  - les **caractères spéciaux pour 100 mots** : tout sauf les lettres, les espaces, le point, la virgule et l'apostrophe (chiffres, `; : ! ? « » ( ) - $ %`…).

  | Niveau | Français | Anglais |
  | --- | --- | --- |
  | Facile | mots < 4,7 lettres **et** ≤ 2 caractères spéciaux | mots < 4,3 lettres **et** ≤ 2 caractères spéciaux |
  | Difficile | mots ≥ 5,5 lettres **ou** ≥ 8 caractères spéciaux | mots ≥ 5,2 lettres **ou** ≥ 8 caractères spéciaux |
  | Moyen | le reste | le reste |

  Les seuils diffèrent par langue parce que les mots français sont plus longs. La migration `0021_textes_par_complexite` donne trois textes par niveau et par langue ; un test vérifie que le niveau enregistré de chaque texte correspond au calcul. Le lobby garde la complexité choisie (`text_complexity`, moyen par défaut) et, en mode phrases, la course tire un texte de ce niveau. Les mots mélangés et le texte de l'hôte n'utilisent pas la complexité.
- **Options du texte (CONF-06)** : quatre cases (`text_punctuation`, `text_numbers`, `text_capitals`, `text_accents`), toutes cochées par défaut. Une case décochée retire ce contenu du texte coupé, avant qu'il soit copié dans `races.content` : la ponctuation est enlevée (l'apostrophe et le trait d'union à l'intérieur d'un mot restent : « l'école », « peut-être ») ; un mot qui contient un chiffre est enlevé au complet ; le texte passe en minuscules ; les accents et la cédille sont enlevés (« œ » devient « oe »). Une case cochée garde le texte tel qu'il est écrit ; elle n'ajoute pas de contenu. Les options s'appliquent aux phrases de la banque seulement ; les mots mélangés ont leurs caractères ciblés, et le texte de l'hôte est gardé tel quel.
- **Garage** : `car`, `boost`, `hat` et `ball` sont du texte ; les valeurs permises sont dans `lib/garage-items.ts`, donc ajouter un objet ne demande pas de migration. Une valeur inconnue revient au choix par défaut. Seuls les inscrits enregistrent leur garage.
- **Participants** : `lobby_participants` liste les membres d'un lobby. `joined_at` sert à passer le rôle d'hôte au plus ancien participant.
- **Invitations** : une course privée se rejoint seulement par un lien `lobby_invites` (LOB-3). Le premier qui ouvre le lien le réserve (`used_by`) ; il peut le rouvrir, mais personne d'autre. Les liens ne marchent plus une fois le lobby fermé.
- **Bots** : ils ne sont pas enregistrés. Ils occupent une place dans le classement, donc `results.rank` reste exact, mais seuls les humains ont une ligne dans `results`.
- **Temps réel** : l'état d'une course en cours (positions, frappes) vit en mémoire sur le serveur. La base reçoit les résultats à la fin de la course.
- **Suppressions** : supprimer un lobby supprime ses participants, ses courses et leurs résultats. On ne peut pas supprimer un utilisateur qui est hôte d'un lobby.

## Machines à états

Définies en TypeScript dans [`lib/lobby-state.ts`](../lib/lobby-state.ts) et [`lib/player-state.ts`](../lib/player-state.ts). Un événement non permis dans l'état courant lance une erreur.

Les règles « seul l'hôte » et « au moins 2 participants » (LOB-6) sont vérifiées par le serveur avant d'envoyer l'événement.

### Course (lobby) — COURSE-01

```mermaid
stateDiagram-v2
    [*] --> waiting
    waiting --> countdown : start (hôte)
    waiting --> closed : close (hôte)
    countdown --> racing : countdownEnd
    racing --> finished : end (tous ont fini, minuterie, inactivité)
    racing --> finished : stop (hôte)
    finished --> waiting : restart (hôte)
    finished --> closed : close (hôte)
    closed --> [*]
```

| État        | Sens                                                  |
| ----------- | ----------------------------------------------------- |
| `waiting`   | Salle d'attente ; l'hôte règle les paramètres (LOB-9) |
| `countdown` | Compte à rebours avant le départ (CRS-1)              |
| `racing`    | Course en cours                                       |
| `finished`  | Résultats affichés                                    |
| `closed`    | Lobby fermé par l'hôte (LOB-10)                       |

- Le compte à rebours ne peut pas être annulé.
- On ne ferme le lobby qu'en attente ou après une course. Pendant une course, l'hôte peut seulement l'arrêter (`stop`).
- La course se termine (`end`) quand tous ont fini, quand la minuterie est écoulée ou après 2 min sans aucune frappe (CRS-5).

### Joueur (pendant une course)

```mermaid
stateDiagram-v2
    [*] --> connected
    connected --> disconnected : disconnect
    disconnected --> connected : reconnect
    disconnected --> abandoned : 30 s sans retour
    connected --> finished : finish
    connected --> abandoned : abandon
    finished --> [*]
    abandoned --> [*]
```

| État           | Sens                                                     |
| -------------- | -------------------------------------------------------- |
| `connected`    | Tape le texte                                            |
| `disconnected` | Connexion perdue ; la course continue sans lui (CRS-6)   |
| `finished`     | A terminé le texte                                       |
| `abandoned`    | A cliqué sur « Abandonner » ou absent depuis 30 s ; devient spectateur (CRS-7, COURSE-08) |

- Le joueur qui revient dans les 30 s reprend exactement où il était. Après 30 s, il a abandonné (COURSE-08). Si la course finit avant, il est « non terminé ».
- `finished` et `abandoned` sont finaux pour la course. Une déconnexion après coup ne change plus l'état du joueur.

## Temps réel

Socket.IO auto-hébergé, sur le même serveur HTTP et le même port que Next.js ([`server.ts`](../server.ts)). Le choix et les options écartées sont dans l'[ADR 0001](adr/0001-realtime.md).

- Le serveur fait autorité : l'état d'une course en cours vit en mémoire dans [`lib/socket-server.ts`](../lib/socket-server.ts).
- Chaque lobby est une *room* Socket.IO. Les arrivées et départs mettent à jour la liste des participants chez tous.
- Pendant la course, chaque client envoie sa saisie ; le serveur la valide (Zod), calcule les positions et les diffuse à tous, au plus toutes les 250 ms et seulement si quelqu'un a bougé.
- La base reçoit les résultats à la fin de la course seulement.

### Flux des messages

La connexion Socket.IO porte le cookie de session : sans session valide, le serveur la refuse (`notLoggedIn`). Chaque message envoyé par le client reçoit un accusé (`ack`) `{ ok: true }` ou `{ ok: false, error }`.

```mermaid
sequenceDiagram
    autonumber
    participant H as Hôte
    participant J as Joueur
    participant S as Serveur (socket-server.ts)
    participant DB as PostgreSQL

    J->>S: lobby:join { code }
    S->>DB: ajoute le participant
    S-->>J: ack { ok }
    S-->>H: lobby:participants
    S-->>J: lobby:participants

    H->>S: race:start { watch }
    S->>DB: crée la course (texte, réglages)
    S-->>H: race:countdown { seconds: 3 }
    S-->>J: race:countdown { seconds: 3 }
    Note over S: 3 secondes
    S->>DB: course démarrée
    S-->>H: race:started { content, errorMode, racerIds, secondsLeft }
    S-->>J: race:started { … }

    loop à chaque frappe
        J->>S: race:progress { typed, errors, keys, keyErrors }
        S-->>J: ack
        Note over S: validation Zod, position mise à jour
    end
    loop toutes les 250 ms, si quelqu'un a bougé
        S-->>H: race:positions
        S-->>J: race:positions
    end
    opt bonus activés : phrase finie, ou le meneur passe 25, 50 ou 75 %
        S-->>H: race:shot { id, sequence, scored } (tir de chaque joueur en retard)
        S-->>J: race:shot { … }
        S-->>H: race:bonus { effect, from, to } (annonce)
        S-->>J: race:bonus { effect, from, to, content?, removed? } (cible)
    end

    Note over S: tous finis, minuterie écoulée ou 2 min sans frappe
    S->>DB: résultats, rangs, XP
    S-->>H: race:ended { reason, results }
    S-->>J: race:ended { reason, results }
```

| Message                             | Sens                      | Rôle                                                                                                   |
| ----------------------------------- | ------------------------- | ------------------------------------------------------------------------------------------------------ |
| `lobby:join`                        | client → serveur          | Entrer dans un lobby par son code. Refus possibles : introuvable, plein, course en cours, autre lobby. |
| `lobby:participants`                | serveur → lobby           | Liste à jour des participants (joueurs et bots) après chaque arrivée ou départ.                        |
| `lobby:addBot` / `lobby:removeBot`  | hôte → serveur            | Ajouter ou retirer un bot dans la salle d'attente.                                                     |
| `lobby:left`                        | serveur → onglet          | La personne a rejoint un autre lobby : ses autres onglets sortent de celui-ci.                         |
| `race:start`                        | hôte → serveur            | Lancer la course ; `watch` pour regarder sans courir.                                                  |
| `race:countdown`                    | serveur → lobby           | Début du compte à rebours (3 s).                                                                       |
| `race:started`                      | serveur → lobby           | Texte, mode d'erreur et coureurs. Un coureur qui revient reçoit aussi sa saisie (`mine`).              |
| `race:progress`                     | coureur → serveur         | Saisie complète du coureur ; le serveur en déduit la position.                                         |
| `race:positions`                    | serveur → lobby           | Classement en direct, au plus toutes les 250 ms.                                                       |
| `race:shot` / `race:bonus`          | serveur → lobby           | Tir en fin de phrase (30 % de but : un mot retiré) ou à un point de contrôle (but) ; bonus annoncé à tous, texte changé à la cible. |
| `race:giveUp`                       | coureur → serveur         | Abandonner ; la course continue sans lui.                                                              |
| `race:ended`                        | serveur → lobby           | Raison de la fin et résultats.                                                                         |
| `lobby:restart` / `lobby:restarted` | hôte → serveur → lobby    | Revenir aux réglages pour une nouvelle course.                                                         |
| `lobby:close` / `lobby:closed`      | hôte → serveur → lobby    | Fermer le lobby ; tout le monde est renvoyé à la liste.                                                |

**Reconnexion** : un coureur qui recharge la page renvoie `lobby:join`. Le serveur le remet dans la course et lui renvoie `race:started` avec sa saisie, puis `race:positions`. Après la fin, il reçoit directement `race:ended`.

## Bots

Le choix d'un moteur côté serveur et les options écartées sont dans l'[ADR 0002](adr/0002-bots.md).

Moteur dans [`lib/bots.ts`](../lib/bots.ts), lancé par le serveur de sockets ([#76](https://github.com/Madlodon/taype-in/issues/76), [#132](https://github.com/Madlodon/taype-in/issues/132)).

- L'hôte ajoute ou retire des bots dans la salle d'attente. Ils restent d'une course à l'autre.
- Un bot est un participant sans compte : il prend une place au classement, mais n'a pas de ligne dans `results`.
- Le serveur garde une minuterie par bot. À chaque touche, `botKey` donne le délai avant la prochaine touche et la saisie qui en résulte.

Cinq niveaux, avec les valeurs de l'énoncé (BOT-01). La vitesse est mesurée sur un texte simple ; l'XP des joueurs est multipliée selon le niveau des bots (moyenne avec ×1 par joueur).

| Niveau        | MPM visé | Taux d'erreur | XP    |
| ------------- | -------- | ------------- | ----- |
| Noob          | 10–20    | 12 %          | ×0,25 |
| Débutant      | 20–35    | 8 %           | ×0,5  |
| Intermédiaire | 35–60    | 5 %           | ×1    |
| Expert        | 70–100   | 2 %           | ×1,5  |
| Impossible    | 140–170  | 0,5 %         | ×2    |

- **Vitesse variable** (BOT-02) : chaque bot tire sa vitesse dans la plage de son niveau au départ. Pendant la course, il tape par séries de 5 à 19 touches : plus vite (×0,7 du délai, 30 %), normalement (50 %) ou en hésitant (×2,5, 20 %). Chaque touche varie aussi de ±50 %. Il tape les mots difficiles (8 caractères ou plus, accent, majuscule ou ponctuation) 1,5 fois plus lentement.
- **Erreurs** (BOT-03) : une faute coûte le temps de deux touches pour la remarquer. La saisie passe par `applyInput`, comme pour un joueur : en mode bloquant, le bot retape le bon caractère ; en mode tolérant, il continue avec la faute.
- **Identifiés** (BOT-04) : badge « BOT » dans la salle, sur la piste et dans les résultats. Leur progression passe par `updateProgress`, comme celle des joueurs : ils tirent au but en finissant une phrase, et un but leur retire un mot, qu'ils sautent.
- **Déterministe** (BOT-05) : chaque bot reçoit une graine tirée de l'id de la course, de son niveau et de son numéro (`botSeed`). Un générateur à graine (mulberry32) remplace `Math.random` : la même graine donne toujours la même course, ce que vérifient les tests unitaires.
