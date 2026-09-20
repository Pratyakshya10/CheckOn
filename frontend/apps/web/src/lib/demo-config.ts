/** Demo login is off unless explicitly enabled in `.env`. */
export function isDemoLoginEnabled() {
  return import.meta.env.VITE_DEMO_LOGIN_ENABLED === "true";
}

/** Keep mock dashboard data opt-in; production should use the AWS backend. */
export function isDemoDataEnabled() {
  const configured = import.meta.env.VITE_DEMO_DATA_ENABLED;
  return configured === "true" || (configured === undefined && import.meta.env.DEV);
}
