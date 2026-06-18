/**
 * 全局备注模式开关（持久化）
 */
(function () {
  const KEY = 'ui:remark-mode';

  function readInitial() {
    const v = ChromDriftStorage.load(KEY, false);
    return v === true;
  }

  const state = Vue.ref(readInitial());
  Vue.watch(state, (v) => ChromDriftStorage.save(KEY, v));

  function toggle() {
    state.value = !state.value;
  }

  window.ChromDriftRemarkMode = { state, toggle };
})();
