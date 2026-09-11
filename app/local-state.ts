// Keep the latest in-memory snapshot available for export if browser quota is hit.
const pending = new Map<string, string>();
export function persistWorkspaceValue(key: string, value: string) {
  pending.set(key, value);
  try {
    localStorage.setItem(key, value);
  } catch {
    window.dispatchEvent(new Event("icebreaker-storage-error"));
  }
}
export function workspaceSnapshot(): Record<string, string> {
  const saved = Object.fromEntries(
    Object.keys(localStorage)
      .filter((key) => key.startsWith("icebreaker-"))
      .map((key) => [key, localStorage.getItem(key) || ""]),
  );
  return { ...saved, ...Object.fromEntries(pending) };
}
