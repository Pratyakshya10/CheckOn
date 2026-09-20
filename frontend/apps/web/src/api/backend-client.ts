export type BackendWatch = {
  watchId: string;
  url: string;
  normalizedUrl: string;
  title: string;
  slug: string;
  isPublic: boolean;
  subscriberCount: number;
  checkIntervalMinutes: number;
  nextCheckAt: string;
  lastCheckedAt: string | null;
  status: "active" | "failing" | "blocked";
};

export type BackendSubscription = {
  userId: string;
  watchId: string;
  conditionText: string;
  deliveryMode: "instant" | "digest";
  language: string;
  muted: boolean;
  createdAt: string;
  lastNotifiedAt: string | null;
  digestHour: number;
  timezone: string;
};

export type ChangeFact =
  | { type: "date_change"; field: string; from: string; to: string }
  | { type: "row_added"; table: string; value: string }
  | { type: "row_removed"; table: string; value: string }
  | { type: "value_change"; field: string; from: string; to: string }
  | { type: "text_added"; excerpt: string };

export type BackendChange = {
  watchId: string;
  detectedAt: string;
  changeFacts: ChangeFact[];
  diffKey: string;
  isCosmetic: boolean;
  summary: string;
};

export type DashboardWatchRow = {
  subscription: BackendSubscription;
  watch: BackendWatch;
  latestChange: BackendChange | null;
};

export type PublicWatchResponse = {
  watchId: string;
  title: string;
  url: string;
  slug: string;
  subscriberCount: number;
  status: string;
  timeline: Array<{
    detectedAt: string;
    summary: string;
    isCosmetic: boolean;
    changeFacts: ChangeFact[];
  }>;
};

export type AnnotatedDiffBlock = {
  value: string;
  added?: boolean;
  removed?: boolean;
  isNoise: boolean;
  noiseReason?: string;
};

export type TrialCheckResponse = {
  url: string;
  conditionText: string;
  conditionRule: unknown;
  currentState: string;
  matched: boolean;
  matchReason: string;
};

type ErrorPayload = {
  error?: string;
  message?: string;
};

export class BackendApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "BackendApiError";
  }
}

function backendUrl(path: string) {
  const base = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";
  return `${base}/backend${path}`;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(backendUrl(path), {
    ...init,
    credentials: "include",
    headers: {
      accept: "application/json",
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const text = await response.text();
  let payload: unknown = undefined;
  if (text) {
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      payload = text;
    }
  }

  if (!response.ok) {
    const error = typeof payload === "object" && payload !== null ? (payload as ErrorPayload) : {};
    throw new BackendApiError(
      error.message || error.error || `Backend request failed (${response.status})`,
      response.status,
      error.error,
    );
  }

  return payload as T;
}

export const backendApi = {
  trialCheck(input: { url: string; conditionText: string }) {
    return request<TrialCheckResponse>("/trial-check", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  createWatch(input: { url: string; title?: string; checkIntervalMinutes?: number }) {
    return request<BackendWatch>("/watches", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  subscribe(input: {
    watchId: string;
    conditionText: string;
    deliveryMode: "instant" | "digest";
    language?: string;
    digestHour?: number;
    timezone?: string;
    email?: string;
  }) {
    return request<BackendSubscription>("/subscribe", {
      method: "POST",
      body: JSON.stringify(input),
    });
  },

  listDashboardWatches() {
    return request<DashboardWatchRow[]>("/dashboard/watches");
  },

  updateDashboardWatch(
    watchId: string,
    input: { title?: string; conditionText?: string; checkIntervalMinutes?: number },
  ) {
    return request<{ watch: BackendWatch; subscription: BackendSubscription }>(
      `/dashboard/watches/${encodeURIComponent(watchId)}`,
      { method: "PATCH", body: JSON.stringify(input) },
    );
  },

  checkNow(watchId: string) {
    return request<{ enqueued: true; watchId: string }>(
      `/dashboard/watches/${encodeURIComponent(watchId)}/check-now`,
      { method: "POST" },
    );
  },

  getWatch(watchId: string) {
    return request<PublicWatchResponse>(`/watches/${encodeURIComponent(watchId)}`);
  },

  getDiff(watchId: string, detectedAt: string) {
    return request<{ blocks: AnnotatedDiffBlock[] }>(
      `/watches/${encodeURIComponent(watchId)}/changes/${encodeURIComponent(detectedAt)}/diff`,
    );
  },

  unsubscribe(watchId: string) {
    return request<void>(`/subscriptions/${encodeURIComponent(watchId)}`, {
      method: "DELETE",
    });
  },
};
