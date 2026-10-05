"use server";

import { getSessionStats, type SessionStats } from "@/lib/session-stats";
import { getCurrentUser } from "@/lib/session-cookie";

// Lue par la salle du lobby à chaque fin de course (PROF-5).
export async function sessionStatsAction(): Promise<SessionStats | null> {
  const user = await getCurrentUser();
  return user ? getSessionStats(user.id) : null;
}
