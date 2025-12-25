/**
 * Helper script to reset the local database
 * Call this function from the browser console: window.resetLocalDB()
 */

export async function resetLocalDB() {
  return new Promise((resolve, reject) => {
    const dbName = 'gym-tracker-db';
    console.log(`Deleting IndexedDB: ${dbName}...`);

    const request = indexedDB.deleteDatabase(dbName);

    request.onsuccess = () => {
      console.log('✓ Local database deleted successfully!');
      console.log('→ Refresh the page to recreate the database with the new schema.');
      resolve();
    };

    request.onerror = () => {
      console.error('✗ Failed to delete database:', request.error);
      reject(request.error);
    };

    request.onblocked = () => {
      console.warn('⚠ Database deletion blocked. Close all tabs with this app and try again.');
    };
  });
}

// Make it available globally for easy access from console
if (typeof window !== 'undefined') {
  window.resetLocalDB = resetLocalDB;
}
