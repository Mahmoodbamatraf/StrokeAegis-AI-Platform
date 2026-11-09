/*
 * Thin HTTP client for the StrokeAegis FastAPI backend.
 * Auth: JWT in localStorage (`strokeaegis_token`), sent as `Authorization: Bearer <token>`.
 * Same keys as the legacy frontend so existing sessions keep working.
 */

export const TOKEN_KEY = 'strokeaegis_token';
export const USER_KEY = 'strokeaegis_user';

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

let onUnauthorized: (() => void) | null = null;

/** Called by AppCore so a 401 anywhere ends the session. */
export function setUnauthorizedHandler(fn: () => void): void {
  onUnauthorized = fn;
}

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setSession(token: string | null, user?: unknown): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
      if (user !== undefined) localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
  } catch {
    /* storage blocked: session lives in memory only */
  }
}

type Body = Record<string, unknown> | FormData | undefined;

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: Body;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** false = a 401 here must not trigger logout (public endpoints, session restore). */
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, auth = true } = opts;
  let url = path;
  if (query) {
    const qs = new URLSearchParams();
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
    });
    const s = qs.toString();
    if (s) url += `?${s}`;
  }

  const headers: Record<string, string> = {};
  const token = getToken();
  // Always send the token when we have one; `auth` only controls whether a 401 ends the session.
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload: BodyInit | undefined;
  if (body instanceof FormData) {
    payload = body; // browser sets the multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  } else if (method === 'POST') {
    headers['Content-Type'] = 'application/json';
  }

  let res: Response;
  try {
    res = await fetch(url, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'تعذّر الاتصال بالخادم. Unable to reach the server.');
  }

  if (res.status === 401 && auth) {
    onUnauthorized?.();
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  const text = await res.text();
  let data: any = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { detail: text };
    }
  }
  if (!res.ok) {
    const msg =
      (data && (typeof data.detail === 'string' ? data.detail : data.message)) ||
      `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

export const api = {
  get: <T = any>(path: string, query?: RequestOptions['query'], auth = true) =>
    request<T>(path, { method: 'GET', query, auth }),
  post: <T = any>(path: string, body?: Body, auth = true) =>
    request<T>(path, { method: 'POST', body, auth }),
};

/** PDF download for portal reports. Uses the token in the header, then saves the blob. */
export async function downloadReportPdf(reportId: string, filename: string | null): Promise<void> {
  const token = getToken();
  const res = await fetch(`/api/clinical-portal/reports/${encodeURIComponent(reportId)}/download`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (res.status === 401) {
    onUnauthorized?.();
    throw new ApiError(401, 'Session expired');
  }
  if (!res.ok) throw new ApiError(res.status, 'تعذّر تحميل التقرير. Report download failed.');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `report-${reportId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
