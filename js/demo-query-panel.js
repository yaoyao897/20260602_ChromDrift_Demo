/**
 * 列表查询区 · §8 扁平 query-area（分割主钮查询 + 重置 + 展开/收起）
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
      visibleLimit: { type: Number, default: 4 },
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
        toggleExpand,
        onSubmit: () => emit('submit'),
      };
    },
    template: `
      <section class="query-area demo-query-panel">
        <div class="query-area__row demo-query-panel__row">
          <div class="query-area__fields demo-query-panel__fields">
            <el-form
              class="query-form demo-query-form"
              :class="{ 'is-expanded': expanded }"
              :model="model"
              size="default"
              label-width="auto"
              inline
              @submit.prevent="onSubmit"
            >
              <slot></slot>
            </el-form>
          </div>
          <div class="query-area__actions demo-query-form__actions">
            <slot name="actions"></slot>
            <el-button
              v-if="expandable"
              link
              type="primary"
              @click="toggleExpand"
            >{{ expanded ? '收起' : '展开' }}</el-button>
          </div>
        </div>
      </section>
    `,
  };

  window.ChromDriftQueryPanel = DemoQueryPanel;
  window.ChromDriftQueryField = DemoQueryField;
})();
