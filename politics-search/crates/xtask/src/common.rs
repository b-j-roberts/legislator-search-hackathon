use colored::Colorize;

/// Print a success message with a green checkmark
pub fn print_success(message: &str) {
    println!("{} {}", "✓".green(), message);
}
