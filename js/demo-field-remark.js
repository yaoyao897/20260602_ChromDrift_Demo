/**
 * ③ 表单项字段备注（备注模式开启时展示）
 */
(function () {
  const DemoFieldRemark = {
    name: 'DemoFieldRemark',
    props: {
      points: { type: Array, default: () => [] },
      label: { type: String, default: '' },
    },
    template: `
      <div v-if="points.length" class="demo-dev-remark demo-remark--field">
        <div v-if="label" class="demo-remark-field-name">{{ label }}</div>
        <ol class="demo-remark-olist">
          <li v-for="(line, idx) in points" :key="idx">{{ line }}</li>
        </ol>
      </div>
    `,
  };

  window.ChromDriftFieldRemark = DemoFieldRemark;
})();
