import type { Identity } from "@dfinity/agent";

export type Status = "initializing" | "idle" | "authenticating" | "success" | "error";

export interface IdentityContext {
  clear: () => Promise<void>;
  error?: Error;
  status: Status;
  identity?: Identity;
}

export interface InternetIdentityContext {
  login: (loginOptions?: LoginOptions) => void;
}

export interface LoginOptions {
  identityProvider?: string;
  maxTimeToLive?: bigint;
  windowOpenerFeatures?: string;
}
