import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export type EncryptedToken = {
  ciphertext: string;
  iv: string;
  authTag: string;
};

const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH_BYTES = 32;
const IV_LENGTH_BYTES = 12;

const loadEncryptionKey = (): Buffer => {
  const rawKey = process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;

  if (!rawKey) {
    throw new Error('PROVIDER_TOKEN_ENCRYPTION_KEY is not set');
  }

  const key = Buffer.from(rawKey, 'base64');

  if (key.length !== KEY_LENGTH_BYTES) {
    throw new Error(
      `PROVIDER_TOKEN_ENCRYPTION_KEY must decode to ${KEY_LENGTH_BYTES} bytes`
    );
  }

  return key;
};

const encryptionKey = loadEncryptionKey();

export function encryptToken(plaintext: string): EncryptedToken {
  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, encryptionKey, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  };
}

export function decryptToken(input: EncryptedToken): string {
  const decipher = createDecipheriv(
    ALGORITHM,
    encryptionKey,
    Buffer.from(input.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(input.authTag, 'base64'));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(input.ciphertext, 'base64')),
    decipher.final(),
  ]);

  return plaintext.toString('utf8');
}
