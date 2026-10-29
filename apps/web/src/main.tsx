import { mountAimApplication } from "./app/mountAimApplication";

// Generated tokens first; global rules consume those variables.
import "./shared/styles/tokens.generated.css";
import "./shared/styles/global.css";

/**
 * File 57 — default, fail-closed browser entry point.
 *
 * A reviewed identity integration can instead use mountAimApplication(root,
 * { identitySource }) from its OWN trusted entry point. This default entry
 * NEVER discovers an identity source from window, environment, DOM, URLs or
 * local storage. An API path alone is not authentication or authorization.
 */
const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error(
    'Bandha AIM cannot start: index.html must contain <div id="root"></div>.',
  );
}

const application = mountAimApplication(rootElement);

// Development HMR teardown must not leave stale roots or auth subscriptions.
if (import.meta.hot) {
  import.meta.hot.dispose(() => application.dispose());
}
