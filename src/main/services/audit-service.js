/**
 * Audit Service
 * Coordinates business rules and persistence for audit operations.
 */

const { getDatabase } = require('../database/connection');

function senderDetails(event) {
  return {
    senderId: event?.sender?.id || null,
    senderUrl: event?.senderFrame?.url || event?.sender?.getURL?.() || null
  };
}

async function record(entry, dbOrTrx = null) {
  const db = dbOrTrx || getDatabase();
  const details = {
    ...(entry.details || {}),
    ...senderDetails(entry.event)
  };

  await db('audit_logs').insert({
    user_id: entry.userId || null,
    action: entry.action,
    entity_type: entry.entityType || 'system',
    entity_id: entry.entityId || null,
    old_values: entry.oldValues ? JSON.stringify(entry.oldValues) : null,
    new_values: Object.keys(details).length ? JSON.stringify(details) : null,
    ip_address: null,
    created_at: db.fn.now()
  });
}

async function query(filters = {}, dbOrTrx = null) {
  const db = dbOrTrx || getDatabase();
  let request = db('audit_logs')
    .select(
      'audit_logs.*',
      'users.username',
      'users.full_name as user_full_name'
    )
    .leftJoin('users', 'audit_logs.user_id', 'users.id')
    .orderBy('audit_logs.created_at', 'desc');

  if (filters.action) request = request.where('audit_logs.action', filters.action);
  if (filters.entityType) request = request.where('audit_logs.entity_type', filters.entityType);
  if (filters.userId) request = request.where('audit_logs.user_id', filters.userId);
  if (filters.startDate) request = request.where('audit_logs.created_at', '>=', filters.startDate);
  if (filters.endDate) request = request.where('audit_logs.created_at', '<=', filters.endDate);

  return request.limit(Math.min(Number(filters.limit) || 200, 1000));
}

module.exports = {
  query,
  record
};
