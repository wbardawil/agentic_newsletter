"use client";

/**
 * Light/dark toggle — flips [data-theme] on <html> and persists the choice.
 * Mirrors the ◐ toggle on the newsletter edition previews so the whole
 * product switches themes the same way.
 */
export function ThemeToggle({ label = "Toggle theme" }: { label?: string }) {
  function toggle() {
    const root = document.documentElement;
    const current = root.getAttribute("data-theme");
    let next: "light" | "dark";
    if (current === "light" || current === "dark") {
      next = current === "light" ? "dark" : "light";
    } else {
      next = window.matchMedia("(prefers-color-scheme: light)").matches ? "dark" : "light";
    }
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("wb-theme", next);
    } catch {
      // Private mode — the toggle still works for this page view.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      title={label}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-[var(--color-line)] text-base leading-none text-[var(--color-fg-muted)] hover:border-[var(--color-cta)] hover:text-[var(--color-cta)] cursor-pointer"
    >
      ◐
    </button>
  );
}
