// Machine à états d'un lobby (CRS-1, CRS-5, LOB-9, LOB-10).
// Les règles « seul l'hôte » et « au moins 2 participants » sont vérifiées par le serveur.

export type LobbyState = "waiting" | "countdown" | "racing" | "finished" | "closed";

export type LobbyEvent =
  | "start" // l'hôte lance le compte à rebours
  | "countdownEnd"
  | "end" // tous ont fini, minuterie écoulée ou inactivité (CRS-5)
  | "stop" // l'hôte arrête la course
  | "restart" // l'hôte relance le même lobby (LOB-9)
  | "close"; // l'hôte ferme le lobby (LOB-10)

const transitions: Record<LobbyState, Partial<Record<LobbyEvent, LobbyState>>> = {
  waiting: { start: "countdown", close: "closed" },
  countdown: { countdownEnd: "racing" },
  racing: { end: "finished", stop: "finished" },
  finished: { restart: "waiting", close: "closed" },
  closed: {},
};

export function nextLobbyState(state: LobbyState, event: LobbyEvent): LobbyState {
  const next = transitions[state][event];
  if (!next) {
    throw new Error(`Transition de lobby invalide : ${event} depuis ${state}`);
  }
  return next;
}
