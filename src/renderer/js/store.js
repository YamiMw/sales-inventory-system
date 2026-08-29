/**
 * Store
 * Provides shared in-memory state and change notifications for renderer modules.
 */

class Store {
  constructor() {
    this.state = {
      products: [],
      categories: [],
      customers: [],
      inventory: [],
      settings: {},
      loading: false
    };
    this.listeners = [];
  }

  getState(key) {
    return key ? this.state[key] : this.state;
  }

  setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    this.notifyListeners(oldState);
  }

  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  notifyListeners(oldState) {
    this.listeners.forEach(listener => listener(this.state, oldState));
  }

  reset() {
    this.state = {
      products: [],
      categories: [],
      customers: [],
      inventory: [],
      settings: {},
      loading: false
    };
    this.notifyListeners({});
  }

  destroy() {
    this.listeners = [];
  }
}

if (typeof window !== 'undefined') window.Store = Store;
if (typeof module !== 'undefined') module.exports = { Store };
