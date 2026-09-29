---
status: accepted
date: 2026-09-29
---

# Temps réel : Socket.IO auto-hébergé

## Contexte et problème

Pendant une course, chaque joueur doit voir la position des autres en direct (CRS-2) et, s'il perd la connexion, reprendre exactement où il était (CRS-6). Le serveur garde l'état de la course et valide la progression (TECH-5). Il faut donc une communication bidirectionnelle à faible latence entre le navigateur et le serveur.

Le temps réel doit être auto-hébergé, sans service payant (TECH-4), sur le serveur du client en HTTPS (TECH-3) : une instance EC2 avec Docker Compose et Caddy.

## Critères de décision

- Auto-hébergé et gratuit (TECH-4).
- Bidirectionnel : le client envoie ses frappes, le serveur diffuse les positions.
- Reconnexion simple (CRS-6).
- Diffusion à un groupe de joueurs (un lobby), jusqu'à 300 joueurs.
- Fonctionne avec Next.js sur le même port, derrière Caddy.
- Simple à utiliser et à tester.

## Options considérées

- Socket.IO auto-hébergé
- `ws` (WebSocket natif)
- Server-Sent Events (SSE)
- Service hébergé : Supabase Realtime
- Service hébergé : Pusher

## Décision

Option choisie : **Socket.IO auto-hébergé**, attaché au même serveur Node que Next.js (`server.ts`). C'est la seule option qui répond à tous les critères sans avoir à recoder la reconnexion et les salles.

### Conséquences

- Bon : les salles (`rooms`) correspondent directement aux lobbys ; la diffusion à un lobby tient en une ligne.
- Bon : reconnexion automatique, battements de cœur (heartbeat) et accusés de réception (`ack`) inclus.
- Bon : aucun coût ni compte externe ; tout tourne dans le conteneur `app`.
- Mauvais : il faut un serveur personnalisé (`server.ts`) au lieu de `next start` ; le `CMD` du Dockerfile devra changer.
- Mauvais : un seul processus garde l'état des courses en mémoire. Passer à plusieurs instances demanderait un adaptateur (Redis). Ce n'est pas nécessaire pour la charge prévue.
- Mauvais : le client doit utiliser `socket.io-client` (protocole propre à Socket.IO, pas du WebSocket brut).

### Confirmation

L'issue #7 (serveur Next.js personnalisé avec Socket.IO) implémente cette décision. Des tests vérifient qu'un joueur qui rejoint un lobby reçoit les mises à jour des autres joueurs.

## Avantages et inconvénients des options

### Socket.IO auto-hébergé

- Bon : salles, reconnexion, heartbeat et `ack` intégrés.
- Bon : repli en long polling si le WebSocket est bloqué (réseau scolaire).
- Bon : gratuit, largement documenté, s'attache au serveur HTTP de Next.js.
- Neutre : un peu plus lourd que `ws` (surcouche de protocole).
- Mauvais : demande un serveur personnalisé.

### `ws` (WebSocket natif)

- Bon : léger et rapide, standard du navigateur côté client.
- Mauvais : pas de salles, de reconnexion ni de heartbeat ; il faudrait tout recoder.
- Mauvais : demande aussi un serveur personnalisé.

### Server-Sent Events (SSE)

- Bon : simple, HTTP standard, reconnexion automatique du navigateur.
- Mauvais : unidirectionnel (serveur → client) ; chaque frappe devrait passer par une requête HTTP séparée, ce qui ajoute de la latence.
- Mauvais : nombre de connexions limité par navigateur en HTTP/1.1.

### Supabase Realtime

- Bon : aucune infrastructure temps réel à gérer.
- Mauvais : service externe, payant au-delà du forfait gratuit (contraire à TECH-4). L'auto-héberger ajoute plusieurs conteneurs.
- Mauvais : pensé pour diffuser des changements de base de données, pas pour une logique de course validée par le serveur (TECH-5).

### Pusher

- Bon : très simple à intégrer, salles (`channels`) incluses.
- Mauvais : service payant et non auto-hébergeable (contraire à TECH-4).
- Mauvais : limites de connexions et de messages du forfait gratuit trop basses pour une classe entière.

## Plus d'information

- Cahier des charges : CRS-2, CRS-6, TECH-3, TECH-4, TECH-5.
- Format : [MADR](https://adr.github.io/madr/).
