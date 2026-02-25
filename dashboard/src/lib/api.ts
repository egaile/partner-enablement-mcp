const GATEWAY_URL =
  process.env.NEXT_PUBLIC_GATEWAY_API_URL || "http://localhost:4000";

export async function gatewayFetch<T>(
  path: string,
  token: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(
      (body as { error?: string }).error || `Gateway error: ${res.status}`
    );
  }

  return res.json() as Promise<T>;
}
