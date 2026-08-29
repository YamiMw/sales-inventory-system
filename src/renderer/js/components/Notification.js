/**
 * Notification
 * Implements the reusable notification UI component.
 */

class NotificationManager {
  constructor() {
    this.container = document.getElementById('notification-container');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'notification-container';
      this.container.className = 'notification-container';
      document.body.appendChild(this.container);
    }
  }

  show({ type = 'info', title, message, duration = 5000 }) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    
    const icons = {
      success: '✅',
      warning: '⚠️',
      error: '❌',
      info: 'ℹ️'
    };
    
    notification.innerHTML = `
      <span class="notification-icon">${icons[type]}</span>
      <div class="notification-content">
        ${title ? `<div class="notification-title">${title}</div>` : ''}
        <div class="notification-message">${message}</div>
      </div>
      <button class="notification-close">&times;</button>
    `;
    
    this.container.appendChild(notification);
    
    const closeBtn = notification.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this.close(notification));
    
    if (duration > 0) {
      setTimeout(() => this.close(notification), duration);
    }
    
    return notification;
  }

  close(notification) {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }

  clearAll() {
    this.container.innerHTML = '';
  }
}

if (typeof window !== 'undefined') window.NotificationManager = NotificationManager;
if (typeof module !== 'undefined') module.exports = { NotificationManager };
