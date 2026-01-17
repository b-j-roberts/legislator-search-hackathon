use std::path::{Path, PathBuf};

fn main() {
    // path to Swift library - relative to workspace root
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let Some(workspace_root) = manifest_dir.parent().and_then(Path::parent) else {
        panic!("could not determine workspace root from manifest directory");
    };
    let swift_lib_dir = workspace_root.join("swift/PolSearchSwift/.build/release");

    println!("cargo::rerun-if-changed=build.rs");

    // set rpath so the binary can find the dylib at runtime
    println!(
        "cargo::rustc-link-arg=-Wl,-rpath,{}",
        swift_lib_dir.display()
    );
}
