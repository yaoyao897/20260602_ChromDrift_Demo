/**
 * 模块说明卡（④ 数据流转）+ 右侧备注卡（①②）
 * 流程图使用 Mermaid 渲染
 */
(function () {
  const { ref, watch, onMounted, nextTick } = Vue;

  let mermaidReady = null;

  function loadMermaidScript() {
    if (typeof mermaid !== 'undefined') return Promise.resolve(true);
    if (window.__cdMermaidLoading) return window.__cdMermaidLoading;
    window.__cdMermaidLoading = new Promise((resolve) => {
      const s = document.createElement('script');
      s.src = 'js/vendor/mermaid.min.js';
      s.async = true;
      s.onload = () => resolve(typeof mermaid !== 'undefined');
      s.onerror = () => resolve(false);
      document.head.appendChild(s);
    });
    return window.__cdMermaidLoading;
  }

  function ensureMermaid() {
    if (mermaidReady) return mermaidReady;
    mermaidReady = loadMermaidScript().then((ok) => {
      if (!ok || typeof mermaid === 'undefined') return false;
      mermaid.initialize({
        startOnLoad: false,
        theme: 'neutral',
        securityLevel: 'strict',
        flowchart: { useMaxWidth: true, htmlLabels: true, curve: 'basis' },
      });
      return true;
    });
    return mermaidReady;
  }

  const DemoModuleGuideCard = {
    name: 'DemoModuleGuideCard',
    props: { guide: { type: Object, default: null } },
    template: `
      <section v-if="guide" class="demo-module-guide">
        <div class="demo-module-guide__header">
          <span class="demo-module-guide__title">④ 模块说明与数据流转 · {{ guide.title }}</span>
          <el-button link type="primary" @click="toggleCollapse">{{ collapsed ? '展开' : '收起' }}</el-button>
        </div>
        <div v-show="!collapsed" class="demo-module-guide__body">
          <div v-if="guide.summary && guide.summary.length" class="demo-module-guide__section">
            <h5>产品定位</h5>
            <ol><li v-for="(p, i) in guide.summary" :key="'s'+i">{{ p }}</li></ol>
          </div>
          <div
            v-for="sec in guide.sections"
            :key="sec.title"
            class="demo-module-guide__section"
          >
            <h5>{{ sec.title }}</h5>
            <ol v-if="sec.points"><li v-for="(p, j) in sec.points" :key="j">{{ p }}</li></ol>
          </div>
          <div v-if="guide.steps && guide.steps.length" class="demo-module-guide__section">
            <h5>主链路步骤</h5>
            <ol><li v-for="s in guide.steps" :key="s.seq">{{ s.seq }}. {{ s.name }}：{{ s.desc }}</li></ol>
          </div>
          <div v-if="guide.mermaid" class="demo-module-guide__section">
            <h5>数据流转图</h5>
            <div class="demo-module-guide__mermaid" ref="mermaidHost"></div>
          </div>
        </div>
      </section>
    `,
    setup(props) {
      const mermaidHost = ref(null);
      const collapsed = ref(false);
      let renderSeq = 0;

      async function renderMermaid() {
        if (!props.guide?.mermaid || !mermaidHost.value || collapsed.value) return;
        const ok = await ensureMermaid();
        if (!ok) {
          mermaidHost.value.innerHTML = `<pre class="demo-mermaid-fallback">${props.guide.mermaid}</pre>`;
          return;
        }
        const seq = ++renderSeq;
        const id = `cd-mmd-${Date.now()}-${seq}`;
        try {
          const { svg } = await mermaid.render(id, props.guide.mermaid.trim());
          if (seq !== renderSeq || !mermaidHost.value) return;
          mermaidHost.value.innerHTML = svg;
        } catch (e) {
          if (mermaidHost.value) {
            mermaidHost.value.innerHTML = `<pre class="demo-mermaid-fallback">${props.guide.mermaid}</pre>`;
          }
        }
      }

      function toggleCollapse() {
        collapsed.value = !collapsed.value;
        if (!collapsed.value) nextTick(renderMermaid);
      }

      onMounted(() => nextTick(renderMermaid));
      watch(() => props.guide?.mermaid, () => nextTick(renderMermaid));
      watch(() => props.guide, () => nextTick(renderMermaid));

      return { mermaidHost, collapsed, toggleCollapse };
    },
  };

  const DemoRemarkAside = {
    name: 'DemoRemarkAside',
    props: { remarks: Object },
    template: `
      <aside v-if="remarks" class="demo-dev-remark">
        <div>
          <h4>① 列表数据源 · {{ remarks.title }}</h4>
          <ol><li v-for="(p,i) in remarks.dataSource" :key="'d'+i">{{ p }}</li></ol>
        </div>
        <hr class="demo-dev-remark-divider" />
        <div>
          <h4>② 按钮功能交互</h4>
          <div v-for="act in remarks.actions" :key="act.title" class="demo-dev-remark-action">
            <strong>{{ act.title }}</strong>
            <ol><li v-for="(p,j) in act.points" :key="'a'+j">{{ p }}</li></ol>
          </div>
        </div>
      </aside>
    `,
  };

  window.ChromDriftModuleGuideCard = DemoModuleGuideCard;
  window.ChromDriftRemarkAside = DemoRemarkAside;
})();
