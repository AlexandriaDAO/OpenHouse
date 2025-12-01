import type { IdentityContext, InternetIdentityContext, Status, LoginOptions } from "./types";

// Re-export hooks
export { useIdentity } from "./hooks/useIdentity";
export { useInternetIdentity } from "./hooks/useInternetIdentity";

// Re-export initialization utilities
export { ensureInitialized, IdentityProvider } from "./init";

// Re-export store accessors
export { getIdentity, isAuthenticated } from "./store/accessors";

// Re-export store mutators
export { setError, setIdentity, setStatus } from "./store/mutators";

// Re-export types
export type { Status, IdentityContext, InternetIdentityContext, LoginOptions };
