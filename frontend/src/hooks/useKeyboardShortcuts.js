import { useEffect } from "react";

/**
 * Register keyboard shortcuts. Each entry: { key, handler, meta? }
 * Skips when focus is inside inputs/textareas/contenteditable.
 */
export function useKeyboardShortcuts(bindings, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const isEditable = (el) => {
      if (!el) return false;
      const tag = el.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if (el.isContentEditable) return true;
      return false;
    };
    const onKey = (e) => {
      if (isEditable(document.activeElement)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      for (const b of bindings) {
        if (b.key.toLowerCase() === key) {
          e.preventDefault();
          b.handler(e);
          return;
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bindings, enabled]);
}
