import { describe, it, expect, beforeEach } from "vitest"
import { Database } from "../driver"
import { SCHEMA_SQL } from "../schema"
import { runMigrations } from "../index"
import {
  createGuide,
  createGuideSteps,
  getActiveGuide,
  supersedeActiveGuide,
  getPreviousGuide,
  toggleGuideStep,
  deleteGuide,
  type NewGuide,
  type NewStep,
} from "../queries/guides"

function makeDb(): Database {
  const db = new Database(":memory:")
  db.run("PRAGMA foreign_keys=ON")
  db.exec(SCHEMA_SQL)
  runMigrations(db)
  db.run("INSERT INTO domains (hostname) VALUES ('example.com')")
  return db
}

describe("createGuide + getActiveGuide", () => {
  it("creates a guide and retrieves it as active", () => {
    const db = makeDb()
    const g = createGuide(db, {
      domainId: 1, url: "https://example.com/page", query: "test query",
      model: "claude-sonnet-4-6", rawMarkdown: "## OPTIMIZE THIS PAGE\n1. Do X | Forecast: +5%",
    })
    expect(g.id).toBeGreaterThan(0)
    expect(g.superseded_at).toBeNull()

    const active = getActiveGuide(db, 1, "https://example.com/page", "test query")
    expect(active?.id).toBe(g.id)
  })
})

describe("supersedeActiveGuide", () => {
  it("marks the current guide superseded and a new one becomes active", () => {
    const db = makeDb()
    const g1 = createGuide(db, {
      domainId: 1, url: "https://example.com/page", query: "test query",
      model: "claude-sonnet-4-6", rawMarkdown: "old",
    })
    supersedeActiveGuide(db, 1, "https://example.com/page", "test query")
    const g2 = createGuide(db, {
      domainId: 1, url: "https://example.com/page", query: "test query",
      model: "claude-sonnet-4-6", rawMarkdown: "new",
    })

    const active = getActiveGuide(db, 1, "https://example.com/page", "test query")
    expect(active?.id).toBe(g2.id)

    const prev = getPreviousGuide(db, 1, "https://example.com/page", "test query")
    expect(prev?.id).toBe(g1.id)
    expect(prev?.superseded_at).not.toBeNull()
  })
})

describe("createGuideSteps + toggleGuideStep", () => {
  it("inserts steps and toggles done state", () => {
    const db = makeDb()
    const g = createGuide(db, {
      domainId: 1, url: "https://example.com/page", query: "q",
      model: "m", rawMarkdown: "",
    })
    createGuideSteps(db, g.id, [
      { position: 1, section: "optimize", text: "Step one", forecast: "LCP -1s" },
      { position: 2, section: "new_page", text: "Create article", forecast: "+200 clicks" },
    ])

    const guide = getActiveGuide(db, 1, "https://example.com/page", "q")
    expect(guide?.steps).toHaveLength(2)
    expect(guide?.steps[0].done).toBe(0)

    toggleGuideStep(db, guide!.steps[0].id, true)
    const updated = getActiveGuide(db, 1, "https://example.com/page", "q")
    expect(updated?.steps[0].done).toBe(1)
    expect(updated?.steps[0].done_at).not.toBeNull()

    toggleGuideStep(db, guide!.steps[0].id, false)
    const reverted = getActiveGuide(db, 1, "https://example.com/page", "q")
    expect(reverted?.steps[0].done).toBe(0)
    expect(reverted?.steps[0].done_at).toBeNull()
  })
})

describe("deleteGuide", () => {
  it("removes guide and cascades to steps", () => {
    const db = makeDb()
    const g = createGuide(db, {
      domainId: 1, url: "https://example.com/page", query: "q",
      model: "m", rawMarkdown: "",
    })
    createGuideSteps(db, g.id, [
      { position: 1, section: "optimize", text: "s", forecast: null },
    ])
    deleteGuide(db, g.id)
    expect(getActiveGuide(db, 1, "https://example.com/page", "q")).toBeNull()
    const steps = db
      .query<{ id: number }, [number]>("SELECT id FROM guide_steps WHERE guide_id = ?")
      .all(g.id)
    expect(steps).toHaveLength(0)
  })
})
