export async function readResponseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(response.ok ? "The server sent an empty reply." : `Request failed (${response.status}).`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("The server did not return JSON.");
  }
}
