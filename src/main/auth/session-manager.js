/**
 * Session Manager
 * Creates, validates, refreshes, and revokes authenticated sessions.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const config = require('../../shared/constants/config');

class SessionManager {
  constructor() {
    this.sessions = new Map();
    this.sessionTimeout = config.session.timeout;
    
    setInterval(() => this.cleanupExpiredSessions(), 60 * 60 * 1000);
  }

  async createSession(userId, data = {}) {
    const token = this.generateToken();
    const now = Date.now();
    
    const session = {
      token,
      userId,
      data,
      createdAt: now,
      lastAccessed: now,
      expiresAt: now + this.sessionTimeout
    };
    
    this.sessions.set(token, session);
    logger.debug(`Session created for user ${userId}`);
    
    return session;
  }

  async getSession(token) {
    const session = this.sessions.get(token);
    if (session) {
      session.lastAccessed = Date.now();
    }
    return session;
  }

  async destroySession(token) {
    const session = this.sessions.get(token);
    if (session) {
      this.sessions.delete(token);
      logger.debug(`Session destroyed for user ${session.userId}`);
    }
  }

  async destroyUserSessions(userId) {
    let count = 0;
    for (const [token, session] of this.sessions.entries()) {
      if (session.userId === userId) {
        this.sessions.delete(token);
        count++;
      }
    }
    return count;
  }

  async extendSession(token) {
    const session = this.sessions.get(token);
    if (session) {
      session.expiresAt = Date.now() + this.sessionTimeout;
      session.lastAccessed = Date.now();
      return true;
    }
    return false;
  }

  isSessionExpired(session) {
    return Date.now() > session.expiresAt;
  }

  cleanupExpiredSessions() {
    const now = Date.now();
    let count = 0;
    
    for (const [token, session] of this.sessions.entries()) {
      if (now > session.expiresAt) {
        this.sessions.delete(token);
        count++;
      }
    }
    
    if (count > 0) {
      logger.debug(`Cleaned up ${count} expired sessions`);
    }
  }

  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }
}

module.exports = new SessionManager();