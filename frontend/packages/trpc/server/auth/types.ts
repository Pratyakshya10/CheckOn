export type AuthUser = {
  id: string;
  email: string;
  fullName: string;
  profileRole?: string;
  provider: "password" | "google" | "demo";
  totpEnabled: boolean;
};

export type AccountSettings = {
  emailAlerts: boolean;
  weeklyDigest: boolean;
  pushNotifications: boolean;
  noiseFiltering: boolean;
  digestFrequency: "daily" | "weekly" | "biweekly" | "off";
  digestTime: string;
  includeQuietWatches: boolean;
};
