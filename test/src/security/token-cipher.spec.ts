import { beforeEach, describe, expect, it, vi } from 'vitest';
import { randomBytes } from 'crypto';

const validKey = randomBytes(32).toString('base64');

const importTokenCipher = () => import('security/token-cipher.js');

describe('token-cipher', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = validKey;
  });

  it('round-trips a plaintext through encryptToken/decryptToken', async () => {
    const { encryptToken, decryptToken } = await importTokenCipher();

    const encrypted = encryptToken('super-secret-access-token');

    expect(decryptToken(encrypted)).toBe('super-secret-access-token');
  });

  it('never reuses the IV across two encryptions of the same plaintext', async () => {
    const { encryptToken } = await importTokenCipher();

    const first = encryptToken('same-plaintext');
    const second = encryptToken('same-plaintext');

    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });

  it('throws when the ciphertext has been tampered with', async () => {
    const { encryptToken, decryptToken } = await importTokenCipher();

    const encrypted = encryptToken('super-secret-access-token');
    const tampered = {
      ...encrypted,
      ciphertext: Buffer.from('tampered-ciphertext').toString('base64'),
    };

    expect(() => decryptToken(tampered)).toThrow();
  });

  it('throws when the auth tag has been tampered with', async () => {
    const { encryptToken, decryptToken } = await importTokenCipher();

    const encrypted = encryptToken('super-secret-access-token');
    const tampered = {
      ...encrypted,
      authTag: randomBytes(16).toString('base64'),
    };

    expect(() => decryptToken(tampered)).toThrow();
  });

  it('throws at import time when the encryption key env var is missing', async () => {
    delete process.env.PROVIDER_TOKEN_ENCRYPTION_KEY;

    await expect(importTokenCipher()).rejects.toThrow();
  });

  it('throws at import time when the encryption key env var is malformed', async () => {
    process.env.PROVIDER_TOKEN_ENCRYPTION_KEY = 'not-a-valid-base64-32-byte-key';

    await expect(importTokenCipher()).rejects.toThrow();
  });
});
