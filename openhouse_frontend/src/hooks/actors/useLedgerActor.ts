import { createActorHook } from 'ic-use-actor';
import { ICPLedgerService } from '../../types/ledger';
import { ledgerIdlFactory } from '../../utils/ledgerIdl';

// ICP Ledger Canister ID (mainnet)
const ICP_LEDGER_CANISTER_ID = 'ryjl3-tyaaa-aaaaa-aaaba-cai';

const useLedgerActor = createActorHook<ICPLedgerService>({
  canisterId: ICP_LEDGER_CANISTER_ID,
  idlFactory: ledgerIdlFactory,
});

export default useLedgerActor;
