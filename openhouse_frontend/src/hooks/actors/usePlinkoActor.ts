import { createActorHook } from 'ic-use-actor';
import { _SERVICE } from '@declarations/plinko_backend/plinko_backend.did';
import { idlFactory } from '@declarations/plinko_backend/plinko_backend.did.js';

// Hardcoded canister ID from dfx.json
const canisterId = 'weupr-2qaaa-aaaap-abl3q-cai';

const usePlinkoActor = createActorHook<_SERVICE>({
  canisterId,
  idlFactory,
  httpAgentOptions: {
    verifyQuerySignatures: false,
  },
});

export default usePlinkoActor;
