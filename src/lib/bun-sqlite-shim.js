// Shim for bun:sqlite used during Next.js build-time analysis in Node.js workers.
// At runtime, Bun provides the real bun:sqlite module.
module.exports = {}
module.exports.Database = class Database {
  constructor() {}
  run() {}
  exec() {}
  query() { return { all: () => [], get: () => null, run: () => {} } }
  close() {}
}
