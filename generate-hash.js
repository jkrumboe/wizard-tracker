// Generate correct password hash for test users
import bcryptjs from 'bcryptjs';

async function generateHash() {
  const password = 'testpass123';
  const hash = await bcryptjs.hash(password, 10);
  console.log('Password:', password);
  console.log('Hash:', hash);
  
  // Test the hash
  const isValid = await bcryptjs.compare(password, hash);
  console.log('Hash validation:', isValid);
}

generateHash();
