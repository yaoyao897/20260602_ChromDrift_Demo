(function () {
  const DEMO_PREFIX = 'chrom-drift-demo-v1:';

  function clone(v) {
    return JSON.parse(JSON.stringify(v));
  }

  function debounce(fn, ms) {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  }

  function readRaw(key) {
    try {
      const raw = localStorage.getItem(DEMO_PREFIX + key);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function load(key, seed) {
    const data = readRaw(key);
    return data != null ? data : clone(seed);
  }

  function loadArray(key, seed) {
    const data = readRaw(key);
    return Array.isArray(data) ? data : clone(seed);
  }

  function save(key, data) {
    try {
      localStorage.setItem(DEMO_PREFIX + key, JSON.stringify(data));
    } catch (e) {
      if (e?.name === 'QuotaExceededError') {
        console.warn('localStorage 已满', key);
        if (window.ElMessage) window.ElMessage.warning('本地存储已满，请使用「恢复初始数据」');
      }
    }
  }

  function clearAll() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(DEMO_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  }

  function uid() {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  function nowStr() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  /** 带防抖持久化的 ref（§9.3） */
  function usePersistedRef(key, seed, debounceMs = 400) {
    const Vue = window.Vue;
    if (!Vue) return { value: loadArray(key, seed) };
    const state = Vue.ref(loadArray(key, seed));
    const persist = debounce((v) => save(key, v), debounceMs);
    Vue.watch(state, persist, { deep: true });
    return state;
  }

  window.ChromDriftStorage = {
    DEMO_PREFIX,
    load,
    loadArray,
    save,
    clearAll,
    clone,
    uid,
    nowStr,
    debounce,
    usePersistedRef,
  };
})();
