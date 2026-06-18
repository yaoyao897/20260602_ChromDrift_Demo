/**
 * 列表状态标签 · §5 规范（禁止 el-tag）
 */
(function () {
  window.ChromDriftStatusTag = {
    name: 'DemoStatusTag',
    props: {
      enabled: { type: Boolean, default: true },
      onText: { type: String, default: '启用' },
      offText: { type: String, default: '禁用' },
    },
    template: `
      <span class="tag" :class="enabled ? 'tag-g' : 'tag-gr'">{{ enabled ? onText : offText }}</span>
    `,
  };
})();
