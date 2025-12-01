import type { Identity } from "@dfinity/agent";
import { store } from ".";
import type { Status } from "../types";

export function setIdentity(identity: Identity): void {
  store.send({
    type: "setState",
    identity,
    status: "success" as Status,
    error: undefined,
  });
}

export function setError(error: Error | string): void {
  store.send({
    type: "setState",
    status: "error" as Status,
    error: error instanceof Error ? error : new Error(error),
  });
}

export function setStatus(status: Status): void {
  store.send({
    type: "setState",
    status,
  });
}
