export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  provider: "password" | "google" | "demo";
};
