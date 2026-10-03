import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { LobbyRoom } from "../components/lobby-room";
import en from "../messages/en.json";
import fr from "../messages/fr.json";

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

const router = { replace: vi.fn() };
vi.mock("next/navigation", () => ({ useRouter: () => router }));

// u1 est l'hôte ; l'utilisateur courant est u1 s'il est hôte, sinon u2.
// Le socket se connecte aussitôt rendu.
function renderRoom(locale: "fr" | "en" = "fr", isHost = false) {
  const result = render(
    <NextIntlClientProvider locale={locale} messages={locale === "fr" ? fr : en}>
      <LobbyRoom code="K7P3XM" hostId="u1" isHost={isHost} userId={isHost ? "u1" : "u2"} />
    </NextIntlClientProvider>,
  );
  act(() => handlers["connect"]());
  return result;
}

function sendParticipants() {
  act(() =>
    handlers["lobby:participants"]({
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

test("Should_ShowError_When_JoinIsRefused", () => {
  renderRoom();
  const ack = socket.emit.mock.calls[0][2] as Handler;

  act(() => ack({ ok: false, error: "lobbyNotFound" }));

  expect(screen.getByRole("alert").textContent).toBe("Course introuvable");
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

const startButton = () => screen.queryByRole("button", { name: "Lancer la course" });

test("Should_NotShowStartButton_When_UserIsNotHost", () => {
  renderRoom();
  sendParticipants();

  expect(startButton()).toBeNull();
});

test("Should_DisableStartAndExplain_When_HostIsAlone", () => {
  renderRoom("fr", true);

  act(() => handlers["lobby:participants"]({ participants: [{ id: "u1", username: "alex" }] }));

  expect(startButton()!.hasAttribute("disabled")).toBe(true);
  expect(screen.getByText("Il faut au moins 2 participants pour lancer la course.")).toBeTruthy();
});

test("Should_AskServerToStart_When_HostClicksStart", () => {
  renderRoom("fr", true);
  sendParticipants();

  fireEvent.click(startButton()!);

  expect(socket.emit).toHaveBeenCalledWith("race:start", expect.any(Function));
});

test("Should_ShowError_When_StartIsRefused", () => {
  renderRoom("fr", true);
  sendParticipants();
  fireEvent.click(startButton()!);
  const ack = socket.emit.mock.calls[1][1] as Handler;

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

  act(() => handlers["race:ended"]({ reason }));

  expect(screen.getByRole("status").textContent).toBe(text);
  expect(screen.queryByRole("timer")).toBeNull();
});

test("Should_SayRaceIsOverInEnglish_When_LocaleIsEnglish", () => {
  renderRoom("en");

  act(() => handlers["race:ended"]({ reason: "timeUp" }));

  expect(screen.getByRole("status").textContent).toBe("Race over: time is up.");
});

test("Should_LetHostCloseButNotRestart_When_RaceHasEnded", () => {
  renderRoom("fr", true);
  sendParticipants();
  startRace(["u1", "u2"], "blocking", 300);
  expect(screen.queryByRole("button", { name: "Fermer la course" })).toBeNull();

  act(() => handlers["race:ended"]({ reason: "allFinished" }));

  expect(screen.getByRole("button", { name: "Fermer la course" })).toBeTruthy();
  expect(startButton()).toBeNull();
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

test("Should_KeepRanking_When_RaceHasEnded", () => {
  renderRoom();
  startRace(["u1", "u2"]);
  sendPositions(2, 1);

  act(() => handlers["race:ended"]({ reason: "allFinished" }));

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
