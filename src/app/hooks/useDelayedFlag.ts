import { useEffect, useState } from "react";

/**
 * True once `flag` has stayed true for `delay` ms. For loading skeletons: a
 * load that finishes quickly never shows one, so the content just arrives
 * instead of a skeleton flashing up and being swapped straight out.
 */
export function useDelayedFlag(flag: boolean, delay = 200): boolean {
  const [elapsed, setElapsed] = useState(false);

  useEffect(() => {
    if (!flag) return;
    const timer = window.setTimeout(() => setElapsed(true), delay);
    return () => {
      window.clearTimeout(timer);
      setElapsed(false);
    };
  }, [flag, delay]);

  return flag && elapsed;
}
