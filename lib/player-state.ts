// Machine à états d'un joueur pendant une course (CRS-6, CRS-7).
// Pas de délai d'abandon : un joueur déconnecté peut revenir tant que la course dure ;
// s'il est encore absent à la fin, il est « non terminé ».

export type PlayerState = "connected" | "disconnected" | "finished" | "abandoned";

export type PlayerEvent =
  | "disconnect"
  | "reconnect" // reprend exactement où il était (CRS-6)
  | "finish"
  | "abandon"; // devient spectateur (CRS-7)

const transitions: Record<PlayerState, Partial<Record<PlayerEvent, PlayerState>>> = {
  connected: { disconnect: "disconnected", finish: "finished", abandon: "abandoned" },
  disconnected: { reconnect: "connected" },
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
