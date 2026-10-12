
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import path from 'node:path';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function main() {
  const uri = process.env.MONGODB_URI;
  const email = 'demo@nexora.test';
  const newPassword = process.env.RESET_ADMIN_PASSWORD;

  if (!uri || !newPassword) {
    throw new Error(
      'MONGODB_URI or RESET_ADMIN_PASSWORD is missing in backend .env'
    );
  }

  if (newPassword.length < 12) {
    throw new Error('Use a password with at least 12 characters.');
  }

  await mongoose.connect(uri);

  try {
    const users = mongoose.connection.collection('users');
    const admin = await users.findOne({
      email,
      role: 'admin',
    });

    if (!admin) {
      throw new Error('Admin account not found; no changes made.');
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);

    await users.updateOne(
      { _id: admin._id, role: 'admin' },
      { $set: { passwordHash } }
    );

    console.log('Admin password reset successfully.');
    console.log('Admin email:', email);
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error('Password reset failed:', error.message);
  process.exitCode = 1;
});
