import { hydrateRoot, createRoot } from "react-dom/client";
import IcebreakerApp from "./icebreaker-app";
import { WorkspaceBoundary } from "./workspace-boundary";
import "./globals.css";
const root = document.getElementById("root")!;
const app = (
  <WorkspaceBoundary>
    <IcebreakerApp />
  </WorkspaceBoundary>
);
if (root.querySelector(".app-shell")) hydrateRoot(root, app);
else createRoot(root).render(app);
