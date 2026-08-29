/**
 * Router
 * Maps navigation requests to renderer views and browser history state.
 */

class Router {
  constructor(app) {
    this.app = app;
    this.routes = new Map();
    this.notFoundHandler = null;
    this.currentRoute = null;
    
    window.addEventListener('popstate', () => this.handleCurrentRoute());
  }

  addRoute(path, handler) {
    this.routes.set(path, handler);
    return this;
  }

  setNotFound(handler) {
    this.notFoundHandler = handler;
    return this;
  }

  navigate(path) {
    const handler = this.routes.get(path);
    
    if (handler) {
      this.currentRoute = path;
      window.history.pushState({}, '', `#${path}`);
      handler();
    } else if (this.notFoundHandler) {
      this.notFoundHandler();
    }
  }

  handleCurrentRoute() {
    const hash = window.location.hash.slice(1) || 'dashboard';
    this.navigate(hash);
  }

  getCurrentRoute() {
    return this.currentRoute;
  }

  destroy() {
    window.removeEventListener('popstate', this.handleCurrentRoute);
  }
}

if (typeof window !== 'undefined') window.Router = Router;
if (typeof module !== 'undefined') module.exports = { Router };
