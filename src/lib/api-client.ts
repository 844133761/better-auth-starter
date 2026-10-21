export async function apiRequest<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = await response.json();
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.assign(
        `/auth?next=${encodeURIComponent(window.location.pathname + window.location.search)}`,
      );
    }
    throw new Error(data.error || "请求失败，请稍后重试");
  }
  return data as T;
}
