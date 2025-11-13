// Minimal ICP Ledger IDL Factory (ICRC-1 methods)
export const ledgerIdlFactory = ({ IDL }: any) => {
  const Account = IDL.Record({
    owner: IDL.Principal,
    subaccount: IDL.Opt(IDL.Vec(IDL.Nat8)),
  });

  const Tokens = IDL.Record({
    e8s: IDL.Nat64,
  });

  return IDL.Service({
    // ICRC-1 standard
    icrc1_balance_of: IDL.Func([Account], [IDL.Nat], ['query']),

    // Legacy method
    account_balance: IDL.Func(
      [IDL.Record({ account: IDL.Vec(IDL.Nat8) })],
      [Tokens],
      ['query']
    ),
  });
};
