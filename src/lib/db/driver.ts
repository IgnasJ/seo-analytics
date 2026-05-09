// Thin compat layer over better-sqlite3 that mimics the subset of the
// `bun:sqlite` API used in this codebase. Necessary because Next.js's
// `next dev` runs route handlers via Node-compatible `require`, which can't
// resolve the `bun:` scheme even when the parent process is launched with Bun.

import BetterSqlite from "better-sqlite3"

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
  private readonly inner: BetterSqlite.Database

  constructor(path: string, _opts?: { create?: boolean }) {
    this.inner = new BetterSqlite(path)
  }

  /** Execute a parameterised statement once. Mirrors bun:sqlite's `db.run`. */
  run(sql: string, params: Params = []): RunResult {
    const result = this.inner.prepare(sql).run(...(params as never[]))
    return {
      changes: result.changes,
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
    const stmt = this.inner.prepare(sql)
    return {
      all: (...params: Params) => stmt.all(...(params as never[])) as T[],
      get: (...params: Params) => {
        const row = stmt.get(...(params as never[])) as T | undefined
        return row ?? null
      },
      run: (...params: Params) => {
        const result = stmt.run(...(params as never[]))
        return {
          changes: result.changes,
          lastInsertRowid: result.lastInsertRowid,
        }
      },
    }
  }

  close(): void {
    this.inner.close()
  }
}
