/**
 * Local SQLite database using SQL.js
 * Provides offline-first storage with sync capabilities
 */

const DB_NAME = 'gym-tracker-db';
const STORE_NAME = 'sqliteDB';

let db = null;
let SQL = null;

/**
 * Initialize SQL.js and load or create the database
 */
export async function initDB() {
  if (db) return db;

  // Dynamically import SQL.js (it's a CommonJS module)
  const sqlModule = await import('sql.js');
  console.log('SQL.js module:', sqlModule); // Debug what we got

  // Try different ways to get initSqlJs
  const initSqlJs = sqlModule.default || sqlModule;

  // Initialize SQL.js with WASM
  SQL = await initSqlJs({
    locateFile: (file) => `/${file}`,
  });

  // Try to load existing database from IndexedDB
  const savedDB = await loadDBFromIndexedDB();

  if (savedDB) {
    db = new SQL.Database(savedDB);
    console.log('Loaded existing local database');
  } else {
    db = new SQL.Database();
    await initSchema();
    await saveDBToIndexedDB();
    console.log('Created new local database');

    // Seed static data from server if online
    try {
      await seedStaticData();
    } catch (error) {
      console.error('Failed to seed static data:', error);
      throw error; // Re-throw so we can see the full error
    }
  }

  return db;
}

/**
 * Seed static reference data from server
 */
export async function seedStaticData() {
  const { configAPI } = await import('../api/client.js');
  const data = await configAPI.getStaticData();

  console.log('Seeding static data:', {
    exercises: data.exercises.length,
    exerciseGroups: data.exerciseGroups.length,
    schedule: data.schedule.length,
  });

  // Insert exercises
  data.exercises.forEach((ex) => {
    db.run(
      `INSERT OR REPLACE INTO exercises (
        id, name, muscle_group, type, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        ex.id,
        ex.name,
        ex.muscle_group,
        ex.type,
        ex.created_at,
      ]
    );
  });

  // Insert exercise groups
  data.exerciseGroups.forEach((group) => {
    db.run(
      `INSERT OR REPLACE INTO exercise_groups (
        id, name, muscle_group1, muscle_group2, created_at
      ) VALUES (?, ?, ?, ?, ?)`,
      [group.id, group.name, group.muscle_group1, group.muscle_group2, group.created_at]
    );
  });

  // Insert schedule
  data.schedule.forEach((sched) => {
    db.run(
      `INSERT OR REPLACE INTO schedule (day_number, workout_id)
       VALUES (?, ?)`,
      [sched.day_number, sched.workout_id]
    );
  });

  // Set default cycle start date to today if not already set
  const today = new Date().toISOString().split('T')[0];
  db.run(
    `INSERT OR IGNORE INTO app_config (key, value, updated_at)
     VALUES (?, ?, ?)`,
    ['cycle_start_date', today, new Date().toISOString()]
  );

  await saveDBToIndexedDB();
  console.log('Static data seeded from server');

  // Verify what was seeded
  const exerciseCount = query('SELECT COUNT(*) as count FROM exercises')[0].count;
  const scheduleCount = query('SELECT COUNT(*) as count FROM schedule')[0].count;
  console.log(`Verified: ${exerciseCount} exercises, ${scheduleCount} schedule entries`);
}

/**
 * Initialize database schema
 */
async function initSchema() {
  const schema = `
    -- Static reference data (seeded from server)
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      muscle_group TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('Pull', 'Push', 'Legs', 'Core')),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS exercise_groups (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      muscle_group1 TEXT NOT NULL,
      muscle_group2 TEXT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS schedule (
      day_number INTEGER PRIMARY KEY CHECK(day_number BETWEEN 1 AND 10),
      workout_id INTEGER NOT NULL,
      FOREIGN KEY (workout_id) REFERENCES exercise_groups(id)
    );

    -- Junction table to track which exercises were selected for each session
    CREATE TABLE IF NOT EXISTS session_exercises (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      muscle_group TEXT NOT NULL,
      exercise_id INTEGER NOT NULL,
      selection_order INTEGER NOT NULL CHECK(selection_order IN (1, 2)),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      -- Sync tracking
      sync_version INTEGER DEFAULT 0,
      last_synced_at TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id),
      UNIQUE(session_id, selection_order)
    );

    -- User data (dynamic, synced)
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_date DATE NOT NULL,
      day_number INTEGER NOT NULL CHECK(day_number BETWEEN 1 AND 10),
      exercise_group_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'in_progress' CHECK(status IN ('not_started', 'in_progress', 'completed')),
      notes TEXT,
      started_at TIMESTAMP,
      completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      -- Sync tracking
      sync_version INTEGER DEFAULT 0,
      last_synced_at TIMESTAMP,
      FOREIGN KEY (exercise_group_id) REFERENCES exercise_groups(id),
      UNIQUE(session_date)
    );

    CREATE TABLE IF NOT EXISTS workout_sets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_number INTEGER NOT NULL,
      reps INTEGER,
      weight REAL,
      duration_seconds INTEGER,
      notes TEXT,
      completed BOOLEAN DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      -- Sync tracking
      sync_version INTEGER DEFAULT 0,
      last_synced_at TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id),
      UNIQUE(session_id, exercise_id, set_number)
    );

    CREATE TABLE IF NOT EXISTS rest_timers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      exercise_id INTEGER NOT NULL,
      set_number INTEGER NOT NULL,
      rest_duration_seconds INTEGER NOT NULL DEFAULT 90,
      timer_started_at TIMESTAMP,
      timer_completed_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
      FOREIGN KEY (exercise_id) REFERENCES exercises(id)
    );

    -- Configuration table for app settings
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- Indexes for performance
    CREATE INDEX IF NOT EXISTS idx_workout_sessions_date ON workout_sessions(session_date);
    CREATE INDEX IF NOT EXISTS idx_workout_sessions_day ON workout_sessions(day_number);
    CREATE INDEX IF NOT EXISTS idx_workout_sets_session ON workout_sets(session_id);
    CREATE INDEX IF NOT EXISTS idx_workout_sets_updated ON workout_sets(updated_at);
    CREATE INDEX IF NOT EXISTS idx_workout_sessions_updated ON workout_sessions(updated_at);
    CREATE INDEX IF NOT EXISTS idx_session_exercises_session ON session_exercises(session_id);
  `;

  db.run(schema);
}

/**
 * Save database to IndexedDB for persistence
 */
export async function saveDBToIndexedDB() {
  if (!db) return;

  const data = db.export();
  const dbRequest = indexedDB.open(DB_NAME, 1);

  return new Promise((resolve, reject) => {
    dbRequest.onerror = () => reject(dbRequest.error);
    dbRequest.onsuccess = () => {
      const idb = dbRequest.result;
      const transaction = idb.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(data, 'database');

      transaction.oncomplete = () => {
        idb.close();
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    };

    dbRequest.onupgradeneeded = (event) => {
      const idb = event.target.result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Load database from IndexedDB
 */
async function loadDBFromIndexedDB() {
  const dbRequest = indexedDB.open(DB_NAME, 1);

  return new Promise((resolve, reject) => {
    dbRequest.onerror = () => reject(dbRequest.error);
    dbRequest.onsuccess = () => {
      const idb = dbRequest.result;

      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.close();
        resolve(null);
        return;
      }

      const transaction = idb.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get('database');

      getRequest.onsuccess = () => {
        idb.close();
        resolve(getRequest.result || null);
      };
      getRequest.onerror = () => {
        idb.close();
        reject(getRequest.error);
      };
    };

    dbRequest.onupgradeneeded = (event) => {
      const idb = event.target.result;
      if (!idb.objectStoreNames.contains(STORE_NAME)) {
        idb.createObjectStore(STORE_NAME);
      }
    };
  });
}

/**
 * Query helpers
 */
export function query(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  const results = db.exec(sql, params);
  if (results.length === 0) return [];

  const { columns, values } = results[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

export function run(sql, params = []) {
  if (!db) throw new Error('Database not initialized');
  db.run(sql, params);
  saveDBToIndexedDB(); // Persist changes
}

export function getOne(sql, params = []) {
  const results = query(sql, params);
  return results[0] || null;
}

export function getAll(sql, params = []) {
  return query(sql, params);
}

/**
 * Get the database instance
 */
export function getDB() {
  return db;
}

/**
 * Close and cleanup
 */
export function closeDB() {
  if (db) {
    db.close();
    db = null;
  }
}
