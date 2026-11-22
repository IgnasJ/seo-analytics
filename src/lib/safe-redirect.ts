// Guards for "bounce back to where you came from" redirects (`?next=` on the
// login page). The value arrives in the URL, so it is attacker-controlled:
// passed to `window.location.href` unchecked, `javascript:...` runs script in
// our origin and `https://evil.example` is an open redirect.

const PLACEHOLDER_ORIGIN = "http://internal.invalid"

/**
 * Returns `raw` when it is a same-origin path (`/audit?view=flat`), otherwise
 * `fallback`. Resolving against a placeholder origin lets the URL parser do
 * the normalisation browsers do — so `//evil.example`, `/\evil.example` and
 * tab/newline tricks are all recognised as leaving the origin.
 */
export function safeNextPath(raw: string | null | undefined, fallback = "/"): string {
  if (!raw || !raw.startsWith("/")) return fallback
  try {
    const resolved = new URL(raw, PLACEHOLDER_ORIGIN)
    if (resolved.origin !== PLACEHOLDER_ORIGIN) return fallback
    return resolved.pathname + resolved.search + resolved.hash
  } catch {
    return fallback
  }
}
