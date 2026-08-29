/**
 * Login
 * Controls login and first-administrator setup interactions.
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
    this.setupForm = document.getElementById('setup-form');
    this.changePasswordForm = document.getElementById('change-password-form');
    this.clockTimer = null;
    
    this.setupListeners();
    this.initialize();
  }

  setupListeners() {
    this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    
    this.togglePasswordBtn?.addEventListener('click', () => this.togglePassword());
    document.querySelectorAll('.setup-password-toggle').forEach((toggleButton) => {
      toggleButton.addEventListener('click', () => this.togglePasswordField(toggleButton));
    });
    
    // Clear error on input
    this.usernameInput.addEventListener('input', () => this.clearError());
    this.passwordInput.addEventListener('input', () => this.clearError());
    this.setupForm.addEventListener('submit', (event) => this.handleSetup(event));
    this.changePasswordForm.addEventListener('submit', (event) => this.handlePasswordChange(event));
  }

  async initialize() {
    window.electronAPI?.setMenuBarVisible?.(false);
    await this.updateDeviceName();
    this.updateSystemMeta();
    this.clockTimer = setInterval(() => this.updateSystemMeta(), 30000);

    const setup = await window.electronAPI.getSetupStatus();
    if (setup?.success && setup.data?.required) {
      this.showMode('setup');
      return;
    }
    await this.checkExistingSession();
  }

  showMode(mode) {
    this.form.style.display = mode === 'login' ? '' : 'none';
    this.setupForm.style.display = mode === 'setup' ? '' : 'none';
    this.changePasswordForm.style.display = mode === 'change' ? '' : 'none';
    const title = document.querySelector('.card-header h2');
    const subtitle = document.querySelector('.card-header p');
    if (mode === 'setup') {
      title.textContent = 'Create Administrator';
      subtitle.textContent = 'Complete secure first-run setup before using the system.';
    } else if (mode === 'change') {
      title.textContent = 'Change Required Password';
      subtitle.textContent = 'Choose a new password before continuing.';
    } else {
      title.textContent = 'Sign in';
      subtitle.textContent = 'Enter your credentials to access the system';
    }
  }

  async updateDeviceName() {
    const deviceElement = document.getElementById('login-device-name');
    if (!deviceElement) return;

    const localDeviceName = window.electronAPI?.getDeviceName?.();
    if (localDeviceName) {
      deviceElement.textContent = localDeviceName;
      return;
    }

    try {
      const result = await window.electronAPI?.getSystemInfo?.();
      const deviceName = result?.data?.deviceName || result?.data?.computerName || result?.data?.hostname;
      if (result?.success && deviceName) {
        deviceElement.textContent = deviceName;
      }
    } catch (error) {
      // Keep the fallback text already rendered in the page.
    }
  }

  updateSystemMeta() {
    const now = new Date();
    const dateElement = document.getElementById('login-date');
    const timeElement = document.getElementById('login-time');

    if (dateElement) {
      dateElement.textContent = now.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    }

    if (timeElement) {
      timeElement.textContent = now.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit'
      });
    }
  }

  async checkExistingSession() {
    const token = localStorage.getItem('auth_token') || sessionStorage.getItem('auth_token');
    if (!token) return;

    try {
      const result = await window.electronAPI.validateToken(token);
      if (result.success && result.data) {
        if (result.data.mustChangePassword) {
          this.showMode('change');
          return;
        }
        window.location.href = 'index.html';
      } else {
        this.clearStoredAuth();
      }
    } catch (_error) {
      this.clearStoredAuth();
    }
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
      const result = await window.electronAPI.login({ username, password });
      
      if (result.success) {
        // Store token
        const { token, user } = result.data;
        
        if (this.rememberCheckbox.checked) {
          localStorage.setItem('auth_token', token);
        } else {
          sessionStorage.setItem('auth_token', token);
        }
        
        localStorage.setItem('user', JSON.stringify(user));

        if (user.mustChangePassword) {
          this.showMode('change');
          document.getElementById('current-password').value = password;
          return;
        }
        
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

  async handleSetup(event) {
    event.preventDefault();
    const password = document.getElementById('setup-password').value;
    const confirmation = document.getElementById('setup-password-confirm').value;
    const error = document.getElementById('setup-error');
    if (password !== confirmation) {
      error.textContent = 'Passwords do not match';
      error.classList.add('show');
      return;
    }

    const result = await window.electronAPI.setupAdmin({
      fullName: document.getElementById('setup-full-name').value.trim(),
      username: document.getElementById('setup-username').value.trim(),
      email: document.getElementById('setup-email').value.trim(),
      password
    });
    if (!result?.success) {
      error.textContent = result?.error || 'Administrator setup failed';
      error.classList.add('show');
      return;
    }
    this.showMode('login');
  }

  async handlePasswordChange(event) {
    event.preventDefault();
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmation = document.getElementById('new-password-confirm').value;
    const error = document.getElementById('change-password-error');
    if (newPassword !== confirmation) {
      error.textContent = 'Passwords do not match';
      error.classList.add('show');
      return;
    }

    const result = await window.electronAPI.changePassword({
      currentPassword,
      newPassword
    });
    if (!result?.success) {
      error.textContent = result?.error || 'Password change failed';
      error.classList.add('show');
      return;
    }

    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    localStorage.removeItem('user');
    this.showMode('login');
  }

  clearStoredAuth() {
    localStorage.removeItem('auth_token');
    sessionStorage.removeItem('auth_token');
    localStorage.removeItem('user');
  }

  togglePassword() {
    this.togglePasswordField(this.togglePasswordBtn, this.passwordInput);
  }

  togglePasswordField(button, input = document.getElementById(button?.dataset?.target || '')) {
    if (!button || !input) return;

    const type = input.type === 'password' ? 'text' : 'password';
    input.type = type;
    const isVisible = type === 'text';
    button.classList.toggle('is-visible', isVisible);
    button.setAttribute('aria-label', isVisible ? 'Hide password' : 'Show password');
    button.setAttribute('title', isVisible ? 'Hide password' : 'Show password');
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
    const lockIcon = this.loginButton.querySelector('.button-lock-icon');
    if (lockIcon) lockIcon.style.display = loading ? 'none' : 'inline';
    this.loginButton.querySelector('.button-text').style.display = loading ? 'none' : 'inline';
    this.loginButton.querySelector('.button-loader').style.display = loading ? 'inline' : 'none';
  }

}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new LoginManager();
});
