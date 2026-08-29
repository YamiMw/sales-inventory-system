/**
 * Password Utils
 * Hashes, verifies, and validates account passwords.
 */

const crypto = require('crypto');
const { promisify } = require('util');

const scrypt = promisify(crypto.scrypt);

class PasswordUtils {
  constructor() {
    this.keyLength = 64;
    this.saltLength = 32;
    this.scryptCost = 16384;
    this.scryptBlockSize = 8;
    this.scryptParallelization = 1;
  }

  async hashPassword(password) {
    const salt = crypto.randomBytes(this.saltLength).toString('hex');
    const hash = await scrypt(password, salt, this.keyLength, {
      N: this.scryptCost,
      r: this.scryptBlockSize,
      p: this.scryptParallelization,
      maxmem: 64 * 1024 * 1024
    });
    return [
      'scrypt',
      this.scryptCost,
      this.scryptBlockSize,
      this.scryptParallelization,
      salt,
      hash.toString('hex')
    ].join('$');
  }

  async verifyPassword(password, storedHash) {
    if (!storedHash || typeof storedHash !== 'string') return false;

    if (storedHash.startsWith('scrypt$')) {
      const [, cost, blockSize, parallelization, salt, encodedHash] = storedHash.split('$');
      if (!salt || !encodedHash) return false;
      const expected = Buffer.from(encodedHash, 'hex');
      const actual = await scrypt(password, salt, expected.length, {
        N: Number(cost),
        r: Number(blockSize),
        p: Number(parallelization),
        maxmem: 64 * 1024 * 1024
      });
      return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
    }

    const [salt, encodedHash] = storedHash.split(':');
    if (!salt || !encodedHash) return false;
    const expected = Buffer.from(encodedHash, 'hex');
    const actual = crypto.pbkdf2Sync(password, salt, 10000, expected.length, 'sha512');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  }

  needsRehash(storedHash) {
    return !String(storedHash || '').startsWith(
      `scrypt$${this.scryptCost}$${this.scryptBlockSize}$${this.scryptParallelization}$`
    );
  }

  validatePasswordStrength(password) {
    return typeof password === 'string' &&
      password.length >= 12 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /\d/.test(password) &&
      /[^A-Za-z0-9]/.test(password);
  }
}

module.exports = new PasswordUtils();
