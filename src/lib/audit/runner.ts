import { getDb } from "@/lib/db"
import {
  getAudit,
  setAuditError,
  setAuditResult,
  setAuditStatus,
} from "@/lib/db/queries/audits"
import { fetchPSI } from "./psi"
import { transformPsi } from "./transform"

/**
 * Execute a queued audit: mark it running, fetch PSI, transform, persist
 * result. Errors are caught and recorded on the audit row instead of
 * thrown - this function is invoked by the queue and never awaited by the
 * caller, so a bare reject would surface only as an unhandled rejection.
 */
export async function runAudit(auditId: number): Promise<void> {
  const db = getDb()
  const audit = getAudit(db, auditId)
  if (!audit) return

  setAuditStatus(db, auditId, "running")
  try {
    const apiKey = process.env.PSI_API_KEY ?? ""
    const raw = await fetchPSI(audit.url, apiKey, "mobile")
    const result = transformPsi(raw)
    setAuditResult(db, auditId, result)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`Audit ${auditId} failed:`, err)
    setAuditError(db, auditId, message)
  }
}
