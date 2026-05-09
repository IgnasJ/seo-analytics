// Single-slot in-process queue. PSI's QPS limits make running audits in
// parallel risky; this serialises every audit through one chain so we never
// have more than one outbound request to PSI at a time. Module-level state
// persists for the lifetime of the Node process.

let chain: Promise<void> = Promise.resolve()

/**
 * Append a job to the queue. The job runs after every previously enqueued
 * job has settled (success or failure). Returns immediately - callers do not
 * await; status is observed via the audits table.
 */
export function enqueue(job: () => Promise<void>): void {
  chain = chain.then(job).catch(() => {
    /* swallow - the job is responsible for recording its own failure */
  })
}

/**
 * Test helper: returns the current chain so tests can await all queued jobs.
 */
export function _flushForTest(): Promise<void> {
  return chain
}
