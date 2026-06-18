/**
 * VXE 表格容器 · §4.3 DemoVxeGrid 封装（vxe-table + 列插槽）
 * 高度：按 .list-body 剩余高度占满（行多时在表体内滚动）
 */
(function () {
  const { ref, onMounted, onBeforeUnmount, nextTick, watch } = Vue;

  window.ChromDriftVxeWrap = {
    name: 'DemoVxeWrap',
    props: {
      emptyText: { type: String, default: '暂无数据' },
      showTable: { type: Boolean, default: true },
      minHeight: { type: Number, default: 200 },
    },
    inheritAttrs: false,
    template: `
      <div ref="wrapRef" class="demo-vxe-wrap">
        <vxe-table
          v-if="showTable"
          ref="tableRef"
          class="demo-vxe-grid demo-table"
          border
          stripe
          size="small"
          show-overflow="tooltip"
          v-bind="$attrs"
          :height="gridHeight"
        >
          <slot></slot>
        </vxe-table>
        <el-empty v-else :description="emptyText" />
      </div>
    `,
    setup(props, { expose, attrs }) {
      const wrapRef = ref(null);
      const tableRef = ref(null);
      const gridHeight = ref(280);
      let resizeObserver = null;
      const observed = new Set();

      function getListBodyEl() {
        return wrapRef.value?.closest('.list-body') || null;
      }

      function measureHeight() {
        const bodyEl = getListBodyEl();
        if (bodyEl) {
          const pagerEl = bodyEl.querySelector('.list-pager');
          const pagerH = pagerEl ? pagerEl.offsetHeight : 0;
          return Math.max(props.minHeight, bodyEl.clientHeight - pagerH);
        }
        if (wrapRef.value) {
          return Math.max(props.minHeight, wrapRef.value.clientHeight);
        }
        return props.minHeight;
      }

      function updateGridHeight() {
        gridHeight.value = measureHeight();
        nextTick(() => tableRef.value?.recalculate?.());
      }

      function scheduleUpdate() {
        nextTick(() => {
          updateGridHeight();
          nextTick(updateGridHeight);
        });
      }

      function observeEl(el) {
        if (!el || !resizeObserver || observed.has(el)) return;
        observed.add(el);
        resizeObserver.observe(el);
      }

      function bindObservers() {
        observeEl(wrapRef.value);
        observeEl(getListBodyEl());
        observeEl(wrapRef.value?.closest('.list-area'));
        observeEl(wrapRef.value?.closest('.list-with-remark'));
        observeEl(wrapRef.value?.closest('.page-module'));
      }

      onMounted(() => {
        resizeObserver = new ResizeObserver(scheduleUpdate);
        bindObservers();
        scheduleUpdate();
        window.addEventListener('resize', scheduleUpdate);
      });

      watch(() => attrs.data, scheduleUpdate, { deep: true });
      watch(() => props.showTable, () => {
        nextTick(() => {
          bindObservers();
          scheduleUpdate();
        });
      });

      onBeforeUnmount(() => {
        resizeObserver?.disconnect();
        observed.clear();
        window.removeEventListener('resize', scheduleUpdate);
      });

      expose({
        getTable: () => tableRef.value,
        recalculate: () => {
          scheduleUpdate();
          return tableRef.value?.recalculate?.();
        },
      });

      return { wrapRef, tableRef, gridHeight };
    },
  };
})();
