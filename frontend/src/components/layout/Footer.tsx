export function Footer({ variant = "app" }: { variant?: "app" | "dark" }) {
  return (
    <footer
      className={
        variant === "dark"
          ? "py-4 text-center text-xs text-white/20"
          : "py-4 text-center text-xs text-navy/30 dark:text-white/20"
      }
    >
      Designed and developed by Kuna Pranav Sai · © {new Date().getFullYear()} Penny Pilot
    </footer>
  );
}
