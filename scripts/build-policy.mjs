export function assertPrototypeBuild(env) {
  if (
    (env.ICEBREAKER_APP_MODE || "prototype") !== "prototype" ||
    /^(production|enterprise)$/i.test(env.ICEBREAKER_DEPLOYMENT_TIER || "")
  ) {
    throw new Error(
      "Enterprise release blocked: Entra identity, server authorization, shared persistence and operational gates are not yet implemented. This build is prototype-only.",
    );
  }
  if (
    Object.keys(env).some(
      (key) =>
        key.startsWith("VITE_") &&
        /SECRET|PASSWORD|PRIVATE|TOKEN|CREDENTIAL/i.test(key),
    )
  )
    throw new Error(
      "Refusing to expose secret-like VITE_ configuration to the browser.",
    );
}
export function basePath(value = "") {
  if (!value || value === "/") return "/";
  if (!/^\/[A-Za-z0-9_-]+\/?$/.test(value))
    throw new Error("Use a single safe deployment base path.");
  return value.replace(/\/$/, "") + "/";
}
