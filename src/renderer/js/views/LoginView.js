/**
 * Login View
 * Controls data loading and interactions for the login screen.
 */

class LoginManager {
  constructor() {
    this.form = document.getElementById('login-form');
    this.usernameInput = document.getElementById('username');
    this.passwordInput = document.getElementById('password');
    this.togglePasswordBtn = document.getElementById('toggle-password');
    this.loginButton = document.getElementById('login-button');
    this.errorElement = document.getElementById('login-error');
    this.rememberCheckbox = document.getElementById('remember-me');
    
    this.setupListeners();
    this.checkExistingSession();
  }

  setupListeners() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    this.togglePasswordBtn.addEventListener('click', () => this.togglePassword());
    
    // Clear error on input
    this.usernameInput.addEventListener('input', () => this.clearError());
    this.passwordInput.addEventListener('input', () => this.clearError());
  }

  async checkExistingSession() {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (!token) return;

    try {
      const result = await window.electronAPI.invoke('auth:validate', token);
      if (result.success && result.data) {
        // Valid session exists, redirect to main app
        window.location.href = 'index.html';
      }
    } catch (_error) {}
  }

  async handleSubmit(e) {
    e.preventDefault();
    
    const username = this.usernameInput.value.trim();
    const password = this.passwordInput.value;
    
    if (!username || !password) {
      this.showError('Please enter username and password');
      return;
    }
    
    this.setLoading(true);
    this.clearError();
    
    try {
      const result = await window.electronAPI.invoke('auth:login', { username, password });
      
      if (result.success) {
        // Store token
        const { token, user } = result.data;
        
        if (this.rememberCheckbox.checked) {
          localStorage.setItem('auth_token', token);
        } else {
          sessionStorage.setItem('auth_token', token);
        }
        
        localStorage.setItem('user', JSON.stringify(user));
        
        // Redirect to main app
        window.location.href = 'index.html';
      } else {
        this.showError(result.error || 'Login failed');
      }
    } catch (error) {
      this.showError('Unable to connect to server. Please try again.');
    } finally {
      this.setLoading(false);
    }
  }

  togglePassword() {
    const type = this.passwordInput.type === 'password' ? 'text' : 'password';
    this.passwordInput.type = type;
    this.togglePasswordBtn.textContent = type === 'password' ? '👁️' : '👁️‍🗨️';
  }

  showError(message) {
    this.errorElement.textContent = message;
    this.errorElement.classList.add('show');
  }

  clearError() {
    this.errorElement.textContent = '';
    this.errorElement.classList.remove('show');
  }

  setLoading(loading) {
    this.loginButton.disabled = loading;
    this.loginButton.querySelector('.button-text').style.display = loading ? 'none' : 'inline';
    this.loginButton.querySelector('.button-loader').style.display = loading ? 'inline' : 'none';
  }

}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LoginManager();
});
