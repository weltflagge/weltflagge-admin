"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  AUTH_COOKIE_NAME,
  AUTH_TTL_SECONDS,
  createSessionToken,
  isAuthConfigured,
  sanitizeReturnPath,
  verifyCredentials,
} from "@/src/lib/auth-session";

type LoginState = {
  error?: string;
};

export async function login(_state: LoginState, formData: FormData): Promise<LoginState> {
  if (!isAuthConfigured()) {
    return {
      error: "Login is not configured. Set ADMIN_USERNAME, ADMIN_PASSWORD or ADMIN_PASSWORD_SHA256, and AUTH_SECRET.",
    };
  }

  const username = String(formData.get("username") ?? "");
  const password = String(formData.get("password") ?? "");

  if (!verifyCredentials(username, password)) {
    return { error: "Invalid username or password." };
  }

  const cookieStore = await cookies();
  cookieStore.set({
    name: AUTH_COOKIE_NAME,
    value: createSessionToken(username),
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: AUTH_TTL_SECONDS,
    path: "/",
  });

  redirect(sanitizeReturnPath(formData.get("next")));
}
