import bcrypt from 'bcrypt';

const password = process.argv[2];

console.log('Generating bcrypt hash for password:', password);

bcrypt.hash(password, 10).then(hash => {
  console.log('\nPassword hash:');
  console.log(hash);
  console.log('\nAdd this to your .env file as:');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
}).catch(error => {
  console.error('Error generating hash:', error);
  process.exit(1);
});
