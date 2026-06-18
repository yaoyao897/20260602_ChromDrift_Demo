/**
 * 列表查询区：默认展示前 5 项并自适应铺满卡片，其余项展开后显示
 */
(function () {
  const { ref, computed, provide, inject } = Vue;

  const QUERY_PANEL_KEY = Symbol('demoQueryPanel');

  const DemoQueryField = {
    name: 'DemoQueryField',
    props: {
      label: { type: String, default: '' },
    },
    setup() {
      const panel = inject(QUERY_PANEL_KEY);
      const fieldIndex = panel.registerField();
      const isExtra = computed(() => fieldIndex >= panel.visibleLimit.value);
      const hidden = computed(() => isExtra.value && !panel.expanded.value);
      return { isExtra, hidden };
    },
    template: `
      <el-form-item
        v-show="!hidden"
        :label="label"
        class="demo-query-field"
        :class="{ 'demo-query-field--extra': isExtra }"
      >
        <slot></slot>
      </el-form-item>
    `,
  };

  const DemoQueryPanel = {
    name: 'DemoQueryPanel',
    components: { DemoQueryField },
    props: {
      model: { type: Object, default: () => ({}) },
      visibleLimit: { type: Number, default: 5 },
    },
    emits: ['submit'],
    setup(props, { emit }) {
      const expanded = ref(false);
      const fieldTotal = ref(0);
      let seq = 0;

      const visibleLimit = computed(() => props.visibleLimit);

      function registerField() {
        const index = seq;
        seq += 1;
        fieldTotal.value = seq;
        return index;
      }

      const gridColumns = computed(() => {
        const total = fieldTotal.value;
        const limit = props.visibleLimit;
        const firstRowCount = total ? Math.min(total, limit) : limit;
        return `repeat(${firstRowCount}, minmax(0, 1fr)) auto`;
      });

      const expandable = computed(() => fieldTotal.value > props.visibleLimit);

      function toggleExpand() {
        expanded.value = !expanded.value;
      }

      provide(QUERY_PANEL_KEY, {
        registerField,
        expanded,
        visibleLimit,
      });

      return {
        expanded,
        expandable,
        gridColumns,
        toggleExpand,
        onSubmit: () => emit('submit'),
      };
    },
    template: `
      <div class="demo-card demo-query-panel">
        <el-form
          class="demo-query-form"
          :class="{ 'is-expanded': expanded }"
          :model="model"
          size="default"
          label-width="auto"
          @submit.prevent="onSubmit"
        >
          <div class="demo-query-form__grid" :style="{ gridTemplateColumns: gridColumns }">
            <slot></slot>
            <div class="demo-query-form__actions">
              <slot name="actions"></slot>
              <el-button
                v-if="expandable"
                link
                type="primary"
                @click="toggleExpand"
              >{{ expanded ? '收起' : '展开' }}</el-button>
            </div>
          </div>
        </el-form>
      </div>
    `,
  };

  window.ChromDriftQueryPanel = DemoQueryPanel;
  window.ChromDriftQueryField = DemoQueryField;
})();
