export const minimumPasswordLength = 12;
export const maximumPasswordBytes = 72;

export function readText(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === "string" ? value : "";
}

export function readEmail(form: FormData) {
  const email = readText(form, "email").trim();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

export function newPasswordError(password: string) {
  if (Array.from(password).length < minimumPasswordLength) return "Use at least 12 characters for your password.";
  if (new TextEncoder().encode(password).length > maximumPasswordBytes) return "Use a password no longer than 72 bytes.";
  return null;
}

export function validEmailToken(token: unknown): token is string {
  return typeof token === "string" && /^[A-Za-z0-9_-]{20,256}$/.test(token);
}
