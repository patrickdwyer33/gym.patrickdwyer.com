import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || join(__dirname, 'gym.db');

// Create database connection
const db = new Database(dbPath);
db.pragma('journal_mode = WAL'); // Write-Ahead Logging for better concurrency

// Initialize schema
const schemaPath = join(__dirname, 'schema.sql');
const schema = fs.readFileSync(schemaPath, 'utf8');
db.exec(schema);

// Helper function to get all rows
export function getAll(query, params = []) {
  return db.prepare(query).all(params);
}

// Helper function to get one row
export function getOne(query, params = []) {
  return db.prepare(query).get(params);
}

// Helper function to run a query (insert, update, delete)
export function run(query, params = []) {
  return db.prepare(query).run(params);
}

// Helper function for transactions
export function transaction(fn) {
  return db.transaction(fn);
}

export default db;
