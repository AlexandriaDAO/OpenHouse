use candid::Principal;
use std::cell::RefCell;
use std::collections::BTreeSet;

thread_local! {
    static PENDING_OPERATIONS: RefCell<BTreeSet<Principal>> = RefCell::new(BTreeSet::new());
}

/// Guard to prevent concurrent operations from the same caller
/// Uses RAII pattern to automatically cleanup on drop
pub struct OperationGuard {
    caller: Principal,
}

impl OperationGuard {
    /// Create a new guard for the current caller
    /// Returns error if caller already has a pending operation
    pub fn new() -> Result<Self, String> {
        let caller = ic_cdk::caller();

        PENDING_OPERATIONS.with(|ops| {
            let mut ops = ops.borrow_mut();
            if ops.contains(&caller) {
                return Err("Operation already in progress for this caller".to_string());
            }
            ops.insert(caller);
            Ok(Self { caller })
        })
    }
}

impl Drop for OperationGuard {
    fn drop(&mut self) {
        PENDING_OPERATIONS.with(|ops| {
            ops.borrow_mut().remove(&self.caller);
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_guard_prevents_concurrent_operations() {
        // First guard should succeed
        let _guard1 = OperationGuard::new();
        assert!(_guard1.is_ok());

        // Second guard from same caller should fail
        let guard2 = OperationGuard::new();
        assert!(guard2.is_err());
        assert!(guard2.unwrap_err().contains("already in progress"));
    }

    #[test]
    fn test_guard_cleanup_on_drop() {
        {
            let _guard = OperationGuard::new().unwrap();
            // Guard is active here
        } // Guard dropped here

        // Should be able to create new guard after drop
        let guard2 = OperationGuard::new();
        assert!(guard2.is_ok());
    }
}
