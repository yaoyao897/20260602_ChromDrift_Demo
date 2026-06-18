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

  const LEDGER_TABS = ['原材料', '生产过程', '生产物料', '数据汇总'];
  const SUMMARY_TYPES = [
    { value: '生产过程', label: '生产过程' },
    { value: '生产物料', label: '生产物料' },
  ];

  function emptyQuery() {
    return { batchNo: '', hasNewImpurity: '', enabled: '' };
  }

  function emptySummaryRow() {
    return { applyType: '生产过程', materialCode: 'CP002', qcpPoint: 'QCP02', batchNo: '2025060101' };
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

  const SUMMARY_META_COLUMNS = [
    { field: 'hasNewImpurity', title: '是否存在新杂', width: 110, showOverflow: true },
    { field: 'newImpurityInfo', title: '新杂信息', minWidth: 120, showOverflow: true },
    { field: 'hasExcessImpurity', title: '是否存在超标新杂', width: 130, showOverflow: true },
    { field: 'excessImpurityInfo', title: '超标新杂信息', minWidth: 120, showOverflow: true },
    { field: 'deviationIndicator', title: '偏差指标', minWidth: 110, showOverflow: true },
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
      <div class="ledger-lc-page">
        <el-tabs v-model="activeTab" class="demo-tabs" @tab-change="onTabChange">
          <el-tab-pane v-for="t in ledgerTabs" :key="t" :label="t" :name="t" />
        </el-tabs>

        <template v-if="activeTab !== '数据汇总'">
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
              <el-button type="primary" native-type="submit">查询</el-button>
              <el-button @click="resetQuery">重置</el-button>
            </template>
          </demo-query-panel>

          <demo-module-guide-card v-if="remarkMode" :guide="flow"></demo-module-guide-card>

          <div class="ledger-layout list-with-remark">
            <aside class="demo-card ledger-aside">
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

            <div class="demo-card list-main ledger-matrix" ref="listCardRef">
              <div class="list-toolbar">
                <span class="list-toolbar__title">数据列表</span>
                <div class="list-toolbar__actions">
                  <el-button @click="exportData">导出数据</el-button>
                  <el-button type="danger" @click="batchDelete">批量删除</el-button>
                  <demo-toolbar-icon-btn icon="columns" title="列设置" @click="toast('列设置')" />
                  <demo-toolbar-icon-btn icon="refresh" title="刷新列表" @click="refreshList" />
                  <demo-toolbar-icon-btn icon="fullscreen" title="全屏" @click="toggleFullscreen" />
                  <demo-toolbar-icon-btn icon="filter" title="自定义查询" @click="toast('自定义查询')" />
                </div>
              </div>

              <vxe-table
                ref="tableRef"
                :key="matrixTableKey"
                class="demo-table demo-table--wide demo-table--ledger-matrix"
                :data="pagedRows"
                border stripe
                height="400"
                :column-config="{ resizable: true, minWidth: 80, useKey: true }"
                :row-config="{ isHover: true, keyField: 'id' }"
                :row-class-name="matrixRowClassName"
                :checkbox-config="{ reserve: true, highlight: true, checkMethod: canCheckRow }"
                :scroll-x="{ enabled: true }"
                empty-text="请在左侧选择分类后查看数据"
                @checkbox-change="onSelChange"
                @checkbox-all="onSelChange"
              >
                <vxe-column
                  v-for="col in matrixColumns"
                  :key="matrixColumnKey(col)"
                  v-bind="col"
                />
              </vxe-table>

              <vxe-pager
                v-model:current-page="pageNum"
                v-model:page-size="pageSize"
                :page-sizes="pageSizes"
                :total="batchRowTotal"
                :layouts="['Total', 'Sizes', 'PrevPage', 'Number', 'NextPage', 'Jump']"
                style="margin-top:12px"
              />
            </div>
            <demo-remark-aside v-if="remarkMode" :remarks="remarks"></demo-remark-aside>
          </div>
        </template>

        <template v-else>
          <div class="demo-card ledger-summary-filter">
            <div class="ledger-summary-filter__title">样本过滤</div>
            <template v-if="remarkMode">
              <demo-field-remark
                v-for="fk in summaryFieldKeys"
                :key="fk"
                v-bind="fieldRemarkProps('ledgerSummary', fk)"
              />
            </template>
            <div v-for="(row, idx) in summaryFilters" :key="idx" class="ledger-summary-filter__row">
              <el-form :inline="true" size="default">
                <el-form-item label="类型" required>
                  <el-select v-model="row.applyType" style="width:120px">
                    <el-option v-for="o in summaryTypes" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
                <el-form-item label="物料信息" required>
                  <el-select v-model="row.materialCode" filterable style="width:140px">
                    <el-option
                      v-for="m in enabledMaterials"
                      :key="m.materialCode"
                      :label="m.materialCode + ' ' + m.materialName"
                      :value="m.materialCode"
                    />
                  </el-select>
                </el-form-item>
                <el-form-item label="QCP点" required>
                  <el-select v-model="row.qcpPoint" filterable style="width:140px">
                    <el-option v-for="q in qcpOptions" :key="q.qcpCode" :label="q.qcpCode" :value="q.qcpCode" />
                  </el-select>
                </el-form-item>
                <el-form-item label="批号" required>
                  <el-input v-model="row.batchNo" style="width:120px" />
                </el-form-item>
                <el-form-item>
                  <el-button v-if="summaryFilters.length > 1" link type="danger" @click="removeSummaryRow(idx)">删除</el-button>
                </el-form-item>
              </el-form>
            </div>
            <div class="ledger-summary-filter__actions">
              <el-button @click="addSummaryRow">添加行</el-button>
              <el-button type="primary" @click="doSummaryQuery">查询</el-button>
              <el-button @click="resetSummary">重置</el-button>
            </div>
          </div>

          <demo-module-guide-card v-if="remarkMode" :guide="flow"></demo-module-guide-card>

          <div class="list-with-remark">
            <div class="demo-card list-main ledger-matrix" ref="summaryCardRef">
              <div class="list-toolbar">
                <span class="list-toolbar__title">并集矩阵</span>
                <div class="list-toolbar__actions">
                  <el-button @click="exportSummary">导出数据</el-button>
                  <el-button type="danger" @click="toast('批量删除')">批量删除</el-button>
                  <demo-toolbar-icon-btn icon="columns" title="列设置" @click="toast('列设置')" />
                  <demo-toolbar-icon-btn icon="refresh" title="刷新" @click="doSummaryQuery" />
                  <demo-toolbar-icon-btn icon="fullscreen" title="全屏" @click="toggleSummaryFullscreen" />
                  <demo-toolbar-icon-btn icon="filter" title="自定义查询" @click="toast('自定义查询')" />
                </div>
              </div>
              <vxe-table
                :key="summaryTableKey"
                class="demo-table demo-table--wide demo-table--ledger-matrix"
                :data="summaryDisplayRows"
                border stripe
                height="400"
                :column-config="{ resizable: true, minWidth: 80, useKey: true }"
                :row-config="{ isHover: true, keyField: 'id' }"
                :row-class-name="matrixRowClassName"
                :checkbox-config="{ checkMethod: canCheckSummaryRow }"
                :scroll-x="{ enabled: true }"
                empty-text="请配置样本过滤条件后查询"
              >
                <vxe-column
                  v-for="col in summaryColumns"
                  :key="matrixColumnKey(col)"
                  v-bind="col"
                />
              </vxe-table>
            </div>
            <demo-remark-aside v-if="remarkMode" :remarks="remarks"></demo-remark-aside>
          </div>
        </template>

        <el-dialog v-model="catDlg" title="新增分类" width="520px" destroy-on-close>
          <el-form label-width="100px" size="default" :model="catForm" class="demo-dialog-form">
            <el-form-item v-if="activeTab === '生产过程'" label="QCP点" required>
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
              v-if="remarkMode && activeTab === '生产过程'"
              v-bind="fieldRemarkProps('ledgerCategory', 'qcpCode')"
            />
            <el-form-item v-else label="物料编码" required>
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
    },
    setup() {
      const summaryFieldKeys = ['applyType', 'materialInfo', 'qcpPoint', 'batchNo'];
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
      const tableRef = ref(null);
      const listCardRef = ref(null);
      const summaryCardRef = ref(null);

      const rtColumns = ref([]);
      const matrixRows = ref([]);
      const summaryFilters = ref([emptySummaryRow()]);
      const summaryRtColumns = ref([]);
      const summaryRows = ref([]);

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

      const summaryDisplayRows = computed(() => summaryRows.value.map(
        (r) => flattenMatrixRow(r, summaryRtColumns.value),
      ));

      const matrixTableKey = computed(() => `${activeTab.value}__${rtColumns.value.join('|')}`);

      const summaryTableKey = computed(() => `summary__${summaryRtColumns.value.join('|')}`);

      const matrixColumns = computed(() => [
        { type: 'checkbox', width: 42, fixed: 'left' },
        { type: 'seq', title: '序号', width: 55, fixed: 'left' },
        { field: 'status', title: '状态', width: 70, fixed: 'left', showOverflow: true },
        { field: 'rowLabel', title: '典型保留时间', width: 110, fixed: 'left', showOverflow: true },
        ...buildRtColumnDefs(rtColumns.value),
        ...MATRIX_META_COLUMNS,
      ]);

      const summaryColumns = computed(() => [
        { type: 'checkbox', width: 42, fixed: 'left' },
        { field: 'sourceType', title: '数据来源', width: 100, fixed: 'left', showOverflow: true },
        { field: 'qcpPoint', title: 'QCP点', width: 100, fixed: 'left', showOverflow: true },
        { field: 'rowLabel', title: '典型保留时间', width: 110, fixed: 'left', showOverflow: true },
        ...buildRtColumnDefs(summaryRtColumns.value),
        ...SUMMARY_META_COLUMNS,
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

      function canCheckSummaryRow({ row }) {
        return row.rowType === 'batch';
      }

      function onSelChange() {}

      function batchDelete() {
        const rows = tableRef.value?.getCheckboxRecords() || [];
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
          tableRef.value?.clearCheckboxRow();
          ElMessage.success('删除成功');
        }).catch(() => {});
      }

      function exportData() {
        const rows = tableRef.value?.getCheckboxRecords()?.length
          ? tableRef.value.getCheckboxRecords()
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
          : { materialCode: 'RM001', qcpCode: '' };
        catDlg.value = true;
      }

      function confirmAddCategory() {
        if (activeTab.value === '生产过程' && !catForm.value.qcpCode) {
          ElMessage.warning('请选择 QCP 点');
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

      function addSummaryRow() {
        summaryFilters.value.push(emptySummaryRow());
      }

      function removeSummaryRow(idx) {
        summaryFilters.value.splice(idx, 1);
      }

      function validateSummaryFilters() {
        for (const f of summaryFilters.value) {
          if (!f.applyType) return '请选择类型';
          if (!f.materialCode) return '请选择物料信息';
          if (!f.qcpPoint) return '请选择 QCP 点';
          if (!f.batchNo?.trim()) return '请填写批号';
        }
        return '';
      }

      function doSummaryQuery() {
        const err = validateSummaryFilters();
        if (err) {
          ElMessage.warning(err);
          return;
        }
        const result = LB.buildSummaryMatrix(
          ledger.value,
          summaryFilters.value,
          'LC',
          LB.optionsDriftRules(),
        );
        summaryRtColumns.value = result.rtColumns;
        summaryRows.value = result.rows;
        if (!result.rows.length) ElMessage.info('暂无匹配数据');
        else ElMessage.success('汇总完成');
      }

      function resetSummary() {
        summaryFilters.value = [emptySummaryRow()];
        summaryRtColumns.value = [];
        summaryRows.value = [];
      }

      function exportSummary() {
        if (!summaryRows.value.length) {
          ElMessage.warning('无数据可导出');
          return;
        }
        ElMessage.success('导出完成（Demo）');
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

      function toggleSummaryFullscreen() {
        const el = summaryCardRef.value;
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
        tableRef, listCardRef, summaryCardRef,
        canCheckRow, onSelChange, batchDelete, exportData, refreshList,
        canCheckSummaryRow, matrixRowClassName, matrixColumnKey,
        openAddCategory, catDlg, catForm, confirmAddCategory,
        enabledMaterials, qcpOptions,
        summaryFilters, summaryTypes: SUMMARY_TYPES,
        addSummaryRow, removeSummaryRow, doSummaryQuery, resetSummary,
        summaryRtColumns, summaryRows, summaryDisplayRows, summaryColumns, summaryTableKey, exportSummary,
        remarks, flow, remarkMode, summaryFieldKeys,
        fieldRemarkProps: ChromDriftFormFieldRemarks.fieldRemarkProps,
        toast,
        toggleFullscreen, toggleSummaryFullscreen, cellVal,
      };
    },
  };
})();
