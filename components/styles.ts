/**
 * Class strings shared by server and client components. Kept out of ui.tsx
 * because that file is a client module, and a server component importing a
 * plain value from a client module receives a reference, not the string.
 */

/** An inline text link in the blue ink. */
export const LINK =
  'text-[var(--brand)] underline decoration-1 underline-offset-[3px] hover:text-[var(--ink)]';
