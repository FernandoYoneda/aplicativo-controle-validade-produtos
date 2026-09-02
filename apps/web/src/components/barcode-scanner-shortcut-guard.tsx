"use client";

import { useEffect } from "react";

export function BarcodeScannerShortcutGuard() {
  useEffect(() => {
    function preventScannerLineFeedShortcut(event: KeyboardEvent) {
      const isScannerLineFeed =
        event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        !event.shiftKey &&
        (event.key.toLowerCase() === "j" || event.code === "KeyJ");

      if (isScannerLineFeed) {
        event.preventDefault();
      }
    }

    window.addEventListener("keydown", preventScannerLineFeedShortcut, true);
    return () =>
      window.removeEventListener(
        "keydown",
        preventScannerLineFeedShortcut,
        true,
      );
  }, []);

  return null;
}
