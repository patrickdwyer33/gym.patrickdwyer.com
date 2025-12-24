#!/usr/bin/env node

/**
 * Generate bcrypt password hash for .env file
 * Usage: node scripts/hash-password.js <password>
 */

import bcrypt from 'bcrypt';

const password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.js <password>');
  console.error('Example: node scripts/hash-password.js mySecurePassword123');
  process.exit(1);
}

bcrypt.hash(password, 10)
  .then(hash => {
    console.log('\n✅ Password hash generated!\n');
    console.log('Add this to your .env file:');
    console.log(`ADMIN_PASSWORD_HASH=${hash}\n`);
  })
  .catch(error => {
    console.error('Error generating hash:', error);
    process.exit(1);
  });
