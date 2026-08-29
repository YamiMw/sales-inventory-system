/**
 * Audit Repository
 * Provides database access for audit records.
 */

'use strict';

const auditService = require('../services/audit-service');

class AuditRepository {
  async create(entry, dbOrTrx = null) {
    return auditService.record(entry, dbOrTrx);
  }

  async find(filters = {}, dbOrTrx = null) {
    return auditService.query(filters, dbOrTrx);
  }
}

module.exports = new AuditRepository();
