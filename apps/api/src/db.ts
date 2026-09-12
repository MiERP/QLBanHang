import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function findSqlPath(filename: string): string {
  const candidates = [
    path.resolve(__dirname, filename),
    path.resolve(__dirname, '../src', filename),
    path.resolve(process.cwd(), 'apps', 'api', 'src', filename),
    path.resolve(process.cwd(), 'src', filename),
  ];
  for (const cand of candidates) {
    if (fs.existsSync(cand)) return cand;
  }
  return candidates[0];
}

function getDbPath(): string {
  if (process.env.DB_PATH) return process.env.DB_PATH;
  // Luôn dùng chung một CSDL tại thư mục gốc dự án, bất kể chế độ chạy (dev / desktop).
  const repoRoot = path.resolve(__dirname, '..', '..', '..');
  if (fs.existsSync(path.join(repoRoot, 'package.json'))) {
    return path.join(repoRoot, 'qaromi_erp.db');
  }
  return path.resolve(process.cwd(), 'qaromi_erp.db');
}

let dbInstance: Database.Database | null = null;

export function getDb(): Database.Database {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  const isNew = !fs.existsSync(dbPath) || fs.statSync(dbPath).size === 0;
  dbInstance = new Database(dbPath);
  dbInstance.pragma('foreign_keys = ON');

  let hasTables = false;
  try {
    const tableCheck = dbInstance.prepare("SELECT count(*) as count FROM sqlite_master WHERE type='table' AND name='products'").get() as any;
    hasTables = Boolean(tableCheck && tableCheck.count > 0);
  } catch {
    hasTables = false;
  }

  if (isNew || !hasTables) {
    console.log('[API Database] Initializing SQLite database from schema.sql...');
    const schemaPath = findSqlPath('schema.sql');
    if (fs.existsSync(schemaPath)) {
      const schemaSql = fs.readFileSync(schemaPath, 'utf-8');
      dbInstance.exec(schemaSql);
      console.log('[API Database] Schema loaded successfully from:', schemaPath);
    } else {
      console.error('[API Database] ERROR: schema.sql not found!');
    }

    console.log('[API Database] Seeding initial data from seed.sql...');
    const seedPath = findSqlPath('seed.sql');
    if (fs.existsSync(seedPath)) {
      const seedSql = fs.readFileSync(seedPath, 'utf-8');
      dbInstance.exec(seedSql);
      console.log('[API Database] Seed data loaded successfully from:', seedPath);
    } else {
      console.error('[API Database] ERROR: seed.sql not found!');
    }
    console.log('[API Database] Database initialized and seeded successfully!');
  } else {
    console.log('[API Database] Connected to SQLite database at:', dbPath);
  }

  return dbInstance;
}
