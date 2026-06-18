/**
 * 色谱漂移 Demo · 应用入口
 */
(function boot() {
  function showBootError(msg) {
    const el = document.getElementById('boot-error');
    if (el) {
      el.style.display = 'block';
      el.textContent = msg;
    }
  }

  if (typeof Vue === 'undefined' || typeof ElementPlus === 'undefined') {
    showBootError('依赖加载失败：未找到 Vue 或 Element Plus。\n请通过 HTTP 服务访问（./ChromDrift_Demo.sh），勿用 file:// 打开。');
    return;
  }
  if (typeof VxeUI === 'undefined' || typeof VxeUITable === 'undefined') {
    showBootError('依赖加载失败：未找到 VxeUI / VxeUITable。\n请确认 js/vendor 下 vxe 相关文件完整。');
    return;
  }
  if (!window.ChromDriftDriftRulePage) {
    showBootError('模块加载失败：未找到 ChromDriftDriftRulePage。');
    return;
  }
  if (!window.ChromDriftWarningRulePage) {
    showBootError('模块加载失败：未找到 ChromDriftWarningRulePage。');
    return;
  }
  if (!window.ChromDriftRecognitionPage) {
    showBootError('模块加载失败：未找到 ChromDriftRecognitionPage。');
    return;
  }
  if (!window.ChromDriftLedgerGcPage) {
    showBootError('模块加载失败：未找到 ChromDriftLedgerGcPage。');
    return;
  }
  if (!window.ChromDriftLedgerLcPage) {
    showBootError('模块加载失败：未找到 ChromDriftLedgerLcPage。');
    return;
  }
  if (!window.ChromDriftToolbarIconBtn) {
    showBootError('模块加载失败：未找到 ChromDriftToolbarIconBtn。');
    return;
  }
  if (!window.ChromDriftRemarkAside || !window.ChromDriftModuleGuideCard) {
    showBootError('模块加载失败：未找到 ChromDriftRemarkAside / ChromDriftModuleGuideCard。');
    return;
  }
  if (!window.ChromDriftQueryPanel || !window.ChromDriftQueryField) {
    showBootError('模块加载失败：未找到 ChromDriftQueryPanel。');
    return;
  }
  if (!window.ChromDriftRemarkMode) {
    showBootError('模块加载失败：未找到 ChromDriftRemarkMode。');
    return;
  }
  if (!window.ChromDriftAiMode) {
    showBootError('模块加载失败：未找到 ChromDriftAiMode。');
    return;
  }

  const { createApp, ref, computed } = Vue;
  const { ElMessage, ElMessageBox } = ElementPlus;
  window.ElMessage = ElMessage;

  VxeUI.setConfig({ theme: 'default', zIndex: 3000 });

  const MODULES = [
    { id: 'drift-rule', label: '漂移规则设置', breadcrumb: '首页 > 漂移规则设置', hasTabs: false },
    { id: 'warning-rule', label: '偏差预警设置', breadcrumb: '首页 > 偏差预警设置', hasTabs: false },
    { id: 'recognition', label: '图谱识别', breadcrumb: '首页 > 图谱识别', hasTabs: false },
    { id: 'ledger-gc', label: 'GC 数据台账', breadcrumb: '首页 > GC数据台账', hasTabs: false },
    { id: 'ledger-lc', label: 'LC 数据台账', breadcrumb: '首页 > LC数据台账', hasTabs: false },
  ];

  const LEDGER_TABS = ['原材料', '生产过程', '生产物料', '数据汇总'];

  const DemoRemarkAside = ChromDriftRemarkAside;

  createApp({
    components: {
      DemoRemarkAside,
      DemoModuleGuideCard: ChromDriftModuleGuideCard,
      DemoQueryPanel: ChromDriftQueryPanel,
      DemoQueryField: ChromDriftQueryField,
      DriftRulePage: ChromDriftDriftRulePage,
      WarningRulePage: ChromDriftWarningRulePage,
      RecognitionPage: ChromDriftRecognitionPage,
      LedgerGcPage: ChromDriftLedgerGcPage,
      LedgerLcPage: ChromDriftLedgerLcPage,
      DemoToolbarIconBtn: ChromDriftToolbarIconBtn,
    },
    setup() {
      const currentPage = ref('drift-rule');
      const defaultOpeneds = ref(['chrom-drift']);
      const ledgerTab = ref('原材料');
      const queryForm = ref({});
      const tableData = ref([]);
      const pageSizes = [10, 50, 100, 500, 1000, 1500];
      const pageSize = ref(10);
      const currentPageNum = ref(1);

      const activeModule = computed(() => MODULES.find((m) => m.id === currentPage.value) || MODULES[0]);
      const pageTitle = computed(() => activeModule.value.label);
      const breadcrumb = computed(() => activeModule.value.breadcrumb);
      const pageRemarks = computed(() => ChromDriftRemarks.getPageRemarks(currentPage.value));
      const pageFlow = computed(() => ChromDriftRemarks.getPageFlow(currentPage.value));
      const showLedgerTabs = computed(() => activeModule.value.hasTabs);
      const remarkMode = ChromDriftRemarkMode.state;
      const aiMode = ChromDriftAiMode.state;

      function toggleRemarkMode() {
        ChromDriftRemarkMode.toggle();
      }

      function toggleAiMode() {
        ChromDriftAiMode.toggle();
      }

      function closeAiMode() {
        ChromDriftAiMode.close();
      }

      function onMenuSelect(id) {
        currentPage.value = id;
        queryForm.value = {};
        tableData.value = [];
        if (activeModule.value.hasTabs) ledgerTab.value = '原材料';
        currentPageNum.value = 1;
      }

      function onQuery() {
        ElMessage.success('查询（骨架占位）');
      }

      function onResetQuery() {
        queryForm.value = {};
        ElMessage.info('已重置查询条件');
      }

      function onRefreshList() {
        ElMessage.success('列表已刷新');
      }

      function toastPlaceholder(name) {
        ElMessage.info(`${name}（模块实现后接入）`);
      }

      function resetDemo() {
        ElMessageBox.confirm('清空本地缓存并恢复种子数据？', '恢复初始数据', {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning',
        }).then(() => {
          ChromDriftStorage.clearAll();
          location.reload();
        }).catch(() => {});
      }

      return {
        modules: MODULES,
        defaultOpeneds,
        currentPage,
        pageTitle,
        breadcrumb,
        pageRemarks,
        pageFlow,
        remarkMode,
        toggleRemarkMode,
        aiMode,
        toggleAiMode,
        closeAiMode,
        showLedgerTabs,
        ledgerTabs: LEDGER_TABS,
        ledgerTab,
        queryForm,
        tableData,
        pageSizes,
        pageSize,
        currentPageNum,
        onMenuSelect,
        onQuery,
        onResetQuery,
        onRefreshList,
        toastPlaceholder,
        resetDemo,
      };
    },
  })
    .use(VxeUI)
    .use(VxeUITable)
    .use(ElementPlus, { size: 'default' })
    .mount('#app');
})();
