import { Component, useState, type ReactNode } from "react";
import {
  blockWorkspaceWrites,
  workspaceSnapshot,
  storedWorkspaceSnapshot,
} from "./local-state";
import { allLocalFiles } from "./local-files";
export function RecoveryPanel({ message }: { message: string }) {
  const [status, setStatus] = useState("");
  const exportRecovery = async () => {
    setStatus("Preparing recovery export…");
    try {
      const metadata = workspaceSnapshot();
      let documentError = false;
      const files = await allLocalFiles().catch(() => {
        documentError = true;
        return [];
      });
      const documents = await Promise.all(
        files.map(async ({ data, ...file }) => ({
          ...file,
          data: await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = reject;
            reader.readAsDataURL(data);
          }),
        })),
      );
      const url = URL.createObjectURL(
        new Blob(
          [
            JSON.stringify({
              format: "icebreaker-recovery",
              metadata,
              storedMetadata: storedWorkspaceSnapshot(),
              files: documents,
              documentError,
            }),
          ],
          { type: "application/json" },
        ),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = "ICEbreaker-recovery.json";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setStatus(
        documentError
          ? "Metadata exported; documents could not be read. Keep this browser profile and contact support."
          : "Recovery exported. Keep it private and contact support to repair the workspace; this is not a normal restore file.",
      );
    } catch {
      setStatus(
        "Recovery could not be exported. Keep this browser profile and contact support; do not clear storage.",
      );
    }
  };
  return (
    <main className="recovery-panel" role="alert">
      <img
        src={`${import.meta.env.BASE_URL}brand/logo-lockup.png`}
        alt="Mars Food & Nutrition"
        width="180"
      />
      <h1>Your workspace is protected</h1>
      <p>{message}</p>
      <p>
        Changes are paused. Do not clear browser storage. Export recovery data
        before reloading or seeking support.
      </p>
      <button className="primary-small" onClick={exportRecovery}>
        Export recovery data
      </button>{" "}
      <button
        className="secondary-small"
        onClick={() => window.location.reload()}
      >
        Reload workspace
      </button>
      <p role="status">{status}</p>
    </main>
  );
}
export class WorkspaceBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    blockWorkspaceWrites();
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <RecoveryPanel message="ICEbreaker could not safely display this workspace. Saved records have not been reset." />
    ) : (
      this.props.children
    );
  }
}
