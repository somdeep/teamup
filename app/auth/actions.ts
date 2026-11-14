"use server";

import { createClient } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { authOrigin, isLive, supabaseKey, supabaseUrl } from "../../lib/auth-config";
import { newPasswordError, readEmail, readText, validEmailToken } from "../../lib/auth-input";
import { isGoogleAvailable } from "../../lib/google-auth";
import { readSignupProfile } from "../../lib/signup-profile";
import { supabase } from "../../lib/supabase";

export type AuthResult = { error?: string };

const unavailable = { error: "TeamUp sign-in is unavailable right now." };
const expiredLink = { error: "This link is invalid or has expired. Request a new link and try again." };

export async function signIn(_: AuthResult, form: FormData): Promise<AuthResult> {
  if (!isLive) return unavailable;
  const email = readEmail(form);
  const password = readText(form, "password");
  if (!email || !password || password.length > 1024) return { error: "Enter your email and password." };

  const client = await supabase();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 429) return { error: "Too many attempts. Wait a moment and try again." };
    return { error: "Couldn’t sign in. Check your email, password, and inbox for a confirmation link." };
  }
  redirect("/account");
}

export async function signUp(_: AuthResult, form: FormData): Promise<AuthResult> {
  const origin = authOrigin();
  if (!isLive || !origin) return unavailable;

  const email = readEmail(form);
  if (!email) return { error: "Enter a valid email address." };
  const profile = readSignupProfile(form);
  if ("error" in profile) return { error: profile.error };
  const password = readText(form, "password");
  const passwordError = newPasswordError(password);
  if (passwordError) return { error: passwordError };

  const client = await supabase();
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: origin + "/auth/confirm",
      data: profile.profile,
    },
  });
  if (error?.code === "weak_password") return { error: "Choose a stronger password or a longer passphrase." };
  if (error?.code === "signup_disabled") return { error: "Account signup is unavailable right now." };
  if (data.session) await client.auth.signOut({ scope: "local" });
  redirect("/login?notice=check-email");
}

export async function signInWithGoogle(): Promise<AuthResult> {
  const origin = authOrigin();
  if (!origin || !(await isGoogleAvailable())) {
    return { error: "Google sign-in is unavailable right now. You can log in with email and password." };
  }

  const requestOrigin = (await headers()).get("origin");
  if (requestOrigin && requestOrigin !== origin) redirect(origin + "/login");

  const client = await supabase();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: origin + "/auth/callback" },
  });
  if (error || !data.url) return { error: "Couldn’t start Google sign-in. Please try again." };
  redirect(data.url);
}

export async function requestPasswordReset(_: AuthResult, form: FormData): Promise<AuthResult> {
  const origin = authOrigin();
  if (!isLive || !origin) return unavailable;

  const email = readEmail(form);
  if (!email) return { error: "Enter a valid email address." };
  const client = await supabase();
  await client.auth.resetPasswordForEmail(email, { redirectTo: origin + "/reset-password" });
  redirect("/login?notice=reset-email");
}

export async function confirmEmail(token: string): Promise<AuthResult> {
  if (!isLive) return unavailable;
  if (!validEmailToken(token)) return expiredLink;

  const client = await supabase();
  const { data, error } = await client.auth.verifyOtp({ token_hash: token, type: "signup" });
  if (error || !data.session) return expiredLink;
  redirect("/account");
}

export async function resetPassword(token: string, _: AuthResult, form: FormData): Promise<AuthResult> {
  if (!supabaseUrl || !supabaseKey) return unavailable;
  if (!validEmailToken(token)) return expiredLink;

  const password = readText(form, "password");
  const passwordError = newPasswordError(password);
  if (passwordError) return { error: passwordError };
  if (password !== readText(form, "confirmPassword")) return { error: "The passwords don’t match." };

  // Keep the recovery session isolated from the browser's active sign-in.
  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });
  const { data, error } = await client.auth.verifyOtp({ token_hash: token, type: "recovery" });
  if (error || !data.session) return expiredLink;

  const { error: updateError } = await client.auth.updateUser({ password });
  if (updateError) {
    await client.auth.signOut({ scope: "local" });
    return { error: "The password couldn’t be changed. Request a new reset link and choose a different password." };
  }
  await client.auth.signOut({ scope: "global" });
  redirect("/login?notice=password-updated");
}

export async function signOut() {
  if (isLive) {
    const client = await supabase();
    // The SSR client clears its auth cookies after a local sign-out.
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) redirect("/account?notice=signout-failed");
  }
  redirect("/login");
}
