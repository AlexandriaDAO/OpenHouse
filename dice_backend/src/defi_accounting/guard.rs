use candid::Principal;
use std::collections::BTreeSet;
use std::cell::RefCell;

thread_local! {
    static PENDING_OPERATIONS: RefCell<BTreeSet<Principal>> = RefCell::new(BTreeSet::new());
}

pub struct CallerGuard {
    principal: Principal,
}

impl CallerGuard {
    pub fn new() -> Result<Self, String> {
        let caller = ic_cdk::caller();

        PENDING_OPERATIONS.with(|ops| {
            let mut pending = ops.borrow_mut();
            if pending.contains(&caller) {
                return Err(format!(
                    "Operation already in progress for principal {}. Please wait.",
                    caller.to_string()
                ));
            }
            pending.insert(caller);
            Ok(Self { principal: caller })
        })
    }
}

impl Drop for CallerGuard {
    fn drop(&mut self) {
        PENDING_OPERATIONS.with(|ops| {
            ops.borrow_mut().remove(&self.principal);
        });
    }
}

// Helper for checking without acquiring guard
pub fn is_operation_pending(principal: Principal) -> bool {
    PENDING_OPERATIONS.with(|ops| ops.borrow().contains(&principal))
}
