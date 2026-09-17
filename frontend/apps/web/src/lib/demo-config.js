/** Demo login is off unless explicitly enabled in `.env`. */
export function isDemoLoginEnabled() {
  return import.meta.env.VITE_DEMO_LOGIN_ENABLED === "true";
}
