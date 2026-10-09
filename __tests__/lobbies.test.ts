// @vitest-environment node
import { afterAll, afterEach, beforeAll, expect, test } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { db } from "../db";
import { lobbies, users } from "../db/schema";
import {
  addParticipant,
  banParticipant,
  canEnterLobby,
  claimInvite,
  closeLobby,
  createInvites,
  createLobby,
  findInviteLobby,
  findOpenLobby,
  generateLobbyCode,
  listInvites,
  listParticipants,
  listPublicLobbies,
  normalizeCode,
  removeParticipant,
  updateLobbySettings,
} from "../lib/lobbies";

// Adresses de test (RFC 5737).
const IP = "203.0.113.1";
const OTHER_IP = "203.0.113.2";

// Utilisateurs créés par un test, supprimés après (avec leurs lobbys).
const createdIds: string[] = [];

async function newUser() {
  const [user] = await db
    .insert(users)
    .values({ username: `t_${Math.random().toString(36).slice(2, 12)}` })
    .returning();
  createdIds.push(user.id);
  return user;
}

beforeAll(async () => {
  await migrate(db, { migrationsFolder: "db/migrations" });
});

afterEach(async () => {
  if (createdIds.length === 0) return;
  const ids = createdIds.splice(0);
  await db.delete(lobbies).where(inArray(lobbies.hostId, ids));
  await db.delete(users).where(inArray(users.id, ids));
});

afterAll(async () => {
  await db.$client.end();
});

test("Should_GenerateSixUnambiguousCharacters_When_GeneratingCode", () => {
  for (let i = 0; i < 200; i++) {
    expect(generateLobbyCode()).toMatch(/^[A-HJKMNP-Z2-9]{6}$/);
  }
});

test("Should_UppercaseAndTrim_When_NormalizingCode", () => {
  expect(normalizeCode("  k7p3xm ")).toBe("K7P3XM");
});

test("Should_MakeCreatorTheHost_When_CreatingLobby", async () => {
  const host = await newUser();

  const lobby = await createLobby(host.id, "unlisted");

  expect(lobby).toMatchObject({ hostId: host.id, visibility: "unlisted", closedAt: null });
  expect(lobby.code).toMatch(/^[A-Z2-9]{6}$/);
});

test("Should_SaveTextSettings_When_CreatingLobbyWithThem", async () => {
  const lobby = await createLobby((await newUser()).id, "public", {
    textLanguage: "en",
    textLength: 200,
  });

  expect(lobby).toMatchObject({ textLanguage: "en", textLength: 200 });
});

test("Should_UseFrenchAndHundredWords_When_CreatingLobbyWithoutTextSettings", async () => {
  const lobby = await createLobby((await newUser()).id, "public");

  expect(lobby).toMatchObject({ textLanguage: "fr", textLength: 100 });
});

test.each([
  ["a timer", 3600],
  ["no timer", null],
])("Should_SaveTimer_When_CreatingLobbyWith_%s", async (_, timeLimitSeconds) => {
  const lobby = await createLobby((await newUser()).id, "public", { timeLimitSeconds });

  expect(lobby.timeLimitSeconds).toBe(timeLimitSeconds);
});

test("Should_UseFiveMinuteTimer_When_CreatingLobbyWithoutTimer", async () => {
  const lobby = await createLobby((await newUser()).id, "public");

  expect(lobby.timeLimitSeconds).toBe(300);
});

test("Should_UseCapacityOf30_When_CreatingLobbyWithoutCapacity", async () => {
  const lobby = await createLobby((await newUser()).id, "public");

  expect(lobby.capacity).toBe(30);
});

test("Should_SaveCapacity_When_CreatingLobbyWithCapacity", async () => {
  const lobby = await createLobby((await newUser()).id, "public", { capacity: 2 });

  expect(lobby.capacity).toBe(2);
});

test("Should_KeepLobbyAndCodeWithNewSettings_When_HostChangesSettings", async () => {
  const lobby = await createLobby((await newUser()).id, "public");
  const settings = {
    textLanguage: "en" as const,
    textLength: 200,
    errorMode: "tolerant" as const,
    timeLimitSeconds: null,
    capacity: 8,
  };

  await updateLobbySettings(lobby.id, settings);

  expect(await findOpenLobby(lobby.code)).toMatchObject({
    id: lobby.id,
    visibility: "public",
    ...settings,
  });
});

test("Should_FindLobby_When_CodeIsTypedInLowercase", async () => {
  const lobby = await createLobby((await newUser()).id, "unlisted");

  expect((await findOpenLobby(` ${lobby.code.toLowerCase()} `))?.id).toBe(lobby.id);
});

test("Should_ReturnNull_When_CodeDoesNotExist", async () => {
  expect(await findOpenLobby("ZZZZZZZ")).toBeNull();
});

test("Should_ReturnNull_When_LobbyIsClosed", async () => {
  const lobby = await createLobby((await newUser()).id, "unlisted");
  await db.update(lobbies).set({ closedAt: new Date() }).where(eq(lobbies.id, lobby.id));

  expect(await findOpenLobby(lobby.code)).toBeNull();
});

test("Should_HideLobbyFromCodeAndPublicList_When_HostClosesIt", async () => {
  const host = await newUser();
  const lobby = await createLobby(host.id, "public");
  await addParticipant(lobby.id, host.id);

  await closeLobby(lobby.id);

  expect(await findOpenLobby(lobby.code)).toBeNull();
  expect((await listPublicLobbies()).map((open) => open.code)).not.toContain(lobby.code);
});

test("Should_KeepFirstClosingTime_When_LobbyIsClosedTwice", async () => {
  const lobby = await createLobby((await newUser()).id, "unlisted");
  await closeLobby(lobby.id);
  const [first] = await db.select().from(lobbies).where(eq(lobbies.id, lobby.id));

  await closeLobby(lobby.id);

  const [second] = await db.select().from(lobbies).where(eq(lobbies.id, lobby.id));
  expect(second.closedAt).toEqual(first.closedAt);
});

test("Should_ListParticipantsInJoinOrder_When_UsersJoin", async () => {
  const host = await newUser();
  const guest = await newUser();
  const lobby = await createLobby(host.id, "unlisted");

  await addParticipant(lobby.id, host.id);
  await addParticipant(lobby.id, guest.id);
  await addParticipant(lobby.id, host.id);

  expect(await listParticipants(lobby.id)).toEqual([
    { id: host.id, username: host.username },
    { id: guest.id, username: guest.username },
  ]);
});

test("Should_RemoveOnlyThatUser_When_ParticipantLeaves", async () => {
  const host = await newUser();
  const guest = await newUser();
  const lobby = await createLobby(host.id, "unlisted");
  await addParticipant(lobby.id, host.id);
  await addParticipant(lobby.id, guest.id);

  await removeParticipant(lobby.id, guest.id);

  expect(await listParticipants(lobby.id)).toEqual([
    { id: host.id, username: host.username },
  ]);
});

test("Should_ListOnlyOpenPublicLobbiesWithParticipants_When_ListingPublicLobbies", async () => {
  const host = await newUser();
  const joined = await createLobby(host.id, "public");
  const empty = await createLobby(host.id, "public");
  const unlisted = await createLobby(host.id, "unlisted");
  const closed = await createLobby(host.id, "public");
  for (const lobby of [joined, unlisted, closed]) {
    await addParticipant(lobby.id, host.id);
  }
  await db.update(lobbies).set({ closedAt: new Date() }).where(eq(lobbies.id, closed.id));

  const codes = (await listPublicLobbies()).map((lobby) => lobby.code);

  expect(codes).toContain(joined.code);
  expect(codes).not.toContain(empty.code);
  expect(codes).not.toContain(unlisted.code);
  expect(codes).not.toContain(closed.code);
});

test("Should_ShowHostNameAndCount_When_ListingPublicLobbies", async () => {
  const host = await newUser();
  const guest = await newUser();
  const lobby = await createLobby(host.id, "public");
  await addParticipant(lobby.id, host.id);
  await addParticipant(lobby.id, guest.id);

  const listed = (await listPublicLobbies()).find((l) => l.code === lobby.code);

  expect(listed).toEqual({ code: lobby.code, hostName: host.username, participantCount: 2 });
});

test("Should_NotListLobby_When_LobbyIsPrivate", async () => {
  const host = await newUser();
  const lobby = await createLobby(host.id, "private");
  await addParticipant(lobby.id, host.id);

  const codes = (await listPublicLobbies()).map((l) => l.code);

  expect(codes).not.toContain(lobby.code);
});

test("Should_CreateDistinctUnusedLinks_When_HostGeneratesInvites", async () => {
  const lobby = await createLobby((await newUser()).id, "private");

  const tokens = await createInvites(lobby.id, 30);

  expect(new Set(tokens).size).toBe(30);
  expect(await listInvites(lobby.id)).toHaveLength(30);
  expect((await listInvites(lobby.id)).every((invite) => !invite.used)).toBe(true);
});

test("Should_LetEveryoneEnter_When_LobbyIsNotPrivate", async () => {
  const lobby = await createLobby((await newUser()).id, "unlisted");

  expect(await canEnterLobby(lobby, (await newUser()).id)).toBe(true);
});

test("Should_RefuseEntry_When_UserHasNoInviteToPrivateLobby", async () => {
  const lobby = await createLobby((await newUser()).id, "private");

  expect(await canEnterLobby(lobby, (await newUser()).id)).toBe(false);
});

test("Should_LetHostEnter_When_LobbyIsPrivate", async () => {
  const host = await newUser();
  const lobby = await createLobby(host.id, "private");

  expect(await canEnterLobby(lobby, host.id)).toBe(true);
});

test("Should_AdmitUserAndMarkLinkUsed_When_UserClaimsInvite", async () => {
  const lobby = await createLobby((await newUser()).id, "private");
  const [token] = await createInvites(lobby.id, 1);
  const student = await newUser();

  expect((await claimInvite(token, student.id, IP))?.id).toBe(lobby.id);

  expect(await canEnterLobby(lobby, student.id)).toBe(true);
  expect(await listInvites(lobby.id)).toEqual([{ token, used: true }]);
});

test("Should_RefuseLink_When_AnotherIpAlreadyUsedIt", async () => {
  const lobby = await createLobby((await newUser()).id, "private");
  const [token] = await createInvites(lobby.id, 1);
  await claimInvite(token, (await newUser()).id, IP);
  const other = await newUser();

  expect(await claimInvite(token, other.id, OTHER_IP)).toBeNull();
  expect(await findInviteLobby(token, OTHER_IP)).toBeNull();
  expect(await canEnterLobby(lobby, other.id)).toBe(false);
});

test("Should_RefuseLink_When_SameUserComesFromAnotherIp", async () => {
  const lobby = await createLobby((await newUser()).id, "private");
  const [token] = await createInvites(lobby.id, 1);
  const student = await newUser();
  await claimInvite(token, student.id, IP);

  expect(await claimInvite(token, student.id, OTHER_IP)).toBeNull();
});

test("Should_MoveLinkToNewAccount_When_ReusedFromSameIp", async () => {
  const lobby = await createLobby((await newUser()).id, "private");
  const [token] = await createInvites(lobby.id, 1);
  const lostSession = await newUser();
  await claimInvite(token, lostSession.id, IP);
  const newGuest = await newUser();

  expect((await claimInvite(token, newGuest.id, IP))?.id).toBe(lobby.id);
  expect(await canEnterLobby(lobby, newGuest.id)).toBe(true);
  expect(await canEnterLobby(lobby, lostSession.id)).toBe(false);
});

test("Should_BindLink_When_LobbyIsJoinedByCode", async () => {
  const lobby = await createLobby((await newUser()).id, "unlisted");
  const [token] = await createInvites(lobby.id, 1);

  expect((await claimInvite(token, (await newUser()).id, IP))?.id).toBe(lobby.id);

  expect(await listInvites(lobby.id)).toEqual([{ token, used: true }]);
  expect(await claimInvite(token, (await newUser()).id, OTHER_IP)).toBeNull();
});

test("Should_AcceptLinkAgain_When_SameUserReopensItFromSameIp", async () => {
  const lobby = await createLobby((await newUser()).id, "private");
  const [token] = await createInvites(lobby.id, 1);
  const student = await newUser();
  await claimInvite(token, student.id, IP);

  expect((await claimInvite(token, student.id, IP))?.id).toBe(lobby.id);
});

test("Should_RefuseEntry_When_UserWasKickedFromPublicLobby", async () => {
  const lobby = await createLobby((await newUser()).id, "public");
  const kicked = await newUser();

  await banParticipant(lobby.id, kicked.id);

  expect(await canEnterLobby(lobby, kicked.id)).toBe(false);
  expect(await canEnterLobby(lobby, (await newUser()).id)).toBe(true);
});

test("Should_RevokeInviteLink_When_InvitedUserIsKicked", async () => {
  const lobby = await createLobby((await newUser()).id, "private");
  const [token, other] = await createInvites(lobby.id, 2);
  const kicked = await newUser();
  await claimInvite(token, kicked.id, IP);

  await banParticipant(lobby.id, kicked.id);

  expect(await findInviteLobby(token, IP)).toBeNull();
  expect(await canEnterLobby(lobby, kicked.id)).toBe(false);
  expect(await listInvites(lobby.id)).toEqual([{ token: other, used: false }]);
});

test("Should_KeepFreeLinkUnused_When_KickedUserTriesIt", async () => {
  const lobby = await createLobby((await newUser()).id, "private");
  const [token] = await createInvites(lobby.id, 1);
  const kicked = await newUser();
  await banParticipant(lobby.id, kicked.id);

  expect(await claimInvite(token, kicked.id, IP)).toBeNull();
  expect(await listInvites(lobby.id)).toEqual([{ token, used: false }]);
});

test("Should_KeepOneBan_When_UserIsKickedTwice", async () => {
  const lobby = await createLobby((await newUser()).id, "public");
  const kicked = await newUser();

  await banParticipant(lobby.id, kicked.id);
  await expect(banParticipant(lobby.id, kicked.id)).resolves.toBeUndefined();
});

test("Should_GiveLinkToOnlyOneIp_When_TwoIpsClaimItAtOnce", async () => {
  const lobby = await createLobby((await newUser()).id, "private");
  const [token] = await createInvites(lobby.id, 1);
  const [first, second] = [await newUser(), await newUser()];

  const results = await Promise.all([
    claimInvite(token, first.id, IP),
    claimInvite(token, second.id, OTHER_IP),
  ]);

  expect(results.filter(Boolean)).toHaveLength(1);
});

test("Should_KeepLinkUnused_When_UserCanAlreadyEnter", async () => {
  const host = await newUser();
  const lobby = await createLobby(host.id, "private");
  const [token] = await createInvites(lobby.id, 1);

  expect((await claimInvite(token, host.id, IP))?.id).toBe(lobby.id);

  expect(await listInvites(lobby.id)).toEqual([{ token, used: false }]);
});

test("Should_RefuseLink_When_LobbyIsClosed", async () => {
  const lobby = await createLobby((await newUser()).id, "private");
  const [token] = await createInvites(lobby.id, 1);
  await db.update(lobbies).set({ closedAt: new Date() }).where(eq(lobbies.id, lobby.id));

  expect(await findInviteLobby(token, IP)).toBeNull();
  expect(await claimInvite(token, (await newUser()).id, IP)).toBeNull();
});

test("Should_ReturnNull_When_LinkDoesNotExist", async () => {
  expect(await findInviteLobby("inconnu", IP)).toBeNull();
  expect(await claimInvite("inconnu", (await newUser()).id, IP)).toBeNull();
});
