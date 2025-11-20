use candid::Principal;
use ic_stable_structures::{StableCell, memory_manager::VirtualMemory, DefaultMemoryImpl, Storable};
use serde::{Deserialize, Serialize};
use std::borrow::Cow;
use std::cell::RefCell;

const CONFIG_MEMORY_ID: u8 = 30;

/// Configuration settings that can be upgraded
#[derive(Clone, CandidType, Deserialize, Serialize)]
pub struct Config {
    pub parent_staker_canister: Principal,
    pub admin_principal: Option<Principal>,
}

use candid::CandidType;

impl Storable for Config {
    fn to_bytes(&self) -> Cow<[u8]> {
        Cow::Owned(candid::encode_one(self).expect("Failed to encode Config"))
    }

    fn from_bytes(bytes: Cow<[u8]>) -> Self {
        candid::decode_one(&bytes).expect("Failed to decode Config")
    }

    const BOUND: ic_stable_structures::storable::Bound =
        ic_stable_structures::storable::Bound::Bounded {
            max_size: 200,
            is_fixed_size: false,
        };
}

impl Default for Config {
    fn default() -> Self {
        Self {
            parent_staker_canister: Principal::from_text("e454q-riaaa-aaaap-qqcyq-cai")
                .expect("Invalid default parent canister ID"),
            admin_principal: None,
        }
    }
}

thread_local! {
    static CONFIG: RefCell<StableCell<Config, VirtualMemory<DefaultMemoryImpl>>> = {
        RefCell::new(
            StableCell::init(
                crate::MEMORY_MANAGER.with(|m| m.borrow().get(ic_stable_structures::memory_manager::MemoryId::new(CONFIG_MEMORY_ID))),
                Config::default()
            ).expect("Failed to init config")
        )
    };
}

/// Get the current parent staker canister principal
pub fn get_parent_canister() -> Principal {
    CONFIG.with(|c| c.borrow().get().parent_staker_canister.clone())
}

/// Get the current admin principal (if set)
pub fn get_admin_principal() -> Option<Principal> {
    CONFIG.with(|c| c.borrow().get().admin_principal.clone())
}

/// Check if caller is admin
pub fn is_admin(caller: Principal) -> bool {
    CONFIG.with(|c| {
        let config = c.borrow().get().clone();
        config.admin_principal.map_or(false, |admin| admin == caller)
    })
}

/// Update parent staker canister (admin only)
/// Returns error if caller is not admin
pub fn update_parent_canister(new_parent: Principal) -> Result<(), String> {
    let caller = ic_cdk::caller();
    
    if !is_admin(caller) {
        return Err("Unauthorized: Only admin can update parent canister".to_string());
    }

    CONFIG.with(|c| {
        let mut config = c.borrow().get().clone();
        config.parent_staker_canister = new_parent;
        c.borrow_mut().set(config).expect("Failed to update config");
    });

    ic_cdk::println!("Parent canister updated to: {}", new_parent);
    Ok(())
}

/// Set admin principal (can only be called by current admin or if no admin is set)
/// First call sets the admin, subsequent calls require admin authorization
pub fn set_admin(new_admin: Principal) -> Result<(), String> {
    let caller = ic_cdk::caller();

    let result = CONFIG.with(|c| {
        let mut config = c.borrow().get().clone();

        // If admin is already set, check authorization
        if let Some(current_admin) = config.admin_principal {
            if caller != current_admin {
                return Err("Unauthorized: Only current admin can change admin".to_string());
            }
        }

        config.admin_principal = Some(new_admin);
        c.borrow_mut().set(config).expect("Failed to update config");
        Ok(())
    });

    if result.is_ok() {
        ic_cdk::println!("Admin principal set to: {}", new_admin);
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_config() {
        let config = Config::default();
        assert!(config.admin_principal.is_none());
    }
}
