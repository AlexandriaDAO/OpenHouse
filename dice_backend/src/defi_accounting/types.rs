use candid::{CandidType, Deserialize, Principal, Nat};
use ic_stable_structures::Storable;
use std::borrow::Cow;
use ic_stable_structures::storable::Bound;

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct PendingWithdrawal {
    pub withdrawal_type: WithdrawalType,
    pub created_at: u64,        // Ledger idempotency key
    pub retries: u8,
    pub last_error: Option<String>,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum WithdrawalType {
    User { amount: u64 },
    LP { shares: Nat, reserve: Nat, amount: u64 },
}

impl Storable for PendingWithdrawal {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 1000, // Estimated max size
        is_fixed_size: false,
    };
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub struct AuditEntry {
    pub timestamp: u64,
    pub event: AuditEvent,
}

#[derive(CandidType, Deserialize, Clone, Debug)]
pub enum AuditEvent {
    WithdrawalInitiated { user: Principal, amount: u64 },
    WithdrawalCompleted { user: Principal, amount: u64 },
    WithdrawalFailed { user: Principal, amount: u64 },
    WithdrawalExpired { user: Principal, amount: u64 },
    BalanceRestored { user: Principal, amount: u64 },
    LPRestored { user: Principal, amount: u64 },
    SystemError { error: String },
}

impl Storable for AuditEntry {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).unwrap())
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).unwrap()
    }

    const BOUND: Bound = Bound::Bounded {
        max_size: 500,
        is_fixed_size: false,
    };
}
