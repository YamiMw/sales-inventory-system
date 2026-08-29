/**
 * IPC Policy Coverage Test
 * Verifies ipc policy coverage behavior and regression boundaries.
 */

'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {
  CHANNEL_PERMISSIONS,
  PUBLIC_CHANNELS
} = require('../../src/main/security/authorized-ipc');
const { IPC_CHANNELS } = require('../../src/shared/constants/ipc-channels');
const { registerSystemAuthHandlers } = require('../../src/main/ipc/live/system-auth-handlers');
const { registerUserHandlers } = require('../../src/main/ipc/live/user-handlers');
const { registerCatalogHandlers } = require('../../src/main/ipc/live/catalog-handlers');
const { registerCommerceHandlers } = require('../../src/main/ipc/live/commerce-handlers');

test('every live business handler has a centralized authorization policy', () => {
  const channels = [];
  const context = {
    secureIpc: { handle: channel => channels.push(channel) },
    IPC_CHANNELS
  };
  registerSystemAuthHandlers(context);
  registerUserHandlers(context);
  registerCatalogHandlers(context);
  registerCommerceHandlers(context);
  channels.push('delete-quotation', 'clear-quotations', 'clear-invoices');

  const missing = channels.filter(channel =>
    !PUBLIC_CHANNELS.has(channel) &&
    !Object.prototype.hasOwnProperty.call(CHANNEL_PERMISSIONS, channel)
  );
  assert.deepEqual(missing, []);
  assert.equal(new Set(channels).size, channels.length);
});
