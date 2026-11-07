import { useEffect, useState } from "react";

export type AnimatedState = "idle" | "entering" | "leaving";

/**
 * A list that can animate items in and out. New items come back marked
 * "entering"; removed items stay in the list, marked "leaving", for `duration`
 * ms so they can animate out, then drop. What's there on the first render isn't
 * animated (the page's own entrance covers that).
 */
export function useAnimatedList<T extends { id: string }>(
  items: T[],
  order: (a: T, b: T) => number,
  duration = 260
): { item: T; state: AnimatedState }[] {
  const [shown, setShown] = useState(() => items.map((item) => ({ item, state: "idle" as AnimatedState })));
  const [prevItems, setPrevItems] = useState(items);

  // The items changed: mark what's new, and keep what's gone for its exit
  if (items !== prevItems) {
    setPrevItems(items);
    const current = new Set(items.map((i) => i.id));
    const before = new Map(shown.map((s) => [s.item.id, s.state]));
    const next = [
      ...items.map((item) => ({
        item,
        state: (!before.has(item.id) || before.get(item.id) === "leaving" ? "entering" : before.get(item.id)) as AnimatedState,
      })),
      ...shown.filter((s) => !current.has(s.item.id)).map((s) => ({ ...s, state: "leaving" as AnimatedState })),
    ];
    setShown(next.sort((a, b) => order(a.item, b.item)));
  }

  // Drop items once they've animated out
  useEffect(() => {
    if (!shown.some((s) => s.state === "leaving")) return;
    const timer = window.setTimeout(() => setShown((list) => list.filter((s) => s.state !== "leaving")), duration);
    return () => window.clearTimeout(timer);
  }, [shown, duration]);

  return shown;
}
