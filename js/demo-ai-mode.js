/**
 * 全局 AI 助理开关（持久化）
 */
(function () {
  const KEY = 'ui:ai-mode';

  function readInitial() {
    const v = ChromDriftStorage.load(KEY, false);
    return v === true;
  }

  const state = Vue.ref(readInitial());
  Vue.watch(state, (v) => ChromDriftStorage.save(KEY, v));

  function toggle() {
    state.value = !state.value;
  }

  function close() {
    state.value = false;
  }

  window.ChromDriftAiMode = { state, toggle, close };
})();
