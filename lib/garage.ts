// Garage : voiture et objets choisis par le joueur, purement esthétiques (#34).
import { eq } from "drizzle-orm";
import { db } from "../db/index.ts";
import { users } from "../db/schema.ts";
import { DEFAULT_LOADOUT, loadoutSchema, lockLoadout, type Loadout } from "./garage-items.ts";
import { levelFromXp } from "./xp.ts";

// Une valeur inconnue en base (objet retiré) ou un objet trop haut pour le niveau (#35)
// revient au choix par défaut.
export async function getLoadout(userId: string): Promise<Loadout> {
  const [row] = await db
    .select({ car: users.car, boost: users.boost, hat: users.hat, ball: users.ball, stadium: users.stadium, xp: users.xp })
    .from(users)
    .where(eq(users.id, userId));
  return lockLoadout({
    car: loadoutSchema.shape.car.catch(DEFAULT_LOADOUT.car).parse(row?.car),
    boost: loadoutSchema.shape.boost.catch(DEFAULT_LOADOUT.boost).parse(row?.boost),
    hat: loadoutSchema.shape.hat.catch(DEFAULT_LOADOUT.hat).parse(row?.hat),
    ball: loadoutSchema.shape.ball.catch(DEFAULT_LOADOUT.ball).parse(row?.ball),
    stadium: loadoutSchema.shape.stadium.catch(DEFAULT_LOADOUT.stadium).parse(row?.stadium),
  }, levelFromXp(row?.xp ?? 0));
}

export async function saveLoadout(userId: string, loadout: Loadout): Promise<void> {
  await db.update(users).set(loadout).where(eq(users.id, userId));
}
