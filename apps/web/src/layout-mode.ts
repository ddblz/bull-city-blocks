import { useSyncExternalStore } from "react";

/**
 * The phone layout (#79): a narrow screen, or a phone on its side (short and not wide). The same
 * rule is in table.css, in every `@media` that starts the phone layout.
 */
export const PHONE_QUERY =
  "(max-width: 639px), (max-height: 500px) and (max-width: 950px) and (orientation: landscape)";

/** The query as a function of the viewport, for tests. */
export const isPhone = (width: number, height: number) =>
  width < 640 || (height <= 500 && width <= 950 && width > height);

export function usePhone(): boolean {
  return useSyncExternalStore(
    (notify) => {
      const query = matchMedia(PHONE_QUERY);
      query.addEventListener("change", notify);
      return () => query.removeEventListener("change", notify);
    },
    () => matchMedia(PHONE_QUERY).matches,
    () => false,
  );
}
