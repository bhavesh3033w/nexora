import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 10;

export async function hashPassword(
  plainText: string
): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(plainText, salt);
}

export async function comparePassword(
  plainText: string,
  hash: string
): Promise<boolean> {
  if (!plainText || !hash) {
    return false;
  }

  return bcrypt.compare(plainText, hash);
}
