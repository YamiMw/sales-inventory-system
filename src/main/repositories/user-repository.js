/**
 * User Repository
 * Provides database access for user records.
 */

const { getDatabase } = require('../database/connection');

class UserRepository {
  async findByUsername(username) {
    const db = getDatabase();
    return await db('users')
      .select('*')
      .where('username', username)
      .first();
  }

  async findById(id) {
    const db = getDatabase();
    return await db('users')
      .select('id', 'username', 'email', 'full_name', 'role', 'is_active', 'last_login', 'created_at')
      .where('id', id)
      .first();
  }

  async updateLastLogin(userId) {
    const db = getDatabase();
    await db('users')
      .where('id', userId)
      .update({ last_login: db.fn.now() });
  }

  async updatePassword(userId, passwordHash, passwordMustChange = false) {
    const db = getDatabase();
    await db('users')
      .where('id', userId)
      .update({
        password_hash: passwordHash,
        password_must_change: passwordMustChange,
        updated_at: db.fn.now()
      });
  }

  async findAll() {
    const db = getDatabase();
    return await db('users')
      .select('id', 'username', 'email', 'full_name', 'role', 'is_active', 'last_login')
      .orderBy('username');
  }
}

module.exports = new UserRepository();
