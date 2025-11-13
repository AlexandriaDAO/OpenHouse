import { createActorHook } from 'ic-use-actor';
import { _SERVICE } from '@declarations/crash_backend/crash_backend.did';
import { idlFactory } from '@declarations/crash_backend/crash_backend.did.js';

// Hardcoded canister ID from dfx.json
const canisterId = 'fws6k-tyaaa-aaaap-qqc7q-cai';

const useCrashActor = createActorHook<_SERVICE>({
  canisterId,
  idlFactory,
});

export default useCrashActor;
