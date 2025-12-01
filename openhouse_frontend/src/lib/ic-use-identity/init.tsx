import type { Identity } from "@dfinity/agent";
import { AuthClient, type AuthClientCreateOptions } from "@dfinity/auth-client";
import { DelegationIdentity, isDelegationValid } from "@dfinity/identity";
import { type ReactNode, useEffect } from "react";
import { store } from "./store";
import { getIdentity, isAuthenticated } from "./store/accessors";

let initializationResolve: ((identity?: Identity) => void) | null = null;
let initializationReject: ((reason: Error) => void) | null = null;
let initializationPromise: Promise<Identity | undefined>;

function createInitializationPromise() {
  initializationPromise = new Promise<Identity | undefined>((resolve, reject) => {
    initializationResolve = resolve;
    initializationReject = reject;
  });
}

createInitializationPromise();

export async function ensureInitialized(): Promise<Identity | undefined> {
  const status = store.getSnapshot().context.status;

  if (status === "error") {
    const err = store.getSnapshot().context.error;
    throw err ?? new Error("Initialization failed");
  }

  if (status !== "initializing") {
    return isAuthenticated() ? getIdentity() : undefined;
  }

  return initializationPromise;
}

export async function createAuthClient(
  createOptions?: AuthClientCreateOptions
): Promise<AuthClient> {
  const options: AuthClientCreateOptions = {
    idleOptions: {
      disableDefaultIdleCallback: true,
      disableIdle: true,
      ...createOptions?.idleOptions,
    },
    ...createOptions,
  };
  const authClient = await AuthClient.create(options);
  store.send({ type: "setState", authClient });
  return authClient;
}

/**
 * Validates that an identity has a valid, non-expired delegation
 */
function hasValidDelegation(identity: Identity): boolean {
  if (identity.getPrincipal().isAnonymous()) {
    return false;
  }

  if (identity instanceof DelegationIdentity) {
    return isDelegationValid(identity.getDelegation());
  }

  // Non-delegation identities are considered valid
  return true;
}

export function IdentityProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (!initializationResolve) createInitializationPromise();

    void (async () => {
      try {
        store.send({
          type: "setState",
          providerComponentPresent: true,
          status: "initializing" as const,
        });

        let authClient = store.getSnapshot().context.authClient;
        authClient ??= await createAuthClient();

        // Check if authenticated AND has a valid delegation
        const isAuth = await authClient.isAuthenticated();

        if (isAuth) {
          const identity = authClient.getIdentity();

          // Validate the delegation is not expired
          if (hasValidDelegation(identity)) {
            console.log("Valid delegation found, user authenticated");
            store.send({
              type: "setState",
              identity,
              status: "success" as const,
              error: undefined,
            });

            if (initializationResolve) {
              initializationResolve(identity);
              initializationResolve = null;
              initializationReject = null;
              initializationPromise = Promise.resolve(identity);
            }
          } else {
            // Delegation is expired or invalid - log out the user
            console.warn("Delegation expired or invalid, logging out");
            await authClient.logout();

            // Create a fresh auth client
            authClient = await createAuthClient();

            store.send({
              type: "setState",
              identity: undefined,
              status: "idle" as const,
              error: undefined,
            });

            if (initializationResolve) {
              initializationResolve(undefined);
              initializationResolve = null;
              initializationReject = null;
              initializationPromise = Promise.resolve(undefined);
            }
          }
        } else {
          store.send({
            type: "setState",
            identity: undefined,
            status: "idle" as const,
            error: undefined,
          });

          if (initializationResolve) {
            initializationResolve(undefined);
            initializationResolve = null;
            initializationReject = null;
            initializationPromise = Promise.resolve(undefined);
          }
        }
      } catch (error) {
        console.error("Identity initialization error:", error);
        const err = error instanceof Error ? error : new Error("Initialization failed");
        store.send({
          type: "setState",
          status: "error" as const,
          error: err,
        });

        if (initializationReject) {
          initializationReject(err);
          initializationResolve = null;
          initializationReject = null;
          initializationPromise = Promise.reject(err);
        }
      }
    })();

    return () => {
      if (initializationReject) {
        const cancelErr = new Error("Initialization cancelled");
        initializationReject(cancelErr);
        initializationResolve = null;
        initializationReject = null;
        initializationPromise = Promise.reject(cancelErr);
      }
    };
  }, []);

  return children;
}
