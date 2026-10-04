// Photo de profil ou initiales, servie par app/avatars/[userId] (PROF-1).
// version change l'adresse quand la photo change, pour ne pas garder l'ancienne à l'écran.
// Décorative : le nom est toujours écrit à côté.
export function Avatar({ userId, version, size }: { userId: string; version?: number | null; size: number }) {
  const src = version ? `/avatars/${userId}?v=${version}` : `/avatars/${userId}`;
  // eslint-disable-next-line @next/next/no-img-element -- image servie par notre route, rien à optimiser
  return <img src={src} alt="" width={size} height={size} className="avatar" />;
}
