/**
 * 工具条 / 顶栏 · 圆形图标按钮（支持 SVG 或 emoji）
 */
(function () {
  const ICONS = {
    columns: '<path d="M128 160h192v192H128V160zm256 0h512v192H384V160zM128 416h192v192H128V416zm256 0h512v192H384V416zM128 672h192v192H128V672zm256 0h512v192H384V672z"/>',
    fullscreen: '<path d="M128 352V128h224v64H192v160H128zm768 0V192H736V128h224v224h-64zM352 896H128V672h64v160h160v64zm544-64V672h64v224H672v-64h224z"/>',
    filter: '<path d="M128 192h768l-288 352v240l-192 96V544L128 192zm128 64l192 234.667V704l64-32V490.667L576 256H256z"/>',
    refresh: '<path d="M771.776 794.88A384 384 0 0 1 128 512h64a320 320 0 0 0 555.712 216.448H672v-64h192v192h-64v-59.712zM276.288 295.712l90.496 90.496-45.248 45.248-90.496-90.496 45.248-45.248zm417.024 0l45.248 45.248-90.496 90.496-45.248-45.248 90.496-90.496zM512 128a384 384 0 0 1 367.776 271.104h-64.032A320 320 0 0 0 512 192a320 320 0 0 0-303.744 207.104H144.224A384 384 0 0 1 512 128z"/>',
    remark: '<path d="M128 160h768v704H128V160zm96 64v576h400V224H224zm496 0v576h96V224h-96z"/>',
    reset: '<path d="M289.088 289.088a384 384 0 0 1 556.16 556.16l-64.64-64.64a320 320 0 0 0-440.32-440.32l64.64-64.64-90.496-90.496-192 192 192 192 90.496-90.496z"/>',
  };

  function iconSvg(name) {
    const body = ICONS[name] || '';
    return `<svg class="toolbar-icon-btn__svg" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;
  }

  window.ChromDriftToolbarIconBtn = {
    name: 'DemoToolbarIconBtn',
    props: {
      icon: { type: String, default: '' },
      emoji: { type: String, default: '' },
      title: { type: String, required: true },
      active: { type: Boolean, default: false },
      placement: { type: String, default: 'top' },
    },
    emits: ['click'],
    computed: {
      svgHtml() {
        return this.icon ? iconSvg(this.icon) : '';
      },
    },
    template: `
      <el-tooltip :content="title" :placement="placement">
        <el-button
          class="toolbar-icon-btn"
          :class="{ 'toolbar-icon-btn--emoji': !!emoji }"
          circle
          :type="active ? 'primary' : 'default'"
          @click="$emit('click')"
        >
          <span v-if="emoji" class="toolbar-icon-btn__emoji">{{ emoji }}</span>
          <span v-else-if="icon" class="toolbar-icon-btn__icon" v-html="svgHtml"></span>
        </el-button>
      </el-tooltip>
    `,
  };

  window.ChromDriftToolbarIcons = { iconSvg, ICONS };
})();
