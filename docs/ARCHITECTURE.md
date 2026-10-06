# Architecture

Modèle de données, machines à états, temps réel et bots.

## Modèle de données

Schéma PostgreSQL défini avec Drizzle dans [`db/schema.ts`](../db/schema.ts).

```mermaid
erDiagram
    users ||--o{ sessions : "possède"
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
        timestamptz created_at
    }

    lobbies {
        uuid id PK
        text code UK
        lobby_visibility visibility "public | unlisted | private"
        uuid host_id FK
        language text_language "fr | en"
        integer text_length "50 | 100 | 200 mots"
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
| `abandoned`    | A cliqué sur « Abandonner » ; devient spectateur (CRS-7) |

- Pas de délai d'abandon : le joueur peut revenir tant que la course dure et reprend exactement où il était. S'il est encore absent à la fin, il est « non terminé ».
- `finished` et `abandoned` sont finaux pour la course. Une déconnexion après coup ne change plus l'état du joueur.

## Temps réel

Socket.IO auto-hébergé, sur le même serveur HTTP et le même port que Next.js ([`server.ts`](../server.ts)). Le choix et les options écartées sont dans l'[ADR 0001](adr/0001-realtime.md).

- Le serveur fait autorité : l'état d'une course en cours vit en mémoire dans [`lib/socket-server.ts`](../lib/socket-server.ts).
- Chaque lobby est une *room* Socket.IO. Les arrivées et départs mettent à jour la liste des participants chez tous.
- Pendant la course, chaque client envoie sa saisie ; le serveur la valide (Zod), calcule les positions et les diffuse à tous, au plus toutes les 250 ms et seulement si quelqu'un a bougé.
- La base reçoit les résultats à la fin de la course seulement.
