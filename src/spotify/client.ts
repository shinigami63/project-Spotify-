import { getAccessToken } from "./auth.js";

const BASE = "https://api.spotify.com/v1";
const MAX_RETRIES = 3;

export class SpotifyError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "SpotifyError";
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function spotifyFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const token = await getAccessToken();
    const url = path.startsWith("http") ? path : `${BASE}${path}`;

    const headers = new Headers(options.headers as HeadersInit | undefined);
    headers.set("Authorization", `Bearer ${token}`);
    if (!headers.has("Content-Type") && options.method !== "DELETE") {
      headers.set("Content-Type", "application/json");
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
      await sleep(retryAfter * 1000);
      attempt++;
      continue;
    }

    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(Math.pow(2, attempt) * 500);
      attempt++;
      continue;
    }

    if (!res.ok && res.status >= 400) {
      let message = res.statusText;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        message = body.error?.message ?? message;
      } catch {
        // ignore parse error
      }
      throw new SpotifyError(res.status, message);
    }

    return res;
  }

  throw new SpotifyError(503, "Max retries exceeded");
}

export async function spotifyGet<T>(path: string): Promise<T> {
  const res = await spotifyFetch(path, { method: "GET" });
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export async function spotifyPost<T>(path: string, body?: unknown): Promise<T> {
  const res = await spotifyFetch(path, {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204 || res.status === 201) {
    try {
      return (await res.json()) as T;
    } catch {
      return {} as T;
    }
  }
  return res.json() as Promise<T>;
}

export async function spotifyPut(path: string, body?: unknown): Promise<void> {
  await spotifyFetch(path, {
    method: "PUT",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export async function spotifyDelete(
  path: string,
  body?: unknown
): Promise<void> {
  await spotifyFetch(path, {
    method: "DELETE",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: body ? { "Content-Type": "application/json" } : {},
  });
}

export async function spotifyPutRaw(
  path: string,
  rawBody: string,
  contentType: string
): Promise<void> {
  const token = await getAccessToken();
  const url = `${BASE}${path}`;
  let attempt = 0;

  while (attempt <= MAX_RETRIES) {
    const res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body: rawBody,
    });

    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get("Retry-After") ?? "1", 10);
      await sleep(retryAfter * 1000);
      attempt++;
      continue;
    }

    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(Math.pow(2, attempt) * 500);
      attempt++;
      continue;
    }

    if (res.status === 200 || res.status === 202 || res.status === 204) {
      return;
    }

    if (!res.ok) {
      let message = res.statusText;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        message = body.error?.message ?? message;
      } catch {
        // ignore
      }
      throw new SpotifyError(res.status, message);
    }

    return;
  }

  throw new SpotifyError(503, "Max retries exceeded");
}
