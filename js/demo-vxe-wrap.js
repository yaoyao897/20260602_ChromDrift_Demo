/**
 * VXE 表格容器 · §4.3 DemoVxeGrid 封装（vxe-table + 列插槽）
 * 高度：ResizeObserver 占满列表区剩余视口（行多时在表体内滚动）
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
    setup(props, { expose }) {
      const wrapRef = ref(null);
      const tableRef = ref(null);
      const gridHeight = ref(280);
      let resizeObserver = null;

      function updateGridHeight() {
        if (!wrapRef.value) return;
        gridHeight.value = Math.max(props.minHeight, wrapRef.value.clientHeight);
        nextTick(() => tableRef.value?.recalculate?.());
      }

      function scheduleUpdate() {
        nextTick(() => {
          updateGridHeight();
          nextTick(updateGridHeight);
        });
      }

      onMounted(() => {
        scheduleUpdate();
        resizeObserver = new ResizeObserver(scheduleUpdate);
        if (wrapRef.value) resizeObserver.observe(wrapRef.value);
        const bodyEl = wrapRef.value?.closest('.list-body');
        if (bodyEl) resizeObserver.observe(bodyEl);
        window.addEventListener('resize', scheduleUpdate);
      });

      watch(() => props.showTable, scheduleUpdate);

      onBeforeUnmount(() => {
        resizeObserver?.disconnect();
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
