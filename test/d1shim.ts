// D1 shim untuk test: membungkus better-sqlite3 dengan API D1Database yang
// dipakai worker (prepare/bind/first/all/run + exec). SQL dieksekusi sungguhan.

import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Row = Record<string, unknown>;

class ShimStatement {
  constructor(
    private db: Database.Database,
    private sql: string,
    private params: unknown[] = []
  ) {}

  bind(...params: unknown[]): ShimStatement {
    // better-sqlite3 menolak boolean/undefined — samakan dengan D1.
    const norm = params.map((p) =>
      p === undefined ? null : typeof p === 'boolean' ? (p ? 1 : 0) : p
    );
    return new ShimStatement(this.db, this.sql, norm);
  }

  async first<T = Row>(): Promise<T | null> {
    const row = this.db.prepare(this.sql).get(...this.params) as T | undefined;
    return row ?? null;
  }

  async all<T = Row>(): Promise<{ results: T[]; success: boolean; meta: Record<string, unknown> }> {
    const results = this.db.prepare(this.sql).all(...this.params) as T[];
    return { results, success: true, meta: {} };
  }

  async run(): Promise<{ success: boolean; meta: { changes: number; last_row_id: number } }> {
    const info = this.db.prepare(this.sql).run(...this.params);
    return {
      success: true,
      meta: { changes: info.changes, last_row_id: Number(info.lastInsertRowid) },
    };
  }
}

export class D1Shim {
  db: Database.Database;

  constructor() {
    this.db = new Database(':memory:');
  }

  prepare(sql: string): ShimStatement {
    return new ShimStatement(this.db, sql);
  }

  async exec(sql: string): Promise<void> {
    this.db.exec(sql);
  }

  async batch(statements: ShimStatement[]): Promise<unknown[]> {
    const out: unknown[] = [];
    for (const s of statements) out.push(await s.run());
    return out;
  }
}

/** Buat DB in-memory dengan skema migrasi asli. */
export function makeTestDb(): D1Shim {
  const shim = new D1Shim();
  const sql = readFileSync(join(__dirname, '..', 'migrations', '0001_init.sql'), 'utf8');
  shim.db.exec(sql);
  return shim;
}
