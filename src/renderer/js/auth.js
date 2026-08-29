/**
 * Auth
 * Maintains renderer authentication state and account access checks.
 */

class AuthManager {
  constructor() {
    this.form = document.getElementById('login-form');
    this.errorElement = document.getElementById('login-error');
    this.setupListeners();
  }

  setupListeners() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember-me').checked;
    
    this.clearError();
    this.setLoading(true);
    
    try {
      const result = await window.electronAPI.login({ username, password });
      
      if (remember) {
        localStorage.setItem('auth_token', result.token);
      } else {
        sessionStorage.setItem('auth_token', result.token);
      }
      
      localStorage.setItem('user', JSON.stringify(result.user));
      
      window.location.href = 'index.html';
    } catch (error) {
      this.showError(error.message || 'Login failed');
    } finally {
      this.setLoading(false);
    }
  }

  showError(message) {
    this.errorElement.textContent = message;
  }

  clearError() {
    this.errorElement.textContent = '';
  }

  setLoading(loading) {
    const btn = this.form.querySelector('button[type="submit"]');
    btn.textContent = loading ? 'Signing in...' : 'Sign In';
    btn.disabled = loading;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AuthManager();
});