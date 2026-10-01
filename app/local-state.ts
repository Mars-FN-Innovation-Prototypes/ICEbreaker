import {
  WORKSPACE_KEYS,
  WORKSPACE_VERSION,
  validateWorkspace,
} from "./workspace-validation";
// Keep unsaved data available for export; never silently replace unreadable records.
const pending = new Map<string, string>();
const observed = new Map<string, string | null>();
let blocked = false;
export function blockWorkspaceWrites() {
  blocked = true;
}
export function readWorkspace() {
  const snapshot: Record<string, string> = {};
  for (const key of WORKSPACE_KEYS) {
    const value = localStorage.getItem(key);
    observed.set(key, value);
    if (value !== null) snapshot[key] = value;
  }
  try {
    validateWorkspace(snapshot);
  } catch (error) {
    blocked = true;
    throw error;
  }
  return snapshot;
}
export function persistWorkspaceValue(key: string, value: string) {
  if (blocked) return;
  pending.set(key, value);
  try {
    validateWorkspace({
      "icebreaker-data-version": WORKSPACE_VERSION,
      [key]: value,
    });
    if (observed.has(key) && localStorage.getItem(key) !== observed.get(key)) {
      blocked = true;
      window.dispatchEvent(new Event("icebreaker-workspace-conflict"));
      return;
    }
    localStorage.setItem(key, value);
    observed.set(key, value);
  } catch {
    window.dispatchEvent(new Event("icebreaker-storage-error"));
  }
}
export function workspaceSnapshot(): Record<string, string> {
  const saved = storedWorkspaceSnapshot();
  return { ...saved, ...Object.fromEntries(pending) };
}
export function storedWorkspaceSnapshot(): Record<string, string> {
  return Object.fromEntries(
    WORKSPACE_KEYS.map((key) => [key, localStorage.getItem(key)]).filter(
      (pair): pair is [string, string] => pair[1] !== null,
    ),
  );
}
