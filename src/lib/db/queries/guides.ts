import type { Database } from "../driver"

export interface GuideRow {
  id: number
  domain_id: number
  url: string
  query: string
  model: string
  raw_markdown: string
  generated_at: number
  superseded_at: number | null
}

export interface GuideStepRow {
  id: number
  guide_id: number
  position: number
  section: "optimize" | "new_page"
  text: string
  forecast: string | null
  done: number
  done_at: number | null
}

export interface GuideWithSteps extends GuideRow {
  steps: GuideStepRow[]
}

export interface NewGuide {
  domainId: number
  url: string
  query: string
  model: string
  rawMarkdown: string
}

export interface NewStep {
  position: number
  section: "optimize" | "new_page"
  text: string
  forecast: string | null
}

export function createGuide(db: Database, g: NewGuide): GuideRow {
  db.run(
    `INSERT INTO guides (domain_id, url, query, model, raw_markdown)
     VALUES (?, ?, ?, ?, ?)`,
    [g.domainId, g.url, g.query, g.model, g.rawMarkdown]
  )
  return db
    .query<GuideRow, []>("SELECT * FROM guides ORDER BY id DESC LIMIT 1")
    .get()!
}

export function createGuideSteps(db: Database, guideId: number, steps: NewStep[]): void {
  for (const s of steps) {
    db.run(
      `INSERT INTO guide_steps (guide_id, position, section, text, forecast)
       VALUES (?, ?, ?, ?, ?)`,
      [guideId, s.position, s.section, s.text, s.forecast ?? null]
    )
  }
}

export function getActiveGuide(
  db: Database,
  domainId: number,
  url: string,
  query: string
): GuideWithSteps | null {
  const guide = db
    .query<GuideRow, [number, string, string]>(
      `SELECT * FROM guides
       WHERE domain_id = ? AND url = ? AND query = ? AND superseded_at IS NULL
       ORDER BY generated_at DESC LIMIT 1`
    )
    .get(domainId, url, query)
  if (!guide) return null
  const steps = db
    .query<GuideStepRow, [number]>(
      "SELECT * FROM guide_steps WHERE guide_id = ? ORDER BY position"
    )
    .all(guide.id)
  return { ...guide, steps }
}

export function getPreviousGuide(
  db: Database,
  domainId: number,
  url: string,
  query: string
): GuideWithSteps | null {
  const guide = db
    .query<GuideRow, [number, string, string]>(
      `SELECT * FROM guides
       WHERE domain_id = ? AND url = ? AND query = ? AND superseded_at IS NOT NULL
       ORDER BY superseded_at DESC LIMIT 1`
    )
    .get(domainId, url, query)
  if (!guide) return null
  const steps = db
    .query<GuideStepRow, [number]>(
      "SELECT * FROM guide_steps WHERE guide_id = ? ORDER BY position"
    )
    .all(guide.id)
  return { ...guide, steps }
}

export function supersedeActiveGuide(
  db: Database,
  domainId: number,
  url: string,
  query: string
): void {
  db.run(
    `UPDATE guides SET superseded_at = unixepoch()
     WHERE domain_id = ? AND url = ? AND query = ? AND superseded_at IS NULL`,
    [domainId, url, query]
  )
}

export function toggleGuideStep(db: Database, stepId: number, done: boolean): void {
  if (done) {
    db.run(
      "UPDATE guide_steps SET done = 1, done_at = unixepoch() WHERE id = ?",
      [stepId]
    )
  } else {
    db.run(
      "UPDATE guide_steps SET done = 0, done_at = NULL WHERE id = ?",
      [stepId]
    )
  }
}

export function deleteGuide(db: Database, id: number): void {
  db.run("DELETE FROM guides WHERE id = ?", [id])
}
