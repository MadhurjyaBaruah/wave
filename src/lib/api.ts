export async function fetchJson<T = any>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  const text = await res.text();

  let data: any;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    // If the server returned HTML or plain text (e.g. Vercel 500 error page)
    if (!res.ok) {
      if (res.status === 500) {
        throw new Error('Database connection failed. Please ensure DATABASE_URL is set in Vercel and the database tables are created.');
      }
      throw new Error(`Server returned status ${res.status}: ${text.slice(0, 100)}`);
    }
    throw new Error('Invalid response from server');
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
  }

  return data;
}
