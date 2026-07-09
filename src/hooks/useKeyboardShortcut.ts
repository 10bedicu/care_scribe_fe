import { useEffect, useRef } from "react";

/**
 * Drop-in replacement for the `use-keyboard-shortcut` package.
 *
 * - Listens on the document in the capture phase so it fires before any
 *   competing handler in the host application (e.g. care core).
 * - Skips events while focus is in an input/textarea/select or contenteditable
 *   element so typing isn't hijacked.
 * - Uses a ref for the callback so the latest closure is always invoked
 *   without needing to re-bind the listener on every render.
 */
export default function useKeyboardShortcut(
  keys: string[],
  callback: () => void,
) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const keysKey = keys.map((k) => k.toLowerCase()).join("+");

  useEffect(() => {
    const normalized = keysKey.split("+");
    const modifiers = new Set([
      "ctrl",
      "control",
      "meta",
      "cmd",
      "alt",
      "shift",
    ]);
    const requiredModifiers = normalized.filter((k) => modifiers.has(k));
    const requiredKeys = normalized.filter((k) => !modifiers.has(k));

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        target?.isContentEditable
      ) {
        return;
      }

      const modifierMatch =
        (requiredModifiers.includes("ctrl") ||
        requiredModifiers.includes("control")
          ? e.ctrlKey
          : !e.ctrlKey) &&
        (requiredModifiers.includes("meta") || requiredModifiers.includes("cmd")
          ? e.metaKey
          : !e.metaKey) &&
        (requiredModifiers.includes("alt") ? e.altKey : !e.altKey) &&
        (requiredModifiers.includes("shift") ? e.shiftKey : !e.shiftKey);

      if (!modifierMatch) return;

      const pressed = e.key.toLowerCase();
      if (requiredKeys.length === 1 && requiredKeys[0] === pressed) {
        e.preventDefault();
        callbackRef.current();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [keysKey]);
}
