import { createActorHook } from 'ic-use-actor';
import { _SERVICE } from '@declarations/mines_backend/mines_backend.did';
import { idlFactory } from '@declarations/mines_backend/mines_backend.did.js';

// Hardcoded canister ID from dfx.json
const canisterId = 'wvrcw-3aaaa-aaaah-arm4a-cai';

const useMinesActor = createActorHook<_SERVICE>({
  canisterId,
  idlFactory,
});

export default useMinesActor;
