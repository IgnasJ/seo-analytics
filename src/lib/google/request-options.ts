// Per-request options shared by every googleapis call.
//
// googleapis (gaxios) applies no timeout by default. A request that never
// answers would leave its domain's sync promise pending forever, and because
// syncDomain de-duplicates on the in-flight promise, every later "Sync" click
// for that domain would silently join the stuck one until the server restarts.
export const GOOGLE_REQUEST_TIMEOUT_MS = 30_000

export const GOOGLE_REQUEST_OPTIONS = { timeout: GOOGLE_REQUEST_TIMEOUT_MS } as const
