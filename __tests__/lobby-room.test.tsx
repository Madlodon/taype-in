import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LobbyRoom } from "../components/lobby-room";
import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { STADIUMS, type Stadium } from "../lib/garage-items";

type Handler = (...args: unknown[]) => void;

// Faux socket : garde les écouteurs pour simuler les messages du serveur.
const handlers: Record<string, Handler> = {};
const socket = {
  on: vi.fn((event: string, handler: Handler) => (handlers[event] = handler)),
  emit: vi.fn(),
  disconnect: vi.fn(),
  // Vrai tant que Socket.IO essaie de se reconnecter.
  active: false,
};

vi.mock("socket.io-client", () => ({ io: () => socket }));

const router = { replace: vi.fn(), push: vi.fn(), refresh: vi.fn() };
const loadSessionStats = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// u1 est l'hôte ; l'utilisateur courant est u1 s'il est hôte, sinon u2.
// Le socket se connecte aussitôt rendu.
function renderRoom(locale: "fr" | "en" = "fr", isHost = false, stadium?: Stadium) {
  const result = render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <LobbyRoom code="K7P3XM" hostId="u1" userId={isHost ? "u1" : "u2"} stadium={stadium}
        loadSessionStats={loadSessionStats} />
    </NextIntlClientProvider>,
  );
  act(() => handlers["connect"]());
  return result;
}

function sendParticipants() {
  act(() =>
    handlers["lobby:participants"]({ hostId: "u1",
      participants: [
        { id: "u1", username: "alex" },
        { id: "u2", username: "Invité-123456" },
      ],
    }),
  );
}

function listedNames() {
  return within(screen.getByRole("list", { name: "Participants" }))
    .getAllByRole("listitem")
    .map((item) => item.textContent);
}

beforeEach(() => {
  vi.clearAllMocks();
  socket.active = false;
  loadSessionStats.mockResolvedValue(null);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

test("Should_JoinLobbyByCode_When_Mounted", () => {
  renderRoom();

  expect(socket.emit).toHaveBeenCalledWith("lobby:join", { code: "K7P3XM" }, expect.any(Function));
});

test("Should_ShowParticipantsAndMarkHost_When_ServerSendsList", () => {
  renderRoom();

  sendParticipants();

  expect(listedNames()).toEqual(["alex (hôte)", "Invité-123456"]);
});

test("Should_MarkHostInEnglish_When_LocaleIsEnglish", () => {
  renderRoom("en");

  sendParticipants();

  expect(listedNames()).toEqual(["alex (host)", "Invité-123456"]);
});

// SALLE-08 : u1 est parti, u2 (l'utilisateur courant) devient hôte.
function sendNewHost() {
  act(() =>
    handlers["lobby:participants"]({
      hostId: "u2",
      participants: [{ id: "u2", username: "Invité-123456" }],
    }),
  );
}

test("Should_ShowHostControls_When_PlayerBecomesHost", () => {
  renderRoom();
  sendParticipants();
  expect(screen.queryByRole("button", { name: "Fermer la course" })).toBeNull();

  sendNewHost();

  expect(listedNames()).toEqual(["Invité-123456 (hôte)"]);
  expect(screen.getByRole("button", { name: "Fermer la course" })).toBeTruthy();
});

test("Should_RefreshPage_When_HostChanges", () => {
  renderRoom();
  sendParticipants();
  expect(router.refresh).not.toHaveBeenCalled();

  sendNewHost();

  expect(router.refresh).toHaveBeenCalledOnce();
});

test("Should_ShowError_When_JoinIsRefused", () => {
  renderRoom();
  const ack = socket.emit.mock.calls[0][2] as Handler;

  act(() => ack({ ok: false, error: "lobbyNotFound" }));

  expect(screen.getByRole("alert").textContent).toBe("Course introuvable");
});

test("Should_RejoinLeavingOtherLobby_When_PlayerConfirms", () => {
  const confirm = vi.fn(() => true);
  vi.stubGlobal("confirm", confirm);
  renderRoom();
  const ack = socket.emit.mock.calls[0][2] as Handler;

  act(() => ack({ ok: false, error: "inOtherLobby" }));

  expect(confirm).toHaveBeenCalledWith(
    "Tu es déjà dans un autre lobby. Le quitter pour rejoindre celui-ci ?",
  );
  expect(socket.emit).toHaveBeenLastCalledWith(
    "lobby:join",
    { code: "K7P3XM", leave: true },
    expect.any(Function),
  );
});

test("Should_GoBackToLobbies_When_PlayerRefusesToLeaveOtherLobby", () => {
  vi.stubGlobal("confirm", vi.fn(() => false));
  renderRoom();
  const ack = socket.emit.mock.calls[0][2] as Handler;

  act(() => ack({ ok: false, error: "inOtherLobby" }));

  expect(router.replace).toHaveBeenCalledWith("/lobbies");
  expect(socket.emit).toHaveBeenCalledTimes(1);
});

test("Should_DisconnectAndExplain_When_PlayerJoinedAnotherLobbyInAnotherTab", () => {
  renderRoom();

  act(() => handlers["lobby:left"]());

  expect(socket.disconnect).toHaveBeenCalled();
  expect(screen.getByRole("alert").textContent).toBe(
    "Tu as rejoint un autre lobby. Tu n'es plus dans celui-ci.",
  );
});

test("Should_ShowRawMessage_When_ConnectionErrorHasNoTranslation", () => {
  renderRoom();

  act(() => handlers["connect_error"](new Error("xhr poll error")));

  expect(screen.getByRole("alert").textContent).toBe("xhr poll error");
});

test("Should_Disconnect_When_Unmounted", () => {
  const { unmount } = renderRoom();

  unmount();

  expect(socket.disconnect).toHaveBeenCalled();
});

test("Should_NotShowCloseButton_When_UserIsNotHost", () => {
  renderRoom();

  expect(screen.queryByRole("button", { name: "Fermer la course" })).toBeNull();
});

test("Should_AskServerToClose_When_HostConfirms", () => {
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  renderRoom("fr", true);

  fireEvent.click(screen.getByRole("button", { name: "Fermer la course" }));

  expect(socket.emit).toHaveBeenCalledWith("lobby:close", expect.any(Function));
});

test("Should_NotClose_When_HostCancelsConfirmation", () => {
  vi.stubGlobal(
    "confirm",
    vi.fn(() => false),
  );
  renderRoom("fr", true);

  fireEvent.click(screen.getByRole("button", { name: "Fermer la course" }));

  expect(socket.emit).not.toHaveBeenCalledWith("lobby:close", expect.anything());
});

test("Should_ShowError_When_CloseIsRefused", () => {
  vi.stubGlobal(
    "confirm",
    vi.fn(() => true),
  );
  renderRoom("fr", true);
  fireEvent.click(screen.getByRole("button", { name: "Fermer la course" }));
  const ack = socket.emit.mock.calls[1][1] as Handler;

  act(() => ack({ ok: false, error: "notHost" }));

  expect(screen.getByRole("alert").textContent).toBe("Seul l'hôte peut faire ça");
});

test("Should_ReturnToLobbyListWithMessage_When_LobbyIsClosed", () => {
  renderRoom();

  act(() => handlers["lobby:closed"]());

  expect(router.replace).toHaveBeenCalledWith("/lobbies?closed=1");
});

test("Should_ReturnToLobbyListWithMessage_When_PlayerIsKicked", () => {
  renderRoom();

  act(() => handlers["lobby:kicked"]());

  expect(socket.disconnect).toHaveBeenCalled();
  expect(router.replace).toHaveBeenCalledWith("/lobbies?kicked=1");
});

test("Should_AskServerToKick_When_HostConfirms", () => {
  const confirm = vi.fn(() => true);
  vi.stubGlobal("confirm", confirm);
  renderRoom("fr", true);
  sendParticipants();

  fireEvent.click(screen.getByRole("button", { name: "Exclure Invité-123456" }));

  expect(confirm).toHaveBeenCalledWith(
    "Exclure Invité-123456 ? Cette personne ne pourra plus revenir dans cette course.",
  );
  expect(socket.emit).toHaveBeenCalledWith("lobby:kick", { id: "u2" }, expect.any(Function));
});

test("Should_NotKick_When_HostCancels", () => {
  vi.stubGlobal("confirm", vi.fn(() => false));
  renderRoom("fr", true);
  sendParticipants();

  fireEvent.click(screen.getByRole("button", { name: "Exclure Invité-123456" }));

  expect(socket.emit).not.toHaveBeenCalledWith("lobby:kick", expect.anything(), expect.any(Function));
});

test("Should_ShowKickOnlyForOthers_When_UserIsHost", () => {
  renderRoom("fr", true);
  sendParticipants();

  expect(screen.queryByRole("button", { name: "Exclure alex" })).toBeNull();
});

test("Should_NotShowKick_When_UserIsNotHost", () => {
  renderRoom();
  sendParticipants();

  expect(screen.queryByRole("button", { name: /Exclure/ })).toBeNull();
});

const startButton = () => screen.queryByRole("button", { name: "Lancer et courir" });
const watchButton = () => screen.queryByRole("button", { name: "Lancer et regarder" });

test("Should_NotShowStartButton_When_UserIsNotHost", () => {
  renderRoom();
  sendParticipants();

  expect(startButton()).toBeNull();
});

test("Should_DisableStartAndExplain_When_HostIsAlone", () => {
  renderRoom("fr", true);

  act(() => handlers["lobby:participants"]({ hostId: "u1", participants: [{ id: "u1", username: "alex" }] }));

  expect(startButton()!.hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByText(
      "Il faut au moins 2 participants pour lancer la course : invite un joueur ou ajoute un bot.",
    ),
  ).toBeTruthy();
});

test("Should_AskServerToStart_When_HostClicksStart", () => {
  renderRoom("fr", true);
  sendParticipants();

  fireEvent.click(startButton()!);

  expect(socket.emit).toHaveBeenCalledWith("race:start", { watch: false }, expect.any(Function));
});

test("Should_AskServerToStartWithHostWatching_When_HostClicksWatch", () => {
  renderRoom("fr", true);
  act(() =>
    handlers["lobby:participants"]({ hostId: "u1",
      participants: [
        { id: "u1", username: "alex" },
        { id: "u2", username: "Invité-123456" },
        { id: "u3", username: "sam" },
      ],
    }),
  );

  fireEvent.click(watchButton()!);

  expect(socket.emit).toHaveBeenCalledWith("race:start", { watch: true }, expect.any(Function));
});

test("Should_DisableWatchOnlyAndExplain_When_HostHasOneOtherParticipant", () => {
  renderRoom("fr", true);

  sendParticipants();

  expect(startButton()!.hasAttribute("disabled")).toBe(false);
  expect(watchButton()!.hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByText("Pour regarder sans courir, il faut au moins 2 autres participants."),
  ).toBeTruthy();
});

test("Should_DisableWatchOnlyAndExplain_When_OtherParticipantsAreBots", () => {
  renderRoom("fr", true);

  act(() =>
    handlers["lobby:participants"]({ hostId: "u1",
      participants: [
        { id: "u1", username: "alex" },
        { id: "b1", username: "Bot beginner 1", bot: { level: "beginner", number: 1 } },
        { id: "b2", username: "Bot expert 1", bot: { level: "expert", number: 1 } },
      ],
    }),
  );

  expect(startButton()!.hasAttribute("disabled")).toBe(false);
  expect(watchButton()!.hasAttribute("disabled")).toBe(true);
  expect(
    screen.getByText(
      "Pour regarder sans courir, il faut au moins un autre joueur humain : les bots ne courent pas seuls.",
    ),
  ).toBeTruthy();
});

test("Should_EnableWatch_When_AnotherHumanRacesWithABot", () => {
  renderRoom("fr", true);

  act(() =>
    handlers["lobby:participants"]({ hostId: "u1",
      participants: [
        { id: "u1", username: "alex" },
        { id: "u2", username: "sam" },
        { id: "b1", username: "Bot beginner 1", bot: { level: "beginner", number: 1 } },
      ],
    }),
  );

  expect(watchButton()!.hasAttribute("disabled")).toBe(false);
});

test("Should_SayWaitingForHost_When_UserIsNotHostAndNoRaceIsOn", () => {
  renderRoom();
  sendParticipants();

  expect(screen.getByText(/En attente de l'hôte/)).toBeTruthy();
});

test("Should_ShowError_When_StartIsRefused", () => {
  renderRoom("fr", true);
  sendParticipants();
  fireEvent.click(startButton()!);
  const ack = socket.emit.mock.calls[1][2] as Handler;

  act(() => ack({ ok: false, error: "notEnoughParticipants" }));

  expect(screen.getByRole("alert").textContent).toBe("Il faut au moins 2 participants");
});

test("Should_ShowCountdownAndHideHostButtons_When_ServerSendsCountdown", () => {
  renderRoom("fr", true);
  sendParticipants();

  act(() => handlers["race:countdown"]({ seconds: 5 }));

  expect(screen.getByRole("timer").textContent).toBe("Départ dans 5");
  expect(startButton()).toBeNull();
  expect(screen.queryByRole("button", { name: "Fermer la course" })).toBeNull();
});

test("Should_CountDownEachSecondAndWaitAtOne_When_CountdownRuns", () => {
  vi.useFakeTimers();
  renderRoom();
  act(() => handlers["race:countdown"]({ seconds: 3 }));

  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole("timer").textContent).toBe("Départ dans 2");

  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByRole("timer").textContent).toBe("Départ dans 1");
});

function startRace(
  racerIds: string[],
  errorMode = "blocking",
  secondsLeft: number | null = null,
  mine?: { typed: string; errors: number; gaveUp: boolean; keys?: number },
) {
  // Sans valeur donnée, chaque caractère et chaque faute comptent pour une touche.
  const resumed = mine && { keys: mine.typed.length + mine.errors, keyErrors: {}, ...mine };
  act(() =>
    handlers["race:started"]({
      content: "Un texte court.",
      errorMode,
      racerIds,
      secondsLeft,
      mine: resumed,
    }),
  );
}

test("Should_ShowOnlyTextToTypeAndHideCountdown_When_RaceStarts", () => {
  renderRoom();
  sendParticipants();
  act(() => handlers["race:countdown"]({ seconds: 5 }));

  startRace(["u1", "u2"]);

  expect(screen.queryByRole("timer")).toBeNull();
  expect(screen.getByLabelText("Un texte court.")).toBeTruthy();
  expect(screen.getByRole("textbox", { name: "Tape le texte" })).toBeTruthy();
  expect(screen.queryByRole("list", { name: "Participants" })).toBeNull();
  expect(screen.queryByText(/tu la regardes/)).toBeNull();
});

test("Should_UseServerErrorMode_When_RaceStarts", () => {
  renderRoom();

  startRace(["u1", "u2"], "tolerant");

  expect(screen.getByText(fr.RaceTyping.tolerant)).toBeTruthy();
});

test("Should_SayUserIsWatchingWithoutTextField_When_UserIsNotARacer", () => {
  renderRoom();

  startRace(["u1", "u3"]);

  expect(screen.getByText(/tu la regardes/)).toBeTruthy();
  expect(screen.getByText("Un texte court.")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
});

test.each([
  [300, "Temps restant : 5:00"],
  [65, "Temps restant : 1:05"],
  [86400, "Temps restant : 24:00:00"],
])("Should_ShowTimeLeft_When_RaceStartsWith_%i_Seconds", (secondsLeft, text) => {
  renderRoom();

  startRace(["u1", "u2"], "blocking", secondsLeft);

  expect(screen.getByRole("timer").textContent).toBe(text);
});

test("Should_NotShowTimer_When_RaceHasNoTimer", () => {
  renderRoom();

  startRace(["u1", "u2"]);

  expect(screen.queryByRole("timer")).toBeNull();
});

test("Should_CountDownTimeLeftAndStopAtZero_When_RaceRuns", () => {
  vi.useFakeTimers();
  renderRoom();
  startRace(["u1", "u2"], "blocking", 2);

  act(() => vi.advanceTimersByTime(1000));
  expect(screen.getByRole("timer").textContent).toBe("Temps restant : 0:01");

  act(() => vi.advanceTimersByTime(5000));
  expect(screen.getByRole("timer").textContent).toBe("Temps restant : 0:00");
});

test.each([
  ["allFinished", "Course terminée : tout le monde a fini."],
  ["timeUp", "Course terminée : le temps est écoulé."],
  ["idle", "Course terminée : personne n'a tapé depuis 2 minutes."],
])("Should_SayRaceIsOverAndHideTimer_When_RaceEndsBy_%s", (reason, text) => {
  renderRoom();
  startRace(["u1", "u2"], "blocking", 300);

  act(() => handlers["race:ended"]({ reason, results: [] }));

  expect(screen.getByRole("status").textContent).toBe(text);
  expect(screen.queryByRole("timer")).toBeNull();
});

test("Should_SayRaceIsOverInEnglish_When_LocaleIsEnglish", () => {
  renderRoom("en");

  act(() => handlers["race:ended"]({ reason: "timeUp", results: [] }));

  expect(screen.getByRole("status").textContent).toBe("Race over: time is up.");
});

test("Should_ShowSessionStats_When_RaceEnds", async () => {
  loadSessionStats.mockResolvedValue({ races: 6, averageWpm: 48.4, bestWpm: 61.6, averageAccuracy: 96.2 });
  renderRoom();
  startRace(["u1", "u2"]);
  expect(loadSessionStats).not.toHaveBeenCalled();

  act(() => handlers["race:ended"]({ reason: "allFinished", results: [] }));

  const panel = await screen.findByRole("region", { name: "Cette session : 6 courses d’affilée" });
  expect(within(panel).getAllByRole("definition").map((stat) => stat.textContent)).toEqual([
    "48",
    "62",
    "96 %",
  ]);
});

test("Should_HideSessionStats_When_UserHasNoRaceInSession", async () => {
  loadSessionStats.mockResolvedValue({ races: 0, averageWpm: null, bestWpm: null, averageAccuracy: null });
  renderRoom();

  await act(async () => handlers["race:ended"]({ reason: "allFinished", results: [] }));

  expect(loadSessionStats).toHaveBeenCalledTimes(1);
  expect(screen.queryByRole("region", { name: /Cette session/ })).toBeNull();
});

test("Should_ShowDashes_When_NoSessionRaceWasFinished", async () => {
  loadSessionStats.mockResolvedValue({ races: 1, averageWpm: null, bestWpm: null, averageAccuracy: null });
  renderRoom("en");

  act(() => handlers["race:ended"]({ reason: "timeUp", results: [] }));

  const panel = await screen.findByRole("region", { name: "This session: 1 race" });
  expect(within(panel).getAllByRole("definition").map((stat) => stat.textContent)).toEqual([
    "—",
    "—",
    "—",
  ]);
});

test("Should_LetHostCloseOrRelaunchButNotStart_When_RaceHasEnded", () => {
  renderRoom("fr", true);
  sendParticipants();
  startRace(["u1", "u2"], "blocking", 300);
  expect(screen.queryByRole("button", { name: "Fermer la course" })).toBeNull();

  act(() => handlers["race:ended"]({ reason: "allFinished", results: [] }));

  expect(screen.getByRole("button", { name: "Fermer la course" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Relancer la course" })).toBeTruthy();
  expect(startButton()).toBeNull();
});

test("Should_NotShowRelaunch_When_UserIsNotHost", () => {
  renderRoom();
  startRace(["u1", "u2"]);

  act(() => handlers["race:ended"]({ reason: "allFinished", results: [] }));

  expect(screen.queryByRole("button", { name: "Relancer la course" })).toBeNull();
});

function endRaceAsHost() {
  renderRoom("fr", true);
  sendParticipants();
  startRace(["u1", "u2"]);
  act(() => handlers["race:ended"]({ reason: "allFinished", results: [] }));
  fireEvent.click(screen.getByRole("button", { name: "Relancer la course" }));
  const call = socket.emit.mock.calls.find(([event]) => event === "lobby:restart")!;
  return call[1] as Handler;
}

test("Should_OpenSettingsPage_When_HostRelaunches", () => {
  const ack = endRaceAsHost();

  act(() => ack({ ok: true }));

  expect(router.push).toHaveBeenCalledWith("/lobbies/K7P3XM/settings");
});

test("Should_ShowErrorAndStay_When_RelaunchIsRefused", () => {
  const ack = endRaceAsHost();

  act(() => ack({ ok: false, error: "raceNotFinished" }));

  expect(screen.getByRole("alert").textContent).toBe("La course n'est pas terminée");
  expect(router.push).not.toHaveBeenCalled();
});

test("Should_ReturnToWaitingRoom_When_LobbyIsRestarted", () => {
  renderRoom();
  sendParticipants();
  startRace(["u1", "u2"]);
  act(() => handlers["race:ended"]({ reason: "allFinished", results: [] }));

  act(() => handlers["lobby:restarted"]());

  expect(screen.queryByRole("status")).toBeNull();
  expect(screen.queryByText("Un texte court.")).toBeNull();
  expect(screen.queryByRole("list", { name: "Classement" })).toBeNull();
  expect(screen.getByText(/En attente de l'hôte/)).toBeTruthy();
});

test("Should_MarkHostWatchingAndNotCountHim_When_HostWatchesRace", () => {
  renderRoom("fr", true);
  act(() =>
    handlers["lobby:participants"]({ hostId: "u1",
      participants: [
        { id: "u1", username: "alex" },
        { id: "u2", username: "Invité-123456" },
        { id: "u3", username: "sam" },
      ],
    }),
  );

  startRace(["u2", "u3"]);

  expect(listedNames()).toEqual(["alex (hôte) (regarde)", "Invité-123456Exclure", "samExclure"]);
  expect(screen.getByRole("heading", { name: "Participants (2)" })).toBeTruthy();
  expect(screen.getByText("Tu regardes la course sans courir.")).toBeTruthy();
  expect(screen.queryByRole("textbox")).toBeNull();
});

test("Should_ShowPodiumAndRanking_When_RaceEndsWithResults", () => {
  renderRoom();
  startRace(["u1", "u2"]);
  const stats = { wpm: 40, accuracy: 100, durationMs: 30_000, penaltyMs: 0, errors: 0, keyErrors: {} };

  act(() =>
    handlers["race:ended"]({
      reason: "allFinished",
      results: [
        { ...stats, id: "u2", username: "moi", rank: 1, finished: true },
        { ...stats, id: "u1", username: "alex", rank: 2, finished: false },
      ],
    }),
  );

  expect(screen.getByRole("heading", { name: "Résultats" })).toBeTruthy();
  expect(
    within(screen.getByRole("list", { name: "Podium" })).getAllByRole("listitem"),
  ).toHaveLength(2);
  expect(screen.getByRole("table", { name: "Classement complet" })).toBeTruthy();
  expect(screen.getByRole("heading", { name: "Heatmap du clavier" })).toBeTruthy();
});

test("Should_ShowNoResults_When_RaceIsRunning", () => {
  renderRoom();

  startRace(["u1", "u3"]);

  expect(screen.queryByRole("heading", { name: "Résultats" })).toBeNull();
  expect(screen.queryByRole("heading", { name: "Heatmap du clavier" })).toBeNull();
});

test("Should_SendTypedTextAndErrorsToServer_When_RacerTypes", () => {
  renderRoom();
  startRace(["u1", "u2"]);

  fireEvent.change(screen.getByRole("textbox", { name: "Tape le texte" }), {
    target: { value: "Un" },
  });

  expect(socket.emit).toHaveBeenCalledWith("race:progress", {
    typed: "Un",
    errors: 0,
    keys: 2,
    keyErrors: {},
  });
});

const progressCalls = () => socket.emit.mock.calls.filter((args) => args[0] === "race:progress");

test("Should_SendAtMostTenProgressMessagesPerSecond_When_RacerTypesFast", () => {
  vi.useFakeTimers();
  renderRoom();
  startRace(["u1", "u2"]);
  const text = "Un texte court";

  // Une frappe toutes les 20 ms pendant 280 ms : 50 frappes par seconde.
  for (let length = 1; length <= text.length; length++) {
    fireEvent.change(typingBox()!, { target: { value: text.slice(0, length) } });
    act(() => vi.advanceTimersByTime(20));
  }

  expect(progressCalls().length).toBeLessThanOrEqual(3);
});

test("Should_SendLatestTyping_When_ThrottleDelayEnds", () => {
  vi.useFakeTimers();
  renderRoom();
  startRace(["u1", "u2"]);
  fireEvent.change(typingBox()!, { target: { value: "U" } });
  fireEvent.change(typingBox()!, { target: { value: "Un" } });
  fireEvent.change(typingBox()!, { target: { value: "Un " } });
  expect(progressCalls()).toHaveLength(1);

  act(() => vi.advanceTimersByTime(100));

  expect(progressCalls()).toHaveLength(2);
  expect(socket.emit).toHaveBeenLastCalledWith("race:progress", expect.objectContaining({ typed: "Un " }));
});

test("Should_SendFinishRightAway_When_TextIsCompleteWithinThrottleDelay", () => {
  vi.useFakeTimers();
  renderRoom();
  startRace(["u1", "u2"]);
  fireEvent.change(typingBox()!, { target: { value: "Un texte court" } });

  fireEvent.change(typingBox()!, { target: { value: "Un texte court." } });

  expect(progressCalls()).toHaveLength(2);
  expect(socket.emit).toHaveBeenLastCalledWith("race:progress", expect.objectContaining({ typed: "Un texte court." }));
  act(() => vi.advanceTimersByTime(100));
  expect(progressCalls()).toHaveLength(2);
});

// Ack du dernier message envoyé sous ce nom.
function lastAck(event: string) {
  const call = socket.emit.mock.calls.findLast((args) => args[0] === event);
  return call?.at(-1) as Handler;
}

const typingBox = () => screen.queryByRole("textbox", { name: "Tape le texte" });
const giveUpButton = () => screen.queryByRole("button", { name: "Abandonner" });

test("Should_NotShowError_When_ConnectionDropsAndSocketRetries", () => {
  renderRoom();
  socket.active = true;

  act(() => handlers["connect_error"](new Error("websocket error")));

  expect(screen.queryByRole("alert")).toBeNull();
});

test("Should_RejoinAndResendTyping_When_Reconnected", () => {
  renderRoom();
  startRace(["u1", "u2"]);
  fireEvent.change(typingBox()!, { target: { value: "Un" } });
  socket.emit.mockClear();

  act(() => handlers["connect"]());
  act(() => lastAck("lobby:join")({ ok: true }));

  expect(socket.emit).toHaveBeenCalledWith("lobby:join", { code: "K7P3XM" }, expect.any(Function));
  expect(socket.emit).toHaveBeenCalledWith("race:progress", {
    typed: "Un",
    errors: 0,
    keys: 2,
    keyErrors: {},
  });
});

test("Should_ResumeTypedTextAndErrors_When_RacerComesBack", () => {
  renderRoom();

  startRace(["u1", "u2"], "tolerant", null, { typed: "Un tx", errors: 1, gaveUp: false });

  expect((typingBox() as HTMLTextAreaElement).value).toBe("Un tx");
  expect(screen.getByRole("status").textContent).toBe("1 faute");
});

test("Should_KeepCountingKeysFromResumedTyping_When_RacerTypesAgain", () => {
  renderRoom();
  startRace(["u1", "u2"], "blocking", null, { typed: "Un", errors: 1, gaveUp: false, keys: 5 });

  fireEvent.change(typingBox()!, { target: { value: "Un " } });

  expect(socket.emit).toHaveBeenLastCalledWith("race:progress", {
    typed: "Un ",
    errors: 1,
    keys: 6,
    keyErrors: {},
  });
});

test("Should_KeepLocalTyping_When_ServerResendsRaceAfterShortDrop", () => {
  renderRoom();
  startRace(["u1", "u2"]);
  fireEvent.change(typingBox()!, { target: { value: "Un t" } });

  startRace(["u1", "u2"], "blocking", null, { typed: "Un", errors: 0, gaveUp: false });

  expect((typingBox() as HTMLTextAreaElement).value).toBe("Un t");
});

test("Should_BecomeSpectator_When_RacerConfirmsGiveUp", () => {
  vi.stubGlobal("confirm", vi.fn(() => true));
  renderRoom();
  startRace(["u1", "u2"]);

  fireEvent.click(giveUpButton()!);
  act(() => lastAck("race:giveUp")({ ok: true }));

  expect(typingBox()).toBeNull();
  expect(screen.getByText(fr.LobbyRoom.gaveUp)).toBeTruthy();
});

test("Should_KeepRacing_When_GiveUpIsNotConfirmed", () => {
  vi.stubGlobal("confirm", vi.fn(() => false));
  renderRoom();
  startRace(["u1", "u2"]);

  fireEvent.click(giveUpButton()!);

  expect(socket.emit).not.toHaveBeenCalledWith("race:giveUp", expect.any(Function));
  expect(typingBox()).toBeTruthy();
});

test("Should_HideGiveUp_When_RacerHasFinished", () => {
  renderRoom();
  startRace(["u1", "u2"]);

  fireEvent.change(typingBox()!, { target: { value: "Un texte court." } });

  expect(giveUpButton()).toBeNull();
});

test("Should_HideGiveUp_When_FinishedRacerComesBack", () => {
  renderRoom();

  startRace(["u1", "u2"], "blocking", null, { typed: "Un texte court.", errors: 0, gaveUp: false });

  expect(giveUpButton()).toBeNull();
});

test("Should_StaySpectator_When_RacerWhoGaveUpComesBack", () => {
  renderRoom();

  startRace(["u1", "u2"], "blocking", null, { typed: "Un", errors: 0, gaveUp: true });

  expect(typingBox()).toBeNull();
  expect(screen.getByText(fr.LobbyRoom.gaveUp)).toBeTruthy();
});

test("Should_ShowGiveUpInEnglish_When_LocaleIsEnglish", () => {
  renderRoom("en");

  startRace(["u1", "u2"]);

  expect(screen.getByRole("button", { name: "Give up" })).toBeTruthy();
});

// Classement de `count` coureurs : r1 en tête ; u2 (l'utilisateur courant) est au rang `userRank`.
function sendPositions(count: number, userRank: number) {
  const positions = Array.from({ length: count }, (_, index) => ({
    id: index + 1 === userRank ? "u2" : `r${index + 1}`,
    username: index + 1 === userRank ? "moi" : `joueur${index + 1}`,
    position: count - index - 1,
  }));
  act(() => handlers["race:positions"]({ positions }));
}

function ranking() {
  return within(screen.getByRole("list", { name: "Classement" })).getAllByRole("listitem");
}

test("Should_ShowRankingWithProgress_When_ServerSendsPositions", () => {
  renderRoom();
  startRace(["u1", "u2"]);

  act(() =>
    handlers["race:positions"]({
      positions: [
        { id: "u1", username: "alex", position: 3 },
        { id: "u2", username: "moi", position: 0 },
      ],
    }),
  );

  expect(ranking().map((item) => item.textContent)).toEqual(["alex20 %", "moi (toi)0 %"]);
});

test("Should_UpdateRanking_When_NewPositionsArrive", () => {
  renderRoom();
  startRace(["u1", "u2"]);
  sendPositions(2, 2);

  sendPositions(2, 1);

  expect(ranking()[0].textContent).toBe("moi (toi)7 %");
});

test("Should_ShowTopTenAndNeighbours_When_UserIsFarBehind", () => {
  renderRoom();
  startRace(["u2"]);

  sendPositions(30, 15);

  expect(ranking().map((item) => item.getAttribute("value"))).toEqual([
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "14",
    "15",
    "16",
  ]);
  expect(ranking()[10].className).toContain("ranking-gap");
  expect(ranking()[11].className).toContain("ranking-you");
});

test("Should_ShowOnlyTopTen_When_UserIsSpectating", () => {
  renderRoom();
  startRace(["u1", "u3"]);

  sendPositions(30, 0);

  expect(ranking()).toHaveLength(10);
});

test("Should_DrawOneCarTagPerShownPlayer_When_ServerSendsPositions", () => {
  const { container } = renderRoom();
  startRace(["u2"]);

  sendPositions(30, 15);

  expect(container.querySelectorAll(".car-tag")).toHaveLength(13);
});

test.each(STADIUMS)("Should_KeepPersonalStadium_When_LobbyRaceStarts_In_%s", stadium => {
  const { container } = renderRoom("en", false, stadium);
  expect(container.querySelector(".arena")?.getAttribute("data-stadium")).toBe(stadium);
  startRace(["u1", "u2"]);
  sendPositions(2, 1);
  expect(container.querySelector(".arena")?.getAttribute("data-stadium")).toBe(stadium);
  expect(container.querySelectorAll(".car-tag")).toHaveLength(2);
});

test("Should_KeepRanking_When_RaceHasEnded", () => {
  renderRoom();
  startRace(["u1", "u2"]);
  sendPositions(2, 1);

  act(() => handlers["race:ended"]({ reason: "allFinished", results: [] }));

  expect(ranking()).toHaveLength(2);
});

test("Should_ShowNoRanking_When_RaceHasNotStarted", () => {
  renderRoom();
  sendParticipants();

  expect(screen.queryByRole("list", { name: "Classement" })).toBeNull();
});

test("Should_ShowRankingInEnglish_When_LocaleIsEnglish", () => {
  renderRoom("en");
  startRace(["u1", "u2"]);

  sendPositions(2, 2);

  expect(
    within(screen.getByRole("list", { name: "Ranking" })).getAllByRole("listitem")[1].textContent,
  ).toBe("moi (you)0%");
});

test("Should_ApplyServerGoalWithoutLosingInput_When_RewardArrives", () => {
  renderRoom("en");
  const content = "Go. One two three four five.";
  act(() => handlers["race:started"]({ content, errorMode: "blocking", racerIds: ["u2"], secondsLeft: null }));
  const input = screen.getByRole("textbox") as HTMLTextAreaElement;
  fireEvent.change(input, { target: { value: "Go. O" } });
  act(() => handlers["race:shot"]({ id: "u2", sequence: 3, scored: true }));
  act(() => handlers["race:goal"]({ removed: [{ start: 17, end: 22 }], word: "four" }));
  expect(input.value).toBe("Go. O");
  expect(screen.getByLabelText("Go. One two three five.")).toBeTruthy();
  expect(screen.getByText('Goal! “four” was removed from your text.')).toBeTruthy();
  fireEvent.change(input, { target: { value: "Go. One two three five." } });
  expect(socket.emit).toHaveBeenLastCalledWith("race:progress", expect.objectContaining({ typed: content, keys: content.length - 5 }));
  expect(input.readOnly).toBe(true);
});

test("Should_RestoreRemovedWords_When_RejoiningRace", () => {
  renderRoom("en");
  act(() => handlers["race:started"]({
    content: "Go. One two three four five.", errorMode: "blocking", racerIds: ["u2"], secondsLeft: null,
    mine: { typed: "Go. O", errors: 0, keys: 5, keyErrors: {}, gaveUp: false, removed: [{ start: 17, end: 22 }] },
  }));
  expect(screen.getByLabelText("Go. One two three five.")).toBeTruthy();
  expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("Go. O");
});

test.each(["blocking", "tolerant"])("Should_BoostImmediatelyForCorrectInputOnly_In_%s", mode => {
  let tick: FrameRequestCallback = () => {};
  let now = 100;
  vi.spyOn(performance, "now").mockImplementation(() => now);
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => { tick = callback; return 1; });
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
  const { container } = renderRoom("en");
  startRace(["u1", "u2"], mode);
  act(() => handlers["race:positions"]({ positions: [
    { id: "u1", username: "Alex", position: 0 }, { id: "u2", username: "You", position: 0 },
  ] }));
  const input = screen.getByRole("textbox");
  const exhaust = () => container.querySelector('[data-car-id="u2"] .car-boost');
  fireEvent.change(input, { target: { value: "U" } });
  act(() => tick(110));
  expect(exhaust()).not.toBeNull();
  now = 500;
  act(() => tick(now));
  expect(exhaust()).toBeNull();
  fireEvent.change(input, { target: { value: "Ux" } });
  act(() => tick(510));
  expect(exhaust()).toBeNull();
  fireEvent.change(input, { target: { value: "U" } });
  act(() => tick(520));
  expect(exhaust()).toBeNull();
  act(() => handlers["race:boost"]({ id: "u1" }));
  act(() => tick(530));
  expect(container.querySelector('[data-car-id="u1"] .car-boost')).not.toBeNull();
  expect(exhaust()).toBeNull();
  vi.restoreAllMocks();
});

// Classement dans l'ordre donné : u2 s'appelle « moi », les autres portent leur id comme nom.
function sendOrder(...ids: string[]) {
  const positions = ids.map((id, index) => ({
    id,
    username: id === "u2" ? "moi" : id,
    position: ids.length - index,
  }));
  act(() => handlers["race:positions"]({ positions }));
}

function overtakeText(container: HTMLElement) {
  return container.querySelector(".overtake")?.textContent;
}

test("Should_ShowWhoYouPassed_When_UserMovesUp", () => {
  const { container } = renderRoom();
  startRace(["u1", "u2", "u3"]);
  sendOrder("u1", "u3", "u2");

  sendOrder("u2", "u1", "u3");

  expect(overtakeText(container)).toBe("▲ Tu as dépassé u1 et u3 · 1er");
  expect(container.querySelector(".overtake-up")).toBeTruthy();
});

test("Should_ShowWhoPassedYou_When_UserMovesDown", () => {
  const { container } = renderRoom();
  startRace(["u1", "u2", "u3"]);
  sendOrder("u1", "u2", "u3");

  sendOrder("u1", "u3", "u2");

  expect(overtakeText(container)).toBe("▼ u3 t'a dépassé · 3e");
  expect(container.querySelector(".overtake-down")).toBeTruthy();
});

test("Should_ShowOvertakeInEnglish_When_LocaleIsEnglish", () => {
  const { container } = renderRoom("en");
  startRace(["u1", "u2", "u3"]);
  sendOrder("u1", "u2", "u3");

  sendOrder("u2", "u1", "u3");

  expect(overtakeText(container)).toBe("▲ You passed u1 · 1st");
});

test("Should_ShowNoOvertake_When_UserRankIsUnchanged", () => {
  const { container } = renderRoom();
  startRace(["u1", "u2", "u3"]);
  sendOrder("u1", "u2", "u3");

  sendOrder("u1", "u2", "u3");

  expect(overtakeText(container)).toBe("");
});

test("Should_HideOvertake_When_ShownLongEnough", () => {
  vi.useFakeTimers();
  const { container } = renderRoom();
  startRace(["u1", "u2"]);
  sendOrder("u1", "u2");
  sendOrder("u2", "u1");

  act(() => vi.advanceTimersByTime(2500));

  expect(overtakeText(container)).toBe("");
});

test("Should_AnnounceOvertake_When_ScreenReaderIsUsed", () => {
  const { container } = renderRoom();
  startRace(["u1", "u2"]);

  expect(container.querySelector(".overtake")?.getAttribute("aria-live")).toBe("polite");
});

test("Should_ShowNoOvertake_When_UserIsSpectating", () => {
  const { container } = renderRoom();
  startRace(["u1", "u3"]);
  sendOrder("u1", "u3");

  sendOrder("u3", "u1");

  expect(container.querySelector(".overtake")).toBeNull();
});

test("Should_ShowNoOvertake_When_NextRaceStartsAfterRelaunch", () => {
  const { container } = renderRoom();
  startRace(["u1", "u2"]);
  sendOrder("u2", "u1");
  act(() => handlers["race:ended"]({ reason: "allFinished", results: [] }));
  act(() => handlers["lobby:restarted"]());
  startRace(["u1", "u2"]);

  sendOrder("u1", "u2");

  expect(overtakeText(container)).toBe("");
});

// L'hôte u1 et un bot débutant : assez pour lancer une course d'entraînement (BOT-1).
function sendHostAndBot() {
  act(() =>
    handlers["lobby:participants"]({ hostId: "u1",
      participants: [
        { id: "u1", username: "alex" },
        { id: "b1", username: "Bot beginner 1", bot: { level: "beginner", number: 1 } },
      ],
    }),
  );
}

test("Should_NameBotInFrenchWithBadge_When_ServerSendsBot", () => {
  renderRoom();

  sendHostAndBot();

  expect(listedNames()).toEqual(["alex (hôte)", "Bot Débutant 1Bot"]);
  expect(screen.getByText("Bot", { selector: ".bot-badge" })).toBeTruthy();
});

test("Should_NameBotInEnglish_When_LocaleIsEnglish", () => {
  renderRoom("en");

  sendHostAndBot();

  expect(listedNames()[1]).toBe("Bot Beginner 1Bot");
});

test("Should_EnableStart_When_HostIsAloneWithABot", () => {
  renderRoom("fr", true);

  sendHostAndBot();

  expect(startButton()!.hasAttribute("disabled")).toBe(false);
});

test("Should_AskServerToAddBotOfChosenLevel_When_HostAddsBot", () => {
  renderRoom("fr", true);
  sendHostAndBot();

  fireEvent.change(screen.getByLabelText("Niveau du bot"), { target: { value: "expert" } });
  fireEvent.click(screen.getByRole("button", { name: "Ajouter un bot" }));

  expect(socket.emit).toHaveBeenCalledWith(
    "lobby:addBot",
    { level: "expert" },
    expect.any(Function),
  );
});

test("Should_AskServerToRemoveBot_When_HostClicksRemove", () => {
  renderRoom("fr", true);
  sendHostAndBot();

  fireEvent.click(screen.getByRole("button", { name: "Retirer Bot Débutant 1" }));

  expect(socket.emit).toHaveBeenCalledWith("lobby:removeBot", { id: "b1" }, expect.any(Function));
});

test("Should_ShowError_When_AddingBotIsRefused", () => {
  renderRoom("fr", true);
  sendHostAndBot();
  fireEvent.click(screen.getByRole("button", { name: "Ajouter un bot" }));
  const ack = socket.emit.mock.calls[1][2] as Handler;

  act(() => ack({ ok: false, error: "lobbyFull" }));

  expect(screen.getByRole("alert").textContent).toBe("La course est pleine");
});

test("Should_NotShowBotControls_When_UserIsNotHost", () => {
  renderRoom();

  sendHostAndBot();

  expect(screen.queryByRole("button", { name: "Ajouter un bot" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Retirer/ })).toBeNull();
});

test("Should_HideBotControls_When_RaceStarts", () => {
  renderRoom("fr", true);
  sendHostAndBot();

  act(() => handlers["race:countdown"]({ seconds: 5 }));

  expect(screen.queryByRole("button", { name: "Ajouter un bot" })).toBeNull();
  expect(screen.queryByRole("button", { name: /Retirer/ })).toBeNull();
});

test("Should_NameBotInRankingAndOvertake_When_BotPassesUser", () => {
  const { container } = renderRoom();
  startRace(["u2", "b1"]);
  const bot = { id: "b1", username: "Bot expert 1", bot: { level: "expert", number: 1 } };
  act(() =>
    handlers["race:positions"]({
      positions: [{ id: "u2", username: "moi", position: 2 }, { ...bot, position: 1 }],
    }),
  );

  act(() =>
    handlers["race:positions"]({
      positions: [{ ...bot, position: 3 }, { id: "u2", username: "moi", position: 2 }],
    }),
  );

  expect(ranking()[0].textContent).toBe("Bot Expert 1Bot20 %");
  expect(overtakeText(container)).toBe("▼ Bot Expert 1 t'a dépassé · 2e");
});
