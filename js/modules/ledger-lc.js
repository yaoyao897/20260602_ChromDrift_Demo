/**
 * M5 · LC 数据台账
 */
(function () {
  const { ref, computed, watch } = Vue;
  const { ElMessage, ElMessageBox } = ElementPlus;
  const { uid, nowStr, clone } = ChromDriftStorage;
  const { SEED_LEDGER_LC } = ChromDriftSeedLedgerLc;
  const { SEED_MATERIALS, SEED_QCP } = ChromDriftSeedMasters;
  const { PAGE_SIZES } = ChromDriftEnums;
  const LB = ChromDriftLedgerBuilder;

  const LEDGER_TABS = ['原材料', '生产过程', '生产物料'];

  function emptyQuery() {
    return { batchNo: '', hasNewImpurity: '', enabled: '' };
  }

  function cellVal(row, col) {
    const v = row.cells?.[col];
    return v == null || v === '' ? '/' : v;
  }

  function rtFieldKey(col) {
    return `rt_${String(col).replace(/\./g, '_')}`;
  }

  function flattenMatrixRow(row, rtCols) {
    const flat = { ...row };
    (rtCols || []).forEach((col) => {
      flat[rtFieldKey(col)] = cellVal(row, col);
    });
    return flat;
  }

  function buildRtColumnDefs(rtCols) {
    return (rtCols || []).map((col) => ({
      field: rtFieldKey(col),
      title: String(col),
      minWidth: 90,
      showOverflow: true,
    }));
  }

  const MATRIX_META_COLUMNS = [
    { field: 'hasNewImpurity', title: '是否存在新杂', width: 110, showOverflow: true },
    { field: 'newImpurityInfo', title: '新杂信息', minWidth: 120, showOverflow: true },
    { field: 'hasExcessImpurity', title: '是否存在超标新杂', width: 130, showOverflow: true },
    { field: 'excessImpurityInfo', title: '超标新杂信息', minWidth: 120, showOverflow: true },
    { field: 'deviationIndicator', title: '偏差指标', minWidth: 110, showOverflow: true },
    { field: 'createdAt', title: '创建时间', minWidth: 150, showOverflow: true, className: 'col-secondary' },
    { field: 'createdBy', title: '创建人', width: 80, showOverflow: true },
  ];

  function matrixColumnKey(col) {
    if (col.type) return `t_${col.type}`;
    return `f_${col.field}`;
  }

  function isMatrixSubheaderRow(row) {
    return row.isFixed || row.rowType === 'rrt' || row.rowType === 'structure';
  }

  window.ChromDriftLedgerLcPage = {
    name: 'LedgerLcPage',
    template: `
      <div class="page-module ledger-lc-page">
        <el-tabs v-model="activeTab" class="demo-tabs" @tab-change="onTabChange">
          <el-tab-pane v-for="t in ledgerTabs" :key="t" :label="t" :name="t" />
        </el-tabs>

        <demo-query-panel :model="query" @submit="doQuery">
            <demo-query-field label="批号">
              <el-input v-model="query.batchNo" clearable placeholder="模糊" @keyup.enter="doQuery" />
            </demo-query-field>
            <demo-query-field label="是否存在新杂">
              <el-select v-model="query.hasNewImpurity" clearable placeholder="全部">
                <el-option label="是" value="是" />
                <el-option label="/" value="/" />
              </el-select>
            </demo-query-field>
            <demo-query-field label="状态">
              <el-select v-model="query.enabled" clearable placeholder="全部">
                <el-option label="启用" value="1" />
                <el-option label="禁用" value="0" />
              </el-select>
            </demo-query-field>
            <template #actions>
              <el-dropdown split-button type="primary" @click="doQuery">
                查询
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item @click="toast('默认查询方案')">默认查询方案</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
              <el-button @click="resetQuery">重置</el-button>
            </template>
          </demo-query-panel>

          <demo-module-guide-card v-if="remarkMode" :guide="flow"></demo-module-guide-card>

          <div class="ledger-layout list-with-remark">
            <aside class="ledger-aside">
              <div class="ledger-aside__toolbar">
                <el-input v-model="treeKeyword" clearable placeholder="输入关键字" @keyup.enter="filterTree" />
                <el-button type="primary" @click="filterTree">查询</el-button>
              </div>
              <el-button class="ledger-aside__add" @click="openAddCategory">新增分类</el-button>
              <el-tree
                class="ledger-tree"
                :data="treeData"
                node-key="id"
                highlight-current
                :current-node-key="selectedCategoryId"
                :props="{ label: 'name', children: 'children' }"
                @node-click="onTreeSelect"
              />
            </aside>

            <section class="list-area list-main ledger-matrix" ref="listCardRef">
              <div class="list-toolbar">
                <div class="list-toolbar__info">
                  <span class="list-toolbar__title">数据列表</span>
                </div>
                <div class="list-toolbar__actions">
                  <el-button @click="exportData">导出数据</el-button>
                  <el-button type="danger" @click="batchDelete">批量删除</el-button>
                  <div class="list-toolbar__icons">
                    <demo-toolbar-icon-btn icon="columns" title="列设置" @click="toast('列设置')" />
                    <demo-toolbar-icon-btn icon="refresh" title="刷新列表" @click="refreshList" />
                    <demo-toolbar-icon-btn icon="fullscreen" title="全屏" @click="toggleFullscreen" />
                    <demo-toolbar-icon-btn icon="filter" title="自定义查询" @click="toast('自定义查询')" />
                  </div>
                </div>
              </div>

              <div class="list-body">
                <demo-vxe-wrap
                  ref="vxeWrapRef"
                  :key="matrixTableKey"
                  :show-table="pagedRows.length > 0"
                  empty-text="请在左侧选择分类后查看数据"
                  class="demo-table--wide demo-table--ledger-matrix"
                  :data="pagedRows"
                  :column-config="{ resizable: true, minWidth: 80, useKey: true }"
                  :row-config="{ isHover: true, keyField: 'id' }"
                  :row-class-name="matrixRowClassName"
                  :checkbox-config="{ reserve: true, highlight: true, checkMethod: canCheckRow }"
                  :scroll-x="{ enabled: true }"
                  @checkbox-change="onSelChange"
                  @checkbox-all="onSelChange"
                >
                  <vxe-column
                    v-for="col in matrixColumns"
                    :key="matrixColumnKey(col)"
                    v-bind="col"
                  />
                </demo-vxe-wrap>
                <div class="list-pager">
                  <el-pagination
                    v-model:current-page="pageNum"
                    v-model:page-size="pageSize"
                    :page-sizes="pageSizes"
                    :total="batchRowTotal"
                    layout="prev, pager, next, sizes, jumper, ->, total"
                  >
                    <template #total="{ total }">共 {{ total }} 条记录</template>
                  </el-pagination>
                </div>
              </div>
            </section>
            <demo-remark-aside v-if="remarkMode" :remarks="remarks"></demo-remark-aside>
          </div>

        <el-dialog v-model="catDlg" class="demo-dialog demo-dialog--biz" title="新增分类" width="520px" destroy-on-close>
          <el-form label-width="100px" size="default" :model="catForm" class="demo-dialog-form">
            <el-form-item v-if="activeTab !== '生产过程'" label="物料编码" required>
              <el-select v-model="catForm.materialCode" filterable style="width:100%">
                <el-option
                  v-for="m in enabledMaterials"
                  :key="m.materialCode"
                  :label="m.materialCode + ' ' + m.materialName"
                  :value="m.materialCode"
                />
              </el-select>
            </el-form-item>
            <demo-field-remark
              v-if="remarkMode && activeTab !== '生产过程'"
              v-bind="fieldRemarkProps('ledgerCategory', 'materialCode')"
            />
            <el-form-item label="采样点" required>
              <el-select v-model="catForm.qcpCode" filterable style="width:100%">
                <el-option
                  v-for="q in qcpOptions"
                  :key="q.qcpCode"
                  :label="q.qcpCode + ' ' + q.qcpName"
                  :value="q.qcpCode"
                />
              </el-select>
            </el-form-item>
            <demo-field-remark
              v-if="remarkMode"
              v-bind="fieldRemarkProps('ledgerCategory', 'qcpCode')"
            />
          </el-form>
          <template #footer>
            <el-button @click="catDlg = false">取消</el-button>
            <el-button type="primary" @click="confirmAddCategory">确定</el-button>
          </template>
        </el-dialog>
      </div>
    `,
    components: {
      DemoToolbarIconBtn: ChromDriftToolbarIconBtn,
      DemoRemarkAside: ChromDriftRemarkAside,
      DemoModuleGuideCard: ChromDriftModuleGuideCard,
      DemoQueryPanel: ChromDriftQueryPanel,
      DemoQueryField: ChromDriftQueryField,
      DemoFieldRemark: ChromDriftFieldRemark,
      DemoVxeWrap: ChromDriftVxeWrap,
    },
    setup() {
      const ledger = ref(ChromDriftStorage.load('ledger-lc-data', clone(SEED_LEDGER_LC)));
      watch(ledger, (v) => ChromDriftStorage.save('ledger-lc-data', v), { deep: true });

      const activeTab = ref('原材料');
      const query = ref(emptyQuery());
      const appliedQuery = ref({});
      const treeKeyword = ref('');
      const appliedTreeKeyword = ref('');
      const selectedCategoryId = ref('');
      const pageNum = ref(1);
      const pageSize = ref(10);
      const vxeWrapRef = ref(null);
      const listCardRef = ref(null);

      function getTable() {
        return vxeWrapRef.value?.getTable?.() || null;
      }

      const rtColumns = ref([]);
      const matrixRows = ref([]);

      const catDlg = ref(false);
      const catForm = ref({ materialCode: '', qcpCode: '' });

      const remarks = computed(() => ChromDriftRemarks.getPageRemarks('ledger-lc'));
      const flow = computed(() => ChromDriftRemarks.getPageFlow('ledger-lc'));
      const remarkMode = ChromDriftRemarkMode.state;

      const enabledMaterials = computed(() => SEED_MATERIALS.filter((m) => m.enabled !== false));
      const qcpOptions = computed(() => SEED_QCP.filter((q) => q.enabled !== false));

      const treeData = computed(() => {
        const kw = appliedTreeKeyword.value.trim().toLowerCase();
        return ledger.value.categories
          .filter((c) => c.applyType === activeTab.value && c.ledgerType === 'LC')
          .filter((c) => !kw || c.name.toLowerCase().includes(kw))
          .map((c) => ({ id: c.id, name: c.name }));
      });

      const pagedRows = computed(() => {
        const fixed = matrixRows.value.filter((r) => r.isFixed);
        const batches = matrixRows.value.filter((r) => !r.isFixed);
        const start = (pageNum.value - 1) * pageSize.value;
        const cols = rtColumns.value;
        return [...fixed, ...batches.slice(start, start + pageSize.value)]
          .map((r) => flattenMatrixRow(r, cols));
      });

      const batchRowTotal = computed(() => matrixRows.value.filter((r) => !r.isFixed).length);

      const matrixTableKey = computed(() => `${activeTab.value}__${rtColumns.value.join('|')}`);

      const matrixColumns = computed(() => [
        { type: 'checkbox', width: 42, fixed: 'left' },
        { type: 'seq', title: '序号', width: 55, fixed: 'left' },
        { field: 'status', title: '状态', width: 70, fixed: 'left', showOverflow: true },
        { field: 'rowLabel', title: '典型保留时间', width: 110, fixed: 'left', showOverflow: true },
        ...buildRtColumnDefs(rtColumns.value),
        ...MATRIX_META_COLUMNS,
      ]);

      function matrixRowClassName({ row }) {
        return isMatrixSubheaderRow(row) ? 'ledger-matrix-subheader' : '';
      }

      function persistAndRefresh() {
        ChromDriftStorage.save('ledger-lc-data', ledger.value);
        refreshMatrix();
      }

      function refreshMatrix() {
        if (!selectedCategoryId.value) {
          rtColumns.value = [];
          matrixRows.value = [];
          return;
        }
        const result = LB.buildTabMatrix(
          ledger.value,
          activeTab.value,
          selectedCategoryId.value,
          appliedQuery.value,
          'LC',
          LB.optionsDriftRules(),
        );
        rtColumns.value = result.rtColumns;
        matrixRows.value = result.rows;
      }

      function onTabChange() {
        selectedCategoryId.value = '';
        treeKeyword.value = '';
        appliedTreeKeyword.value = '';
        query.value = emptyQuery();
        appliedQuery.value = {};
        pageNum.value = 1;
        refreshMatrix();
      }

      function filterTree() {
        appliedTreeKeyword.value = treeKeyword.value;
        if (!treeKeyword.value.trim()) {
          selectedCategoryId.value = '';
        }
        pageNum.value = 1;
        refreshMatrix();
      }

      function onTreeSelect(node) {
        selectedCategoryId.value = node.id;
        pageNum.value = 1;
        refreshMatrix();
      }

      function doQuery() {
        appliedQuery.value = { ...query.value };
        pageNum.value = 1;
        refreshMatrix();
        ElMessage.success('查询完成');
      }

      function resetQuery() {
        query.value = emptyQuery();
        appliedQuery.value = {};
        pageNum.value = 1;
        refreshMatrix();
      }

      function refreshList() {
        refreshMatrix();
        ElMessage.success('列表已刷新');
      }

      function canCheckRow({ row }) {
        return row.rowType === 'batch' && row.enabled !== false;
      }

      function onSelChange() {}

      function batchDelete() {
        const rows = getTable()?.getCheckboxRecords() || [];
        if (!rows.length) {
          ElMessage.warning('请勾选批号行');
          return;
        }
        if (rows.some((r) => r.isFixed)) {
          ElMessage.warning('固定行不可删除');
          return;
        }
        ElMessageBox.confirm(`确定删除选中的 ${rows.length} 条批号行？`, '批量删除', {
          type: 'warning',
        }).then(() => {
          const byCat = {};
          rows.forEach((r) => {
            if (!byCat[r.categoryId]) byCat[r.categoryId] = [];
            byCat[r.categoryId].push(r.id);
          });
          let err = '';
          Object.keys(byCat).forEach((catId) => {
            const res = LB.deleteBatchRows(ledger.value, catId, byCat[catId]);
            if (res.error) err = res.error;
          });
          if (err) {
            ElMessage.warning(err);
            return;
          }
          persistAndRefresh();
          getTable()?.clearCheckboxRow();
          ElMessage.success('删除成功');
        }).catch(() => {});
      }

      function exportData() {
        const rows = getTable()?.getCheckboxRecords()?.length
          ? getTable().getCheckboxRecords()
          : matrixRows.value.filter((r) => r.rowType === 'batch');
        if (!rows.length) {
          ElMessage.warning('无数据可导出');
          return;
        }
        const header = ['行标签', '是否存在新杂', '偏差指标', '创建时间'];
        const lines = rows.map((r) => [
          r.rowLabel, r.hasNewImpurity, r.deviationIndicator, r.createdAt,
        ].join(','));
        const blob = new Blob([`\ufeff${[header.join(','), ...lines].join('\n')}`], { type: 'text/csv' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'LC数据台账.csv';
        a.click();
        ElMessage.success('导出完成');
      }

      function openAddCategory() {
        catForm.value = activeTab.value === '生产过程'
          ? { materialCode: '', qcpCode: 'QCP02' }
          : { materialCode: 'RM001', qcpCode: 'QCP01' };
        catDlg.value = true;
      }

      function confirmAddCategory() {
        if (!catForm.value.qcpCode) {
          ElMessage.warning('请选择采样点');
          return;
        }
        if (activeTab.value !== '生产过程' && !catForm.value.materialCode) {
          ElMessage.warning('请选择物料编码');
          return;
        }
        const q = qcpOptions.value.find((x) => x.qcpCode === catForm.value.qcpCode);
        const res = LB.addCategory(ledger.value, {
          applyType: activeTab.value,
          materialCode: catForm.value.materialCode,
          qcpPoint: catForm.value.qcpCode,
          qcpName: q?.qcpName || '',
          ledgerType: 'LC',
        });
        if (res.error) {
          ElMessage.warning(res.error);
          return;
        }
        catDlg.value = false;
        if (res.category?.id) selectedCategoryId.value = res.category.id;
        persistAndRefresh();
        ElMessage.success('分类已新增');
      }

      function toast(msg) {
        ElMessage.info(`${msg}（Demo 占位）`);
      }

      function toggleFullscreen() {
        const el = listCardRef.value;
        if (!el) return;
        if (!document.fullscreenElement) el.requestFullscreen?.();
        else document.exitFullscreen?.();
      }

      refreshMatrix();

      return {
        ledgerTabs: LEDGER_TABS,
        activeTab, onTabChange,
        query, doQuery, resetQuery,
        treeKeyword, filterTree, treeData, selectedCategoryId, onTreeSelect,
        rtColumns, matrixRows, pagedRows, batchRowTotal, matrixColumns, matrixTableKey,
        pageNum, pageSize, pageSizes: PAGE_SIZES,
        vxeWrapRef, listCardRef,
        canCheckRow, onSelChange, batchDelete, exportData, refreshList,
        matrixRowClassName, matrixColumnKey,
        openAddCategory, catDlg, catForm, confirmAddCategory,
        enabledMaterials, qcpOptions,
        remarks, flow, remarkMode,
        fieldRemarkProps: ChromDriftFormFieldRemarks.fieldRemarkProps,
        toast,
        toggleFullscreen, cellVal,
      };
    },
  };
})();
