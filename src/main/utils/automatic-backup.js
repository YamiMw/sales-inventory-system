/**
 * Automatic Backup
 * Schedules recurring database backups and exposes backup status.
 */

const { getDatabase } = require('../database/connection');
const { createDatabaseBackup } = require('./backup');
const logger = require('./logger');

const CHECK_INTERVAL_MS = 30 * 1000;
const DEFAULT_CONFIG = {
  enabled: true,
  frequency: 'Daily',
  time: '02:00',
  retentionDays: 30
};

const SETTING_KEYS = {
  enabled: 'backup_enabled',
  frequency: 'backup_frequency',
  time: 'backup_time',
  retentionDays: 'backup_retention',
  scheduleUpdatedAt: 'backup_schedule_updated_at',
  lastBackupAt: 'backup_last_at',
  lastBackupPath: 'backup_last_path',
  lastAutomaticAt: 'backup_last_automatic_at',
  lastAutomaticError: 'backup_last_automatic_error'
};

let schedulerTimer = null;
let currentConfig = { ...DEFAULT_CONFIG };
let scheduleUpdatedAt = null;
let lastBackupAt = null;
let lastBackupPath = '';
let lastAutomaticAt = null;
let lastAutomaticError = '';
let backupInProgress = false;

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  return String(value).toLowerCase() === 'true' || String(value) === '1';
}

function normalizeTime(value) {
  const match = String(value || '').match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  return match ? `${match[1]}:${match[2]}` : DEFAULT_CONFIG.time;
}

function normalizeFrequency(value) {
  const frequency = String(value || '').toLowerCase();
  if (frequency === 'weekly') return 'Weekly';
  if (frequency === 'monthly') return 'Monthly';
  return 'Daily';
}

function normalizeConfig(settings = {}) {
  const parsedRetention = Number.parseInt(
    settings.backup_retention ?? settings.retentionDays,
    10
  );

  return {
    enabled: parseBoolean(
      settings.backup_enabled ?? settings.enabled,
      DEFAULT_CONFIG.enabled
    ),
    frequency: normalizeFrequency(
      settings.backup_frequency ?? settings.frequency
    ),
    time: normalizeTime(settings.backup_time ?? settings.time),
    retentionDays: Number.isFinite(parsedRetention) && parsedRetention > 0
      ? parsedRetention
      : DEFAULT_CONFIG.retentionDays
  };
}

function applyScheduledTime(date, time) {
  const [hours, minutes] = normalizeTime(time).split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function calculateMostRecentBackupAt(config, now = new Date()) {
  const candidate = new Date(now);

  if (config.frequency === 'Weekly') {
    const daysSinceMonday = (candidate.getDay() + 6) % 7;
    candidate.setDate(candidate.getDate() - daysSinceMonday);
  } else if (config.frequency === 'Monthly') {
    candidate.setDate(1);
  }

  applyScheduledTime(candidate, config.time);

  if (candidate > now) {
    if (config.frequency === 'Weekly') {
      candidate.setDate(candidate.getDate() - 7);
    } else if (config.frequency === 'Monthly') {
      candidate.setMonth(candidate.getMonth() - 1, 1);
    } else {
      candidate.setDate(candidate.getDate() - 1);
    }
  }

  return candidate;
}

function calculateNextBackupAt(config, now = new Date()) {
  const next = calculateMostRecentBackupAt(config, now);

  if (config.frequency === 'Weekly') {
    next.setDate(next.getDate() + 7);
  } else if (config.frequency === 'Monthly') {
    next.setMonth(next.getMonth() + 1, 1);
  } else {
    next.setDate(next.getDate() + 1);
  }

  return next;
}

async function readSettingRows() {
  const db = getDatabase();
  const rows = await db('settings')
    .select('key', 'value')
    .whereIn('key', Object.values(SETTING_KEYS));

  return Object.fromEntries(rows.map(row => [row.key, row.value]));
}

async function writeSettings(values) {
  const db = getDatabase();
  const timestamp = new Date().toISOString();
  const rows = Object.entries(values).map(([key, value]) => ({
    key,
    value: value === null || value === undefined ? '' : String(value),
    updated_at: timestamp
  }));

  if (!rows.length) return;
  await db('settings').insert(rows).onConflict('key').merge(['value', 'updated_at']);
}

function loadStateFromRows(rows) {
  currentConfig = normalizeConfig({
    backup_enabled: rows[SETTING_KEYS.enabled],
    backup_frequency: rows[SETTING_KEYS.frequency],
    backup_time: rows[SETTING_KEYS.time],
    backup_retention: rows[SETTING_KEYS.retentionDays]
  });
  scheduleUpdatedAt = rows[SETTING_KEYS.scheduleUpdatedAt] || null;
  lastBackupAt = rows[SETTING_KEYS.lastBackupAt] || null;
  lastBackupPath = rows[SETTING_KEYS.lastBackupPath] || '';
  lastAutomaticAt = rows[SETTING_KEYS.lastAutomaticAt] || null;
  lastAutomaticError = rows[SETTING_KEYS.lastAutomaticError] || '';
}

function getAutomaticBackupStatus() {
  return {
    enabled: currentConfig.enabled,
    frequency: currentConfig.frequency,
    time: currentConfig.time,
    retentionDays: currentConfig.retentionDays,
    lastBackupAt,
    lastBackupPath,
    lastAutomaticAt,
    lastError: lastAutomaticError,
    nextBackupAt: currentConfig.enabled
      ? calculateNextBackupAt(currentConfig).toISOString()
      : null,
    inProgress: backupInProgress
  };
}

async function recordBackupMetadata(data, options = {}) {
  const createdAt = data.createdAt || new Date().toISOString();
  const values = {
    [SETTING_KEYS.lastBackupAt]: createdAt,
    [SETTING_KEYS.lastBackupPath]: data.filePath || ''
  };

  lastBackupAt = createdAt;
  lastBackupPath = data.filePath || '';

  if (options.automatic) {
    values[SETTING_KEYS.lastAutomaticAt] = createdAt;
    values[SETTING_KEYS.lastAutomaticError] = '';
    lastAutomaticAt = createdAt;
    lastAutomaticError = '';
  }

  await writeSettings(values);
}

async function runAutomaticBackupIfDue() {
  if (!currentConfig.enabled || backupInProgress) return null;

  const now = new Date();
  const mostRecentSchedule = calculateMostRecentBackupAt(currentConfig, now);
  const baselineValue = lastAutomaticAt || scheduleUpdatedAt;
  const baseline = baselineValue ? new Date(baselineValue) : now;

  if (Number.isNaN(baseline.getTime()) || mostRecentSchedule <= baseline) {
    return null;
  }

  backupInProgress = true;
  try {
    logger.info(`Automatic backup started for schedule: ${mostRecentSchedule.toISOString()}`);
    const data = await createDatabaseBackup({
      retentionDays: currentConfig.retentionDays
    });
    await recordBackupMetadata(data, { automatic: true });
    logger.info(`Automatic backup completed: ${data.filePath}`);
    return data;
  } catch (error) {
    lastAutomaticError = error.message;
    await writeSettings({
      [SETTING_KEYS.lastAutomaticError]: error.message
    }).catch(writeError => {
      logger.error('Unable to save automatic backup error:', writeError.message);
    });
    logger.error('Automatic backup failed:', error.message);
    return null;
  } finally {
    backupInProgress = false;
  }
}

async function configureAutomaticBackup(settings = {}) {
  const nextConfig = normalizeConfig(settings);
  const timingChanged =
    nextConfig.enabled !== currentConfig.enabled ||
    nextConfig.frequency !== currentConfig.frequency ||
    nextConfig.time !== currentConfig.time;
  const timestamp = timingChanged || !scheduleUpdatedAt
    ? new Date().toISOString()
    : scheduleUpdatedAt;

  currentConfig = nextConfig;
  scheduleUpdatedAt = timestamp;
  if (!currentConfig.enabled) {
    lastAutomaticError = '';
  }

  await writeSettings({
    [SETTING_KEYS.enabled]: currentConfig.enabled,
    [SETTING_KEYS.frequency]: currentConfig.frequency,
    [SETTING_KEYS.time]: currentConfig.time,
    [SETTING_KEYS.retentionDays]: currentConfig.retentionDays,
    [SETTING_KEYS.scheduleUpdatedAt]: scheduleUpdatedAt,
    [SETTING_KEYS.lastAutomaticError]: lastAutomaticError
  });

  return getAutomaticBackupStatus();
}

function stopAutomaticBackup() {
  if (schedulerTimer) {
    clearInterval(schedulerTimer);
    schedulerTimer = null;
  }
}

async function initializeAutomaticBackup() {
  stopAutomaticBackup();

  const rows = await readSettingRows();
  loadStateFromRows(rows);

  if (!rows[SETTING_KEYS.scheduleUpdatedAt]) {
    await configureAutomaticBackup(currentConfig);
  }

  schedulerTimer = setInterval(() => {
    runAutomaticBackupIfDue().catch(error => {
      logger.error('Automatic backup scheduler error:', error.message);
    });
  }, CHECK_INTERVAL_MS);
  schedulerTimer.unref?.();

  await runAutomaticBackupIfDue();
  const status = getAutomaticBackupStatus();
  logger.info(
    status.enabled
      ? `Automatic backup scheduled for ${status.nextBackupAt}`
      : 'Automatic backup is disabled'
  );
  return status;
}

module.exports = {
  calculateMostRecentBackupAt,
  calculateNextBackupAt,
  configureAutomaticBackup,
  getAutomaticBackupStatus,
  initializeAutomaticBackup,
  recordBackupMetadata,
  runAutomaticBackupIfDue,
  stopAutomaticBackup
};
