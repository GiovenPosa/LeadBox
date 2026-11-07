import { useEffect, useRef } from "react";

/**
 * For panels and dialogs: remembers what had focus when `open` became true,
 * and puts focus back there when it closes (the usual dialog behaviour).
 * Pair it with `inert` on the closed panel, which moves focus out of it.
 */
export function useRestoreFocus(open: boolean) {
  const openerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      openerRef.current = document.activeElement as HTMLElement | null;
      return;
    }
    const opener = openerRef.current;
    openerRef.current = null;
    // only if it's still on the page and not inside something that's now closed
    if (opener && opener.isConnected && !opener.closest("[inert]")) {
      opener.focus({ preventScroll: true });
    }
  }, [open]);
}
