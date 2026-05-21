export type JsonBody = Record<string, unknown> | unknown[];

export async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

function errMessage(data: unknown): string {
  if (data && typeof data === 'object' && 'error' in data && typeof (data as { error: unknown }).error === 'string') {
    return (data as { error: string }).error;
  }
  return 'Ошибка запроса';
}

export async function apiFetch(
  url: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<Response> {
  const { token, headers: hdrs, ...rest } = options;
  const headers = new Headers(hdrs);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(url, { ...rest, headers });
}

export async function apiJson<T>(
  url: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const res = await apiFetch(url, options);
  const data = await parseJsonSafe(res);
  if (!res.ok) {
    throw new ApiError(res.status, errMessage(data));
  }
  return data as T;
}
