use candid::Principal;

fn main() {
    let p = Principal::from_text("cngnf-vqaaa-aaaar-qag4q-cai").unwrap();
    println!("{:?}", p.as_slice());
}