# Modèle de données

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

## Choix

- **Invités** : un invité est un `users` avec `is_guest = true`. Ses résultats sont liés à son compte, ce qui permet de les garder s'il s'inscrit (AUTH-7).
- **Lobby et course** : un lobby persiste entre plusieurs courses (LOB-9). Les paramètres choisis par l'hôte sont copiés dans chaque `races`, car ils peuvent changer d'une course à l'autre.
- **Texte d'une course** : `races.content` garde le texte exact qui a été tapé (coupé à la longueur choisie ou écrit par l'hôte). `text_id` pointe vers la banque de textes quand il y a lieu ; supprimer un texte de la banque ne touche pas l'historique.
- **Banque de textes** : la migration `0003_banque_de_textes` remplit `texts` avec des textes originaux pour les 12-16 ans (TXT-3). Le lobby garde la langue et la longueur choisies à sa création (`text_language`, `text_length`) ; au départ d'une course, un texte de cette langue est tiré au hasard et coupé à la fin de la phrase qui atteint le nombre de mots.
- **Participants** : `lobby_participants` liste les membres d'un lobby. `joined_at` sert à passer le rôle d'hôte au plus ancien participant.
- **Invitations** : une course privée se rejoint seulement par un lien `lobby_invites` (LOB-3). Le premier qui ouvre le lien le réserve (`used_by`) ; il peut le rouvrir, mais personne d'autre. Les liens ne marchent plus une fois le lobby fermé.
- **Bots** : ils ne sont pas enregistrés. Ils occupent une place dans le classement, donc `results.rank` reste exact, mais seuls les humains ont une ligne dans `results`.
- **Temps réel** : l'état d'une course en cours (positions, frappes) vit en mémoire sur le serveur. La base reçoit les résultats à la fin de la course.
- **Suppressions** : supprimer un lobby supprime ses participants, ses courses et leurs résultats. On ne peut pas supprimer un utilisateur qui est hôte d'un lobby.
