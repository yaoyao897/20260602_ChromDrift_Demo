/**
 * M6 · GC / LC 数据比对（由原台账「数据汇总」Tab 拆分为独立菜单）
 */
(function () {
  const { ref, computed, onMounted } = Vue;
  const { ElMessage } = ElementPlus;
  const { clone } = ChromDriftStorage;
  const { SEED_MATERIALS, SEED_QCP } = ChromDriftSeedMasters;
  const LB = ChromDriftLedgerBuilder;

  const SUMMARY_TYPES = [
    { value: '生产过程', label: '生产过程' },
    { value: '生产物料', label: '生产物料' },
  ];

  const IMPORT_HEADERS = ['类型', '物料信息', '采样点', '批号'];

  const SUMMARY_META_COLUMNS = [
    { field: 'hasNewImpurity', title: '是否存在新杂', width: 110, showOverflow: true },
    { field: 'newImpurityInfo', title: '新杂信息', minWidth: 120, showOverflow: true },
    { field: 'hasExcessImpurity', title: '是否存在超标新杂', width: 130, showOverflow: true },
    { field: 'excessImpurityInfo', title: '超标新杂信息', minWidth: 120, showOverflow: true },
    { field: 'deviationIndicator', title: '偏差指标', minWidth: 110, showOverflow: true },
  ];

  function emptySummaryRow() {
    return { applyType: '生产过程', materialCode: 'CP001', qcpPoint: 'QCP01', batchNo: '2025042801' };
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

  function matrixColumnKey(col) {
    if (col.type) return `t_${col.type}`;
    return `f_${col.field}`;
  }

  function isMatrixSubheaderRow(row) {
    return row.isFixed || row.rowType === 'rrt' || row.rowType === 'structure';
  }

  function parseCsvLine(line) {
    const cells = [];
    let cur = '';
    let inQuote = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        inQuote = !inQuote;
      } else if (ch === ',' && !inQuote) {
        cells.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  }

  function parseImportCsv(text) {
    const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) return { error: '导入文件至少需要表头与一行数据' };
    const header = parseCsvLine(lines[0]);
    const idx = {
      applyType: header.indexOf('类型'),
      materialCode: header.indexOf('物料信息'),
      qcpPoint: header.indexOf('采样点'),
      batchNo: header.indexOf('批号'),
    };
    if (Object.values(idx).some((i) => i < 0)) {
      return { error: `表头须包含：${IMPORT_HEADERS.join('、')}` };
    }
    const rows = [];
    for (let i = 1; i < lines.length; i += 1) {
      const cols = parseCsvLine(lines[i]);
      if (!cols.some((c) => c)) continue;
      rows.push({
        applyType: cols[idx.applyType] || '',
        materialCode: cols[idx.materialCode] || '',
        qcpPoint: cols[idx.qcpPoint] || '',
        batchNo: cols[idx.batchNo] || '',
        lineNo: i + 1,
      });
    }
    if (!rows.length) return { error: '未解析到有效数据行' };
    return { rows };
  }

  function createComparePage(config) {
    const {
      name, exportKey, ledgerType, storageKey, seedData, remarkPageId, pageClass,
      defaultSummaryFilters,
    } = config;

    function initialSummaryRows() {
      const rows = defaultSummaryFilters?.length
        ? clone(defaultSummaryFilters)
        : [emptySummaryRow()];
      return rows;
    }

    return {
      name,
      template: `
      <div class="page-module ${pageClass}">
        <div class="ledger-summary-filter">
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
              <el-form-item label="采样点" required>
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
            <el-button @click="downloadImportTemplate">下载模板</el-button>
            <el-button @click="triggerImport">导入</el-button>
            <el-dropdown split-button type="primary" @click="doSummaryQuery">
              查询
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="toast('默认查询方案')">默认查询方案</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
            <el-button @click="resetSummary">重置</el-button>
            <input ref="importInputRef" type="file" accept=".csv,.xlsx" style="display:none" @change="onImportFile" />
          </div>
        </div>

        <demo-module-guide-card v-if="remarkMode" :guide="flow"></demo-module-guide-card>

        <div class="list-with-remark">
          <section class="list-area list-main ledger-matrix" ref="summaryCardRef">
            <div class="list-toolbar">
              <div class="list-toolbar__info">
                <span class="list-toolbar__title">并集矩阵</span>
              </div>
              <div class="list-toolbar__actions">
                <el-button @click="exportSummary">导出数据</el-button>
                <el-button type="danger" @click="toast('批量删除')">批量删除</el-button>
                <div class="list-toolbar__icons">
                  <demo-toolbar-icon-btn icon="columns" title="列设置" @click="toast('列设置')" />
                  <demo-toolbar-icon-btn icon="refresh" title="刷新" @click="doSummaryQuery" />
                  <demo-toolbar-icon-btn icon="fullscreen" title="全屏" @click="toggleSummaryFullscreen" />
                  <demo-toolbar-icon-btn icon="filter" title="自定义查询" @click="toast('自定义查询')" />
                </div>
              </div>
            </div>
            <div class="list-body">
              <demo-vxe-wrap
                :key="summaryTableKey"
                :show-table="summaryDisplayRows.length > 0"
                empty-text="请配置样本过滤条件后查询"
                class="demo-table--wide demo-table--ledger-matrix"
                :data="summaryDisplayRows"
                :column-config="{ resizable: true, minWidth: 80, useKey: true }"
                :row-config="{ isHover: true, keyField: 'id' }"
                :row-class-name="matrixRowClassName"
                :checkbox-config="{ checkMethod: canCheckSummaryRow }"
                :scroll-x="{ enabled: true }"
              >
                <vxe-column
                  v-for="col in summaryColumns"
                  :key="matrixColumnKey(col)"
                  v-bind="col"
                />
              </demo-vxe-wrap>
            </div>
          </section>
          <demo-remark-aside v-if="remarkMode" :remarks="remarks"></demo-remark-aside>
        </div>
      </div>
    `,
      components: {
        DemoToolbarIconBtn: ChromDriftToolbarIconBtn,
        DemoRemarkAside: ChromDriftRemarkAside,
        DemoModuleGuideCard: ChromDriftModuleGuideCard,
        DemoFieldRemark: ChromDriftFieldRemark,
        DemoVxeWrap: ChromDriftVxeWrap,
      },
      setup() {
        const summaryFieldKeys = ['applyType', 'materialInfo', 'qcpPoint', 'batchNo'];
        const ledger = ref(ChromDriftStorage.load(storageKey, clone(seedData)));
        const summaryFilters = ref(initialSummaryRows());
        const summaryRtColumns = ref([]);
        const summaryRows = ref([]);
        const summaryCardRef = ref(null);
        const importInputRef = ref(null);

        const remarks = computed(() => ChromDriftRemarks.getPageRemarks(remarkPageId));
        const flow = computed(() => ChromDriftRemarks.getPageFlow(remarkPageId));
        const remarkMode = ChromDriftRemarkMode.state;

        const enabledMaterials = computed(() => SEED_MATERIALS.filter((m) => m.enabled !== false));
        const qcpOptions = computed(() => SEED_QCP.filter((q) => q.enabled !== false));

        const summaryDisplayRows = computed(() => summaryRows.value.map(
          (r) => flattenMatrixRow(r, summaryRtColumns.value),
        ));

        const summaryTableKey = computed(() => `summary__${summaryRtColumns.value.join('|')}`);

        const summaryColumns = computed(() => [
          { type: 'checkbox', width: 42, fixed: 'left' },
          { field: 'sourceType', title: '数据来源', width: 100, fixed: 'left', showOverflow: true },
          { field: 'qcpPoint', title: '采样点', width: 100, fixed: 'left', showOverflow: true },
          { field: 'rowLabel', title: '典型保留时间', width: 110, fixed: 'left', showOverflow: true },
          ...buildRtColumnDefs(summaryRtColumns.value),
          ...SUMMARY_META_COLUMNS,
        ]);

        function matrixRowClassName({ row }) {
          return isMatrixSubheaderRow(row) ? 'ledger-matrix-subheader' : '';
        }

        function canCheckSummaryRow({ row }) {
          return row.rowType === 'batch';
        }

        function validateSummaryFilters(rows) {
          const allowedTypes = new Set(SUMMARY_TYPES.map((t) => t.value));
          const matSet = new Set(enabledMaterials.value.map((m) => m.materialCode));
          const qcpSet = new Set(qcpOptions.value.map((q) => q.qcpCode));
          for (let i = 0; i < rows.length; i += 1) {
            const f = rows[i];
            const label = f.lineNo ? `第 ${f.lineNo} 行` : `第 ${i + 1} 行`;
            if (!allowedTypes.has(f.applyType)) return `${label}：类型须为生产过程或生产物料`;
            if (!f.materialCode) return `${label}：请选择物料信息`;
            if (!matSet.has(f.materialCode)) return `${label}：物料信息无效或未启用`;
            if (!f.qcpPoint) return `${label}：请选择采样点`;
            if (!qcpSet.has(f.qcpPoint)) return `${label}：采样点无效或未启用`;
            if (!String(f.batchNo || '').trim()) return `${label}：请填写批号`;
          }
          return '';
        }

        function addSummaryRow() {
          summaryFilters.value.push(emptySummaryRow());
        }

        function removeSummaryRow(idx) {
          summaryFilters.value.splice(idx, 1);
        }

        function applySummaryQuery(silent) {
          const err = validateSummaryFilters(summaryFilters.value);
          if (err) {
            if (!silent) ElMessage.warning(err);
            return false;
          }
          const result = LB.buildSummaryMatrix(
            ledger.value,
            summaryFilters.value,
            ledgerType,
            LB.optionsDriftRules(),
          );
          summaryRtColumns.value = result.rtColumns;
          summaryRows.value = result.rows;
          if (!result.rows.length) {
            if (!silent) ElMessage.info('暂无匹配数据');
          } else if (!silent) {
            ElMessage.success('查询完成');
          }
          return true;
        }

        function doSummaryQuery() {
          applySummaryQuery(false);
        }

        function resetSummary() {
          summaryFilters.value = initialSummaryRows();
          summaryRtColumns.value = [];
          summaryRows.value = [];
        }

        function downloadImportTemplate() {
          const sample = [
            IMPORT_HEADERS.join(','),
            '生产过程,CP001,QCP01,2025042801',
            '生产物料,CP001,QCP04,2025042802',
          ].join('\n');
          const blob = new Blob([`\uFEFF${sample}`], { type: 'text/csv;charset=utf-8' });
          const a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = `${ledgerType}数据比对-导入模板.csv`;
          a.click();
          ElMessage.success('模板已下载');
        }

        function triggerImport() {
          importInputRef.value?.click();
        }

        function onImportFile(ev) {
          const file = ev.target.files?.[0];
          ev.target.value = '';
          if (!file) return;
          const name = file.name.toLowerCase();
          if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
            ElMessage.warning('Demo 暂仅支持 CSV 导入，请使用「下载模板」填写后上传 .csv');
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const parsed = parseImportCsv(String(reader.result || ''));
            if (parsed.error) {
              ElMessage.error(parsed.error);
              return;
            }
            const err = validateSummaryFilters(parsed.rows);
            if (err) {
              ElMessage.error(`导入失败：${err}`);
              return;
            }
            summaryFilters.value = parsed.rows.map(({ applyType, materialCode, qcpPoint, batchNo }) => ({
              applyType, materialCode, qcpPoint, batchNo,
            }));
            summaryRtColumns.value = [];
            summaryRows.value = [];
            ElMessage.success(`已导入 ${summaryFilters.value.length} 条查询条件，请点击「查询」`);
          };
          reader.onerror = () => ElMessage.error('文件读取失败');
          reader.readAsText(file, 'UTF-8');
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

        function toggleSummaryFullscreen() {
          const el = summaryCardRef.value;
          if (!el) return;
          if (!document.fullscreenElement) el.requestFullscreen?.();
          else document.exitFullscreen?.();
        }

        onMounted(() => {
          applySummaryQuery(true);
        });

        return {
          summaryFieldKeys,
          summaryFilters, summaryTypes: SUMMARY_TYPES,
          addSummaryRow, removeSummaryRow, doSummaryQuery, resetSummary,
          downloadImportTemplate, triggerImport, onImportFile, importInputRef,
          summaryRtColumns, summaryRows, summaryDisplayRows, summaryColumns, summaryTableKey,
          exportSummary, toast, toggleSummaryFullscreen, summaryCardRef,
          enabledMaterials, qcpOptions,
          canCheckSummaryRow, matrixRowClassName, matrixColumnKey,
          remarks, flow, remarkMode,
          fieldRemarkProps: ChromDriftFormFieldRemarks.fieldRemarkProps,
        };
      },
    };
  }

  window.ChromDriftLedgerCompareGcPage = createComparePage({
    name: 'LedgerCompareGcPage',
    exportKey: 'ChromDriftLedgerCompareGcPage',
    ledgerType: 'GC',
    storageKey: 'ledger-gc-data',
    seedData: ChromDriftSeedLedgerGc.SEED_LEDGER_GC,
    defaultSummaryFilters: ChromDriftSeedCompareDefaults.GC,
    remarkPageId: 'ledger-compare-gc',
    pageClass: 'ledger-compare-gc-page',
  });

  window.ChromDriftLedgerCompareLcPage = createComparePage({
    name: 'LedgerCompareLcPage',
    exportKey: 'ChromDriftLedgerCompareLcPage',
    ledgerType: 'LC',
    storageKey: 'ledger-lc-data',
    seedData: ChromDriftSeedLedgerLc.SEED_LEDGER_LC,
    defaultSummaryFilters: ChromDriftSeedCompareDefaults.LC,
    remarkPageId: 'ledger-compare-lc',
    pageClass: 'ledger-compare-lc-page',
  });
})();
