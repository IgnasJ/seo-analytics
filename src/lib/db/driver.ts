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

export interface RunResult {
  changes: number
  lastInsertRowid: number | bigint
}

export interface Statement<T> {
  all(...params: Params): T[]
  get(...params: Params): T | null
  run(...params: Params): RunResult
}

export class Database {
  private readonly inner: DatabaseSync

  constructor(path: string, _opts?: { create?: boolean }) {
    // Match better-sqlite3's defaults: open read-write (creating the file when
    // absent) and leave foreign-key enforcement OFF until callers opt in via
    // `PRAGMA foreign_keys=ON`. node:sqlite would otherwise enable FKs on open,
    // which the migration code (it toggles them off mid-rebuild) and the tests
    // do not expect.
    this.inner = new DatabaseSync(path, { enableForeignKeyConstraints: false })
  }

  /** Execute a parameterised statement once. Mirrors bun:sqlite's `db.run`. */
  run(sql: string, params: Params = []): RunResult {
    const result = this.inner.prepare(sql).run(...(params as never[]))
    return {
      changes: Number(result.changes),
      lastInsertRowid: result.lastInsertRowid,
    }
  }

  /** Execute a multi-statement script (no parameters). */
  exec(sql: string): void {
    this.inner.exec(sql)
  }

  /**
   * Prepare a statement.
   *
   * The two type parameters mirror bun:sqlite (`<RowType, ParamsTuple>`); the
   * params tuple is unused at runtime, kept for source compatibility.
   */
  query<T = unknown, _P extends Params = Params>(sql: string): Statement<T> {
    const stmt: StatementSync = this.inner.prepare(sql)
    return {
      all: (...params: Params) => stmt.all(...(params as never[])) as T[],
      get: (...params: Params) => {
        const row = stmt.get(...(params as never[])) as T | undefined
        return row ?? null
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
    this.inner.close()
  }
}
