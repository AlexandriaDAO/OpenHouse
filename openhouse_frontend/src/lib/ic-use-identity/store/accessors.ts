import type { Identity } from "@dfinity/agent";
import { DelegationIdentity, isDelegationValid } from "@dfinity/identity";
import { store } from ".";

/**
 * Get the current identity if authenticated.
 * This can be used outside of React components.
 */
export function getIdentity(): Identity | undefined {
  return store.getSnapshot().context.identity;
}

/**
 * Check if the user is currently authenticated.
 * This can be used outside of React components.
 */
export function isAuthenticated(): boolean {
  const context = store.getSnapshot().context;
  const identity = context.identity;

  if (!identity || identity.getPrincipal().isAnonymous()) return false;

  if (
    identity instanceof DelegationIdentity &&
    isDelegationValid(identity.getDelegation())
  ) {
    return true;
  }

  return false;
}
