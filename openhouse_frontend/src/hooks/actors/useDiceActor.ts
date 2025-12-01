import { createActorHook } from 'ic-use-actor';
import { _SERVICE } from '@declarations/dice_backend/dice_backend.did';
import { idlFactory } from '@declarations/dice_backend/dice_backend.did.js';

// Hardcoded canister ID from dfx.json
const canisterId = 'whchi-hyaaa-aaaao-a4ruq-cai';

const useDiceActor = createActorHook<_SERVICE>({
  canisterId,
  idlFactory,
  httpAgentOptions: {
    verifyQuerySignatures: false,
  },
});

export default useDiceActor;
