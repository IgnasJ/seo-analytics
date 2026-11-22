// Thin compat layer over Node's built-in `node:sqlite` that mimics the subset
// of the `bun:sqlite` API used in this codebase.
//
// History: this seam began over `bun:sqlite`, moved to `better-sqlite3` (a
// native addon), and now sits on `node:sqlite` — Node's built-in, dependency-
// free SQLite (available without a flag since Node 22.13). The native addon was
// dropped because the production host (CloudLinux 8: glibc 2.28, Python 3.6)
// could neither load better-sqlite3's prebuilt binary (it needs GLIBC_2.29) nor
// compile it from source (node-gyp's gyp requires Python 3.8+). `node:sqlite`
// has no build step, so none of that applies.

import { DatabaseSync, type StatementSync } from "node:sqlite"

type Params = unknown[]

/**
 * `node:sqlite` returns result rows with a **null prototype** (unlike
 * better-sqlite3, which this seam previously wrapped — it returned ordinary
 * `Object.prototype` rows). React Server Components refuse to serialise
 * null-prototype objects across the server→client boundary ("Only plain
 * objects … can be passed to Client Components … null prototypes are not
 * supported"), so passing a raw DB row as a prop to a `"use client"` component
 * throws at render time. Re-shape every row into a plain object so callers can
 * treat rows exactly as they did under better-sqlite3. The values are
 * primitives (string / number / null / bigint / Uint8Array) so a shallow copy
 * is sufficient. `null`/`undefined` (no row) passes through untouched.
 */
function toPlain<T>(row: T): T {
  return row && typeof row === "object" ? { ...row } : row
}

export interface RunResult {
  changes: number
  lastInsertRowid: number | bigint
}

export interface Statement<T> {
  all(...params: Params): T[]
  get(...params: Params): T | null
  run(...params: Params): RunResult
}

// Upper bound on cached prepared statements. Almost all SQL in this codebase is
// a fixed string, so the cache settles at a few dozen entries; the cap only
// guards against unbounded growth from dynamically composed WHERE clauses.
const MAX_CACHED_STATEMENTS = 200

// Statements that can change table shapes.
const DDL_PATTERN = /^\s*(ALTER|CREATE|DROP)\b/i

export class Database {
  private readonly inner: DatabaseSync
  // SQL text -> prepared statement. Without this every query re-parsed and
  // re-planned its SQL on each call (dozens of times per dashboard render).
  //
  // The cache is dropped whenever the schema may have changed (see exec / run):
  // a statement prepared before `ALTER TABLE ... ADD COLUMN` keeps reporting
  // its old column set for `SELECT *` under node:sqlite, so reusing it after a
  // migration would silently hide the new column.
  private readonly statements = new Map<string, StatementSync>()

  constructor(path: string, _opts?: { create?: boolean }) {
    // Match better-sqlite3's defaults: open read-write (creating the file when
    // absent) and leave foreign-key enforcement OFF until callers opt in via
    // `PRAGMA foreign_keys=ON`. node:sqlite would otherwise enable FKs on open,
    // which the migration code (it toggles them off mid-rebuild) and the tests
    // do not expect.
    this.inner = new DatabaseSync(path, { enableForeignKeyConstraints: false })
  }

  private prepare(sql: string): StatementSync {
    let stmt = this.statements.get(sql)
    if (!stmt) {
      if (this.statements.size >= MAX_CACHED_STATEMENTS) this.statements.clear()
      stmt = this.inner.prepare(sql)
      this.statements.set(sql, stmt)
    }
    return stmt
  }

  /** Execute a parameterised statement once. Mirrors bun:sqlite's `db.run`. */
  run(sql: string, params: Params = []): RunResult {
    // Schema-changing statements run once: don't cache them, and invalidate
    // everything prepared against the old schema.
    const isDdl = DDL_PATTERN.test(sql)
    const stmt = isDdl ? this.inner.prepare(sql) : this.prepare(sql)
    const result = stmt.run(...(params as never[]))
    if (isDdl) this.statements.clear()
    return {
      changes: Number(result.changes),
      lastInsertRowid: result.lastInsertRowid,
    }
  }

  /** Execute a multi-statement script (no parameters). */
  exec(sql: string): void {
    this.inner.exec(sql)
    // Scripts are how the schema and migrations are applied; assume any of
    // them may have changed table shapes.
    this.statements.clear()
  }

  /**
   * Prepare a statement.
   *
   * The two type parameters mirror bun:sqlite (`<RowType, ParamsTuple>`); the
   * params tuple is unused at runtime, kept for source compatibility.
   */
  query<T = unknown, _P extends Params = Params>(sql: string): Statement<T> {
    const stmt: StatementSync = this.prepare(sql)
    return {
      all: (...params: Params) =>
        (stmt.all(...(params as never[])) as T[]).map(toPlain),
      get: (...params: Params) => {
        const row = stmt.get(...(params as never[])) as T | undefined
        return row == null ? null : toPlain(row)
      },
      run: (...params: Params) => {
        const result = stmt.run(...(params as never[]))
        return {
          changes: Number(result.changes),
          lastInsertRowid: result.lastInsertRowid,
        }
      },
    }
  }

  close(): void {
    this.statements.clear()
    this.inner.close()
  }
}
