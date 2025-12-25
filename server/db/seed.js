import Database from 'better-sqlite3';
import fs from 'fs';
import { parse } from 'csv-parse/sync';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = join(__dirname, 'gym.db');
const db = new Database(dbPath);

// Read and execute schema
const schema = fs.readFileSync(join(__dirname, 'schema.sql'), 'utf8');
db.exec(schema);

console.log('Database schema created successfully');

// Import exercises
const exercisesCsv = fs.readFileSync(join(__dirname, '../../data/exercises.csv'), 'utf8');
const exercises = parse(exercisesCsv, { columns: true, skip_empty_lines: true });
const insertExercise = db.prepare(`
  INSERT OR REPLACE INTO exercises (id, name, muscle_group, type, equipment_level)
  VALUES (?, ?, ?, ?, ?)
`);

exercises.forEach(ex => {
  insertExercise.run(
    ex.ID,
    ex.Name,
    ex.MuscleGroup,
    ex.Type,
    ex.EquipmentLevel
  );
});

console.log(`Imported ${exercises.length} exercises`);

// Import exercise groups
const groupsCsv = fs.readFileSync(join(__dirname, '../../data/exercise-groups.csv'), 'utf8');
const groups = parse(groupsCsv, { columns: true, skip_empty_lines: true });
const insertGroup = db.prepare(`
  INSERT OR REPLACE INTO exercise_groups (id, name, muscle_group1, muscle_group2)
  VALUES (?, ?, ?, ?)
`);

groups.forEach(group => {
  insertGroup.run(
    group.ID,
    group.Name,
    group.MuscleGroup1,
    group.MuscleGroup2
  );
});

console.log(`Imported ${groups.length} exercise groups`);

// Import schedule
const scheduleCsv = fs.readFileSync(join(__dirname, '../../data/schedule.csv'), 'utf8');
const schedule = parse(scheduleCsv, { columns: true, skip_empty_lines: true });
const insertSchedule = db.prepare(`
  INSERT OR REPLACE INTO schedule (day_number, workout_id)
  VALUES (?, ?)
`);

schedule.forEach(day => {
  insertSchedule.run(
    day.Day,
    day.WorkoutID
  );
});

console.log(`Imported ${schedule.length} schedule entries`);

// Insert default app configuration
const insertConfig = db.prepare(`
  INSERT OR REPLACE INTO app_config (key, value)
  VALUES (?, ?)
`);

insertConfig.run('cycle_start_date', new Date().toISOString().split('T')[0]);
insertConfig.run('default_rest_seconds', '90');

console.log('Inserted default app configuration');
console.log('Database seeded successfully!');

db.close();
