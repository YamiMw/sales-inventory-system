/**
 * Header Notification UI Test
 * Verifies the compact alert indicator, sound, and user-menu presentation.
 */

'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const appRoot = path.join(__dirname, '../..');

function read(relativePath) {
  return fs.readFileSync(path.join(appRoot, relativePath), 'utf8');
}

test('header uses an unread badge, sound, circular avatars, and profile security actions', () => {
  const html = read('src/renderer/index.html');
  const app = read('src/renderer/js/app.js');
  const css = read('src/renderer/styles/main.css');
  const dropdown = html.match(/<div class="user-dropdown" id="userDropdown">([\s\S]*?)<\/div>\s*<\/div>\s*<\/div>\s*<\/div>\s*<\/header>/)?.[1] || '';

  assert.match(html, /id="notificationCount" aria-hidden="true" hidden><\/span>/);
  assert.doesNotMatch(dropdown, /My Profile|Account Settings/);
  assert.match(dropdown, /id="profileResetPassword"/);
  assert.match(dropdown, /id="profileSignOut"/);
  assert.match(html, /id="profile-reset-password-modal"/);
  assert.match(app, /handleProfilePasswordReset/);
  assert.match(app, /playNotificationSound\(type\)/);
  assert.match(app, /window\.AudioContext \|\| window\.webkitAudioContext/);
  assert.match(app, /count\.hidden = unread === 0/);
  assert.match(css, /\.notification-count\s*\{[\s\S]*?min-width:\s*18px;[\s\S]*?height:\s*18px;/);
  assert.match(css, /\.notification-count\[hidden\]\s*\{\s*display:\s*none;/);
  assert.match(css, /\.user-profile \.user-avatar\s*\{[\s\S]*?border-radius:\s*50%;/);
  assert.match(css, /\.dropdown-user-avatar\s*\{[\s\S]*?border-radius:\s*50%;/);
  assert.match(css, /\.user-profile \.user-info span:first-child\s*\{[\s\S]*?white-space:\s*nowrap;/);
  assert.match(css, /\.user-profile\s*\{[\s\S]*?width:\s*max-content;/);
  assert.doesNotMatch(
    css.match(/\.user-profile \.user-info span:first-child\s*\{([\s\S]*?)\}/)?.[1] || '',
    /text-overflow:\s*ellipsis|max-width:/
  );
  assert.doesNotMatch(
    css.match(/\.user-dropdown-name\s*\{([\s\S]*?)\}/)?.[1] || '',
    /text-overflow:\s*ellipsis|max-width:/
  );
});

test('system administration header uses title case', () => {
  const html = read('src/renderer/index.html');
  const app = read('src/renderer/js/app.js');

  assert.match(html, /<h1>System Administration<\/h1>/);
  assert.match(app, /users:\s*\{\s*title:\s*'System Administration'/);
  assert.doesNotMatch(html, /<h1>Access Control<\/h1>|SYSTEM ADMINISTRATION/);
  assert.doesNotMatch(app, /title:\s*'Access Control'|SYSTEM ADMINISTRATION/);
});

test('header profile name and role use title case', () => {
  const html = read('src/renderer/index.html');
  const app = read('src/renderer/js/app.js');
  const css = read('src/renderer/styles/main.css');
  const profileTextRules = [...css.matchAll(/\.user-profile \.user-info span:first-child\s*\{([\s\S]*?)\}/g)];
  const profileRoleRules = [...css.matchAll(/\.user-profile \.user-info span:last-child\s*\{([\s\S]*?)\}/g)];
  const profileTextCss = profileTextRules.at(-1)?.[1] || '';
  const profileRoleCss = profileRoleRules.at(-1)?.[1] || '';

  assert.match(html, /id="userName">System Administrator<\/span>/);
  assert.match(html, /id="userRole">Admin<\/span>/);
  assert.match(html, />Admin Authority<\/span>/);
  assert.match(app, /toTitleCase\(user\.fullName \|\| user\.username \|\| 'System Administrator'\)/);
  assert.match(app, /if \(headerName\) headerName\.textContent = displayName;/);
  assert.doesNotMatch(app, /displayName\.toUpperCase\(\)|const roleLabel = role\.toUpperCase\(\)/);
  assert.match(profileTextCss, /text-transform:\s*none;/);
  assert.match(profileRoleCss, /text-transform:\s*none;/);
});
