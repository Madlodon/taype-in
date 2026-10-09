"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createGuest,
  createSession,
  credentialsSchema,
  invalidateSession,
  logIn,
  safeNextPath,
  signUp,
} from "@/lib/auth";
import {
  deleteSessionCookie,
  getCurrentUser,
  SESSION_COOKIE,
  setSessionCookie,
} from "@/lib/session-cookie";

// error est une clé de traduction (Auth.errors).
export type AuthFormState = {
  error?: string;
  username?: string;
} | undefined;

function nextPath(formData: FormData): string {
  return safeNextPath(String(formData.get("next") ?? ""));
}

async function startSession(userId: string) {
  const { token, expiresAt } = await createSession(userId);
  await setSessionCookie(token, expiresAt);
}

export async function signUpAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = credentialsSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });
  const username = String(formData.get("username") ?? "");
  if (!parsed.success) {
    return { error: parsed.error.issues[0].message, username };
  }

  const current = await getCurrentUser();
  const guestId = current?.isGuest ? current.id : undefined;
  const user = await signUp(parsed.data.username, parsed.data.password, guestId);
  if (user === "taken") {
    return { error: "usernameTaken", username };
  }

  // Nouveau jeton une fois inscrit : celui de l'invité ne sert plus.
  if (guestId) await invalidateSession((await cookies()).get(SESSION_COOKIE)!.value);
  await startSession(user.id);
  redirect(nextPath(formData));
}

export async function logInAction(
  _state: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const parsed = z
    .object({ username: z.string().trim(), password: z.string() })
    .safeParse({
      username: formData.get("username"),
      password: formData.get("password"),
    });
  const user = parsed.success
    ? await logIn(parsed.data.username, parsed.data.password)
    : null;
  if (!user) {
    return {
      error: "wrongCredentials",
      username: String(formData.get("username") ?? ""),
    };
  }

  await startSession(user.id);
  redirect(nextPath(formData));
}

export async function guestAction(formData: FormData) {
  const guest = await createGuest();
  await startSession(guest.id);
  redirect(nextPath(formData));
}

export async function logOutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await invalidateSession(token);
  await deleteSessionCookie();
  redirect("/");
}
