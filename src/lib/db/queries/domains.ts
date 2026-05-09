import type { Database } from "../driver"

export interface Domain {
  id: number
  hostname: string
  ga4_property_id: string | null
  gsc_site_url: string | null
  created_at: number
}

export function listDomains(db: Database): Domain[] {
  return db.query<Domain, []>("SELECT * FROM domains ORDER BY created_at DESC").all()
}

export function getDomain(db: Database, id: number): Domain | null {
  return db.query<Domain, [number]>("SELECT * FROM domains WHERE id = ?").get(id)
}

export function addDomain(db: Database, hostname: string): Domain {
  db.run("INSERT INTO domains (hostname) VALUES (?)", [hostname])
  return db.query<Domain, [string]>("SELECT * FROM domains WHERE hostname = ?").get(hostname)!
}

export function updateDomainProperties(
  db: Database,
  id: number,
  ga4PropertyId: string | null,
  gscSiteUrl: string | null
): void {
  db.run(
    "UPDATE domains SET ga4_property_id = ?, gsc_site_url = ? WHERE id = ?",
    [ga4PropertyId, gscSiteUrl, id]
  )
}

export function deleteDomain(db: Database, id: number): void {
  db.run("DELETE FROM domains WHERE id = ?", [id])
}
