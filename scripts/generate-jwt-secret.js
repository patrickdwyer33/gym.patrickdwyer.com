#!/usr/bin/env node

/**
 * Generate secure JWT secret for .env file
 * Usage: node scripts/generate-jwt-secret.js
 */

import crypto from 'crypto';

const secret = crypto.randomBytes(32).toString('hex');

console.log('\n✅ JWT secret generated!\n');
console.log('Add this to your .env file:');
console.log(`JWT_SECRET=${secret}\n`);
console.log('⚠️  Keep this secret safe! Never commit it to git.\n');
