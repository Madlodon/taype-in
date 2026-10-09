// Machine à états d'un joueur pendant une course (CRS-6, CRS-7).
// COURSE-08 : un joueur déconnecté reprend où il était s'il revient dans les 30 s ;
// sinon il abandonne (le délai est géré par le serveur).

export type PlayerState = "connected" | "disconnected" | "finished" | "abandoned";

export type PlayerEvent =
  | "disconnect"
  | "reconnect" // reprend exactement où il était (CRS-6)
  | "finish"
  | "abandon"; // devient spectateur (CRS-7), ou absent depuis 30 s (COURSE-08)

const transitions: Record<PlayerState, Partial<Record<PlayerEvent, PlayerState>>> = {
  connected: { disconnect: "disconnected", finish: "finished", abandon: "abandoned" },
  disconnected: { reconnect: "connected", abandon: "abandoned" },
  finished: {},
  abandoned: {},
};

export function nextPlayerState(state: PlayerState, event: PlayerEvent): PlayerState {
  const next = transitions[state][event];
  if (!next) {
    throw new Error(`Transition de joueur invalide : ${event} depuis ${state}`);
  }
  return next;
}
