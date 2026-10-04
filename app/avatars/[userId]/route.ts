import { z } from "zod";
import { getAvatarImage } from "@/lib/avatars";

// Photo de profil de n'importe quel joueur, ou ses initiales s'il n'en a pas (PROF-1).
// Le navigateur redemande toujours, mais l'ETag lui évite de retélécharger la même image.
export async function GET(request: Request, { params }: { params: Promise<{ userId: string }> }) {
  const userId = (await params).userId;
  const avatar = z.uuid().safeParse(userId).success ? await getAvatarImage(userId) : null;
  if (!avatar) return new Response(null, { status: 404 });

  const headers = { "Cache-Control": "no-cache", ETag: avatar.etag, "X-Content-Type-Options": "nosniff" };
  if (request.headers.get("If-None-Match") === avatar.etag) return new Response(null, { status: 304, headers });
  return new Response(avatar.body, { headers: { ...headers, "Content-Type": avatar.contentType } });
}
