# Modèle de données

Schéma PostgreSQL défini avec Drizzle dans [`db/schema.ts`](../db/schema.ts).

```mermaid
erDiagram
    users ||--o{ sessions : "possède"
    users ||--o{ lobbies : "héberge"
    users ||--o{ lobby_participants : "rejoint"
    lobbies ||--o{ lobby_participants : "contient"
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
        timestamptz created_at
        timestamptz closed_at "null : ouvert"
    }

    lobby_participants {
        uuid lobby_id PK, FK
        uuid user_id PK, FK
        boolean is_spectator
        timestamptz joined_at
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
- **Participants** : `lobby_participants` liste les membres d'un lobby. `joined_at` sert à passer le rôle d'hôte au plus ancien participant.
- **Bots** : ils ne sont pas enregistrés. Ils occupent une place dans le classement, donc `results.rank` reste exact, mais seuls les humains ont une ligne dans `results`.
- **Temps réel** : l'état d'une course en cours (positions, frappes) vit en mémoire sur le serveur. La base reçoit les résultats à la fin de la course.
- **Suppressions** : supprimer un lobby supprime ses participants, ses courses et leurs résultats. On ne peut pas supprimer un utilisateur qui est hôte d'un lobby.
