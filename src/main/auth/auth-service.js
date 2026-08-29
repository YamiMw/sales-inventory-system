/**
 * Auth Service
 * Authenticates users and coordinates password, account, and session checks.
 */

const userRepository = require('../repositories/user-repository');
const passwordUtils = require('./password-utils');
const logger = require('../utils/logger');
const { getDatabase } = require('../database/connection');
const auditService = require('../services/audit-service');

class AuthService {
  constructor() {
    this.sessions = new Map();
    this.loginAttempts = new Map();
    this.maxLoginAttempts = 5;
    this.lockoutDuration = 15 * 60 * 1000; // 15 minutes
    this.sessionTimeout = 8 * 60 * 60 * 1000; // 8 hours
  }

  async login(username, password) {
    try {
      // Check account lockout
      if (this.isAccountLocked(username)) {
        throw new Error('Account is temporarily locked. Please try again later.');
      }

      // Find user
      const user = await userRepository.findByUsername(username);
      if (!user) {
        this.recordFailedAttempt(username);
        await auditService.record({
          action: 'login_failed',
          entityType: 'authentication',
          userId: null,
          details: { username, reason: 'unknown_user' }
        });
        throw new Error('Invalid username or password');
      }

      // Check if active
      const status = String(user.status || '').toLowerCase();
      if (user.is_active === false ||
          Number(user.is_active) === 0 ||
          ['inactive', 'locked'].includes(status)) {
        await auditService.record({
          action: 'login_failed',
          entityType: 'authentication',
          userId: user.id,
          details: { username, reason: 'account_inactive' }
        });
        throw new Error('Account is disabled. Please contact administrator.');
      }

      // Verify password
      const isValid = await passwordUtils.verifyPassword(password, user.password_hash);
      if (!isValid) {
        this.recordFailedAttempt(username);
        await auditService.record({
          action: 'login_failed',
          entityType: 'authentication',
          userId: user.id,
          details: { username }
        });
        throw new Error('Invalid username or password');
      }

      if (passwordUtils.needsRehash(user.password_hash)) {
        await userRepository.updatePassword(
          user.id,
          await passwordUtils.hashPassword(password),
          Boolean(user.password_must_change)
        );
      }

      // Clear failed attempts
      this.clearFailedAttempts(username);

      // Update last login
      await userRepository.updateLastLogin(user.id);

      // Create session
      const token = this.generateToken();
      const session = {
        token,
        userId: user.id,
        username: user.username,
        fullName: user.full_name,
        role: user.role,
        createdAt: Date.now(),
        expiresAt: Date.now() + this.sessionTimeout
      };
      
      this.sessions.set(token, session);

      logger.info(`User ${username} logged in successfully`);
      await auditService.record({
        action: 'login',
        entityType: 'authentication',
        userId: user.id,
        details: { username: user.username }
      });

      return {
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          fullName: user.full_name,
          role: user.role,
          mustChangePassword: Boolean(user.password_must_change)
        },
        expiresAt: session.expiresAt
      };
    } catch (error) {
      logger.error(`Login failed for ${username}:`, error);
      throw error;
    }
  }

  async logout(token) {
    try {
      if (this.sessions.has(token)) {
        const session = this.sessions.get(token);
        this.sessions.delete(token);
        await auditService.record({
          action: 'logout',
          entityType: 'authentication',
          userId: session.userId,
          details: { username: session.username }
        });
        logger.info('User logged out');
      }
      return true;
    } catch (error) {
      logger.error('Logout failed:', error);
      throw error;
    }
  }

  async validateToken(token) {
    try {
      const session = this.sessions.get(token);
      if (!session) return null;

      if (Date.now() > session.expiresAt) {
        this.sessions.delete(token);
        return null;
      }

      const user = await userRepository.findByUsername(session.username);
      const status = String(user?.status || '').toLowerCase();
      const active = user &&
        user.is_active !== false &&
        Number(user.is_active) !== 0 &&
        !['inactive', 'locked'].includes(status);
      if (!active) {
        await this.invalidateUserSessions(session.userId);
        return null;
      }

      // Extend session
      session.expiresAt = Date.now() + this.sessionTimeout;
      session.role = user.role;
      session.fullName = user.full_name;

      return {
        userId: session.userId,
        username: session.username,
        fullName: session.fullName,
        role: session.role,
        mustChangePassword: Boolean(user.password_must_change)
      };
    } catch (error) {
      logger.error('Token validation failed:', error);
      return null;
    }
  }

  recordFailedAttempt(username) {
    const attempts = this.loginAttempts.get(username) || { count: 0, firstAttempt: Date.now() };
    attempts.count++;
    if (attempts.count === 1) {
      attempts.firstAttempt = Date.now();
    }
    this.loginAttempts.set(username, attempts);
    logger.warn(`Failed login attempt ${attempts.count} for ${username}`);
  }

  clearFailedAttempts(username) {
    this.loginAttempts.delete(username);
  }

  isAccountLocked(username) {
    const attempts = this.loginAttempts.get(username);
    if (!attempts) return false;

    if (attempts.count >= this.maxLoginAttempts) {
      const lockoutExpires = attempts.firstAttempt + this.lockoutDuration;
      if (Date.now() < lockoutExpires) {
        return true;
      } else {
        this.loginAttempts.delete(username);
      }
    }
    return false;
  }

  generateToken() {
    return require('crypto').randomBytes(32).toString('hex');
  }

  async getSetupStatus() {
    const db = getDatabase();
    const result = await db('users').count('* as count').first();
    return { required: Number(result.count) === 0 };
  }

  async setupAdministrator(data) {
    const db = getDatabase();
    if (!data.username || !data.fullName || !passwordUtils.validatePasswordStrength(data.password)) {
      throw new Error(
        'Administrator setup requires a username, full name, and a 12-character mixed password'
      );
    }

    const passwordHash = await passwordUtils.hashPassword(data.password);
    const userId = await db.transaction(async (trx) => {
      const existing = await trx('users').count('* as count').first();
      if (Number(existing.count) !== 0) {
        throw new Error('Administrator setup has already been completed');
      }
      const inserted = await trx('users').insert({
        username: data.username.trim(),
        email: data.email?.trim() || null,
        password_hash: passwordHash,
        password_must_change: false,
        full_name: data.fullName.trim(),
        role: 'admin',
        is_active: true,
        status: 'active',
        permissions: '[]',
        created_at: trx.fn.now(),
        updated_at: trx.fn.now()
      });
      return typeof inserted[0] === 'object' ? inserted[0].id : inserted[0];
    });
    await auditService.record({
      action: 'administrator_setup',
      entityType: 'users',
      userId,
      details: { username: data.username.trim() }
    });
    return { userId };
  }

  async changePassword(userId, currentPassword, newPassword) {
    if (!passwordUtils.validatePasswordStrength(newPassword)) {
      throw new Error(
        'New password must be at least 12 characters and include upper, lower, number, and symbol'
      );
    }

    const db = getDatabase();
    const user = await db('users').where('id', userId).first();
    if (!user || !await passwordUtils.verifyPassword(currentPassword, user.password_hash)) {
      throw new Error('Current password is incorrect');
    }
    if (await passwordUtils.verifyPassword(newPassword, user.password_hash)) {
      throw new Error('New password must differ from the current password');
    }

    await userRepository.updatePassword(
      user.id,
      await passwordUtils.hashPassword(newPassword),
      false
    );
    await this.invalidateUserSessions(user.id);
    await auditService.record({
      action: 'password_changed',
      entityType: 'users',
      userId: user.id,
      details: { username: user.username }
    });
    return true;
  }

  async invalidateUserSessions(userId) {
    let removed = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (Number(session.userId) === Number(userId)) {
        this.sessions.delete(token);
        removed += 1;
      }
    }
    return removed;
  }

  invalidateAllSessions() {
    this.sessions.clear();
  }
}

module.exports = new AuthService();
