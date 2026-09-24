import { renderToString } from "react-dom/server";
import IcebreakerApp from "./icebreaker-app";
import { WorkspaceBoundary } from "./workspace-boundary";
export const render = () =>
  renderToString(
    <WorkspaceBoundary>
      <IcebreakerApp />
    </WorkspaceBoundary>,
  );
