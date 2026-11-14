import crypto from 'crypto';

// 32-byte secret key derived from SESSION_SECRET or deterministic fallback for zero-downtime dev/prod
const SECRET_SEED = process.env.SESSION_SECRET || 'myacademia_srmist_zero_knowledge_aes256_secure_key_2026';
const KEY = crypto.createHash('sha256').update(SECRET_SEED).digest();
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts sensitive session tokens using AES-256-GCM authenticated encryption.
 * Returns a payload string formatted as: `iv:authTag:ciphertext` (hex encoded)
 */
export function encryptSession(text: string): string {
  try {
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv(ALGORITHM, KEY, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag().toString('hex');
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
  } catch (error) {
    console.error('Encryption failure:', error);
    throw new Error('Failed to encrypt session cookie');
  }
}

/**
 * Decrypts and verifies AES-256-GCM session tokens.
 * Returns decrypted plaintext or null if tampered / invalid.
 */
export function decryptSession(payload: string): string | null {
  try {
    if (!payload || !payload.includes(':')) return null;
    
    const parts = payload.split(':');
    if (parts.length !== 3) return null;

    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, KEY, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    // Authentication tag mismatch or corrupted payload
    return null;
  }
}
