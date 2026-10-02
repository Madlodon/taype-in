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
  signUp,
} from "@/lib/auth";
import {
  deleteSessionCookie,
  SESSION_COOKIE,
  setSessionCookie,
} from "@/lib/session-cookie";

// error est une clé de traduction (Auth.errors).
export type AuthFormState = {
  error?: string;
  username?: string;
} | undefined;

// Page où revenir après la connexion (ex. un lien d'invitation) ; seulement un chemin du site.
function nextPath(formData: FormData): string {
  const next = String(formData.get("next") ?? "");
  return /^\/(?![/\\])/.test(next) ? next : "/";
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

  const user = await signUp(parsed.data.username, parsed.data.password);
  if (user === "taken") {
    return { error: "usernameTaken", username };
  }

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

export async function guestAction() {
  const guest = await createGuest();
  await startSession(guest.id);
  redirect("/");
}

export async function logOutAction() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (token) await invalidateSession(token);
  await deleteSessionCookie();
  redirect("/");
}
