const crypto = require('crypto');
const { env } = require('../config/env');

const KEY = Buffer.from(env.AES_ENCRYPTION_KEY, 'hex'); // 32 bytes

/**
 * Encrypts plaintext string using AES-256-GCM.
 * Output format: base64(iv).base64(authTag).base64(ciphertext)
 */
function encrypt(plaintext) {
  if (!plaintext) return plaintext;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv, authTag, ciphertext].map(b => b.toString('base64')).join('.');
}

/**
 * Decrypts AES-256-GCM payload string.
 */
function decrypt(payload) {
  if (!payload || !payload.includes('.')) return payload;
  try {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      KEY,
      Buffer.from(ivB64, 'base64')
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final()
    ]).toString('utf8');
  } catch (e) {
    console.error('[Crypto Decryption Error]:', e.message);
    return null;
  }
}

module.exports = {
  encrypt,
  decrypt
};
