// Adresse IP de la personne qui fait la requête (SALLE-04).
import { headers } from "next/headers";

// Caddy remplace x-forwarded-for par l'IP du client ; sans proxy, Next.js le remplit
// avec l'adresse du socket. La première entrée est le client.
export async function getClientIp(): Promise<string> {
  const forwarded = (await headers()).get("x-forwarded-for") ?? "";
  return forwarded.split(",")[0].trim();
}
