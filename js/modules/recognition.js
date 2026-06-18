/**
 * M3 · 图谱识别
 */
(function () {
  const { ref, computed, watch } = Vue;
  const { ElMessage, ElMessageBox } = ElementPlus;
  const { usePersistedRef, uid, nowStr, clone } = ChromDriftStorage;
  const { SEED_RECOGNITION_RECORDS } = ChromDriftSeedRecognition;
  const { SEED_DRIFT_RULES } = ChromDriftSeedDriftRules;
  const { SEED_WARNING_RULES } = ChromDriftSeedWarningRules;
  const { SEED_INSTRUMENTS } = ChromDriftSeedInstruments;
  const { SEED_QCP } = ChromDriftSeedMasters;
  const { TEST_SPECTRA } = ChromDriftSeedTestSpectra;
  const { LEDGER_TYPES, APPLY_TYPES, PAGE_SIZES } = ChromDriftEnums;
  const V = ChromDriftRecognitionValidators;

  function emptyForm() {
    return {
      ledgerType: 'GC',
      applyType: '生产过程',
      fileName: '',
      fileSavedAt: '',
      sampleName: '',
      instrumentCode: '',
      instrumentName: '',
      materialInfo: '',
      batchNo: '',
      qcpPoint: '',
      ruleName: '',
      warningRuleName: '',
      hasNewImpurity: '',
      hasExcessImpurity: '',
      attachmentName: '',
      remark: '',
      driftRuleId: '',
      warningRuleId: '',
      details: [],
    };
  }

  function emptyQuery() {
    return {
      ledgerType: '',
      applyType: '',
      fileName: '',
      sampleName: '',
      instrumentCode: '',
      batchNo: '',
      qcpPoint: '',
      ruleName: '',
      hasNewImpurity: '',
      fileSavedStart: '',
      fileSavedEnd: '',
      createdStart: '',
      createdEnd: '',
    };
  }

  function ynLabel(v) {
    if (v === true || v === '是') return '是';
    if (v === false || v === '否') return '否';
    return v || '/';
  }

  window.ChromDriftRecognitionPage = {
    name: 'RecognitionPage',
    template: `
      <div class="recognition-page">
        <demo-query-panel :model="query" @submit="doQuery">
          <demo-query-field label="台账类型">
            <el-select v-model="query.ledgerType" clearable placeholder="全部">
              <el-option v-for="o in ledgerTypes" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </demo-query-field>
          <demo-query-field label="类型">
            <el-select v-model="query.applyType" clearable placeholder="全部">
              <el-option v-for="o in applyTypes" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </demo-query-field>
          <demo-query-field label="文件名称">
            <el-input v-model="query.fileName" clearable placeholder="模糊" @keyup.enter="doQuery" />
          </demo-query-field>
          <demo-query-field label="样品名称">
            <el-input v-model="query.sampleName" clearable placeholder="模糊" @keyup.enter="doQuery" />
          </demo-query-field>
          <demo-query-field label="仪器编号">
            <el-input v-model="query.instrumentCode" clearable placeholder="模糊" @keyup.enter="doQuery" />
          </demo-query-field>
          <demo-query-field label="批号">
            <el-input v-model="query.batchNo" clearable placeholder="模糊" @keyup.enter="doQuery" />
          </demo-query-field>
          <demo-query-field label="QCP点">
            <el-input v-model="query.qcpPoint" clearable placeholder="模糊" @keyup.enter="doQuery" />
          </demo-query-field>
          <demo-query-field label="规则名称">
            <el-input v-model="query.ruleName" clearable placeholder="模糊" @keyup.enter="doQuery" />
          </demo-query-field>
          <demo-query-field label="是否存在新杂">
            <el-select v-model="query.hasNewImpurity" clearable placeholder="全部">
              <el-option label="是" value="是" />
              <el-option label="否" value="否" />
            </el-select>
          </demo-query-field>
          <demo-query-field label="文件保存时间">
            <el-date-picker
              v-model="fileSavedRange"
              type="daterange"
              range-separator="至"
              start-placeholder="开始"
              end-placeholder="结束"
              value-format="YYYY-MM-DD"
              style="width:100%"
            />
          </demo-query-field>
          <demo-query-field label="创建时间">
            <el-date-picker
              v-model="createdRange"
              type="daterange"
              range-separator="至"
              end-placeholder="结束"
              start-placeholder="开始"
              value-format="YYYY-MM-DD"
              style="width:100%"
            />
          </demo-query-field>
          <template #actions>
            <el-button type="primary" native-type="submit">查询</el-button>
            <el-button @click="resetQuery">重置</el-button>
          </template>
        </demo-query-panel>

        <demo-module-guide-card v-if="remarkMode" :guide="flow"></demo-module-guide-card>

        <div class="list-with-remark">
          <div class="demo-card list-main" ref="listCardRef">
            <div class="list-toolbar">
              <span class="list-toolbar__title">数据列表</span>
              <div class="list-toolbar__actions">
                <el-button type="primary" @click="openAdd">新增</el-button>
                <el-button type="danger" @click="batchDelete">批量删除</el-button>
                <el-button @click="exportData">导出数据</el-button>
                <demo-toolbar-icon-btn icon="columns" title="列设置" @click="toast('列设置')" />
                <demo-toolbar-icon-btn icon="refresh" title="刷新列表" @click="refreshList" />
                <demo-toolbar-icon-btn icon="fullscreen" title="全屏" @click="toggleFullscreen" />
                <demo-toolbar-icon-btn icon="filter" title="自定义查询" @click="toast('自定义查询')" />
              </div>
            </div>

            <vxe-table
              ref="tableRef"
              class="demo-table demo-table--wide"
              :data="pagedRows"
              border stripe
              height="420"
              :column-config="{ resizable: true, minWidth: 80 }"
              :row-config="{ isHover: true, keyField: 'id' }"
              :checkbox-config="{ reserve: true, highlight: true }"
              :scroll-x="{ enabled: true }"
              empty-text="暂无数据"
              @checkbox-change="onSelChange"
              @checkbox-all="onSelChange"
            >
              <vxe-column type="checkbox" width="42" fixed="left" />
              <vxe-column type="seq" title="序号" width="55" fixed="left" />
              <vxe-column field="ledgerType" title="台账类型" min-width="80" show-overflow />
              <vxe-column field="applyType" title="类型" min-width="100" show-overflow />
              <vxe-column field="fileName" title="文件名称" min-width="140" show-overflow />
              <vxe-column field="sampleName" title="样品名称" min-width="140" show-overflow />
              <vxe-column field="instrumentCode" title="仪器编号" min-width="100" show-overflow />
              <vxe-column field="instrumentName" title="仪器名称" min-width="120" show-overflow />
              <vxe-column field="batchNo" title="批号" min-width="100" show-overflow />
              <vxe-column field="qcpPoint" title="QCP点" min-width="90" show-overflow />
              <vxe-column field="ruleName" title="规则名称" min-width="140" show-overflow />
              <vxe-column field="hasNewImpurity" title="是否存在新杂" min-width="110" show-overflow />
              <vxe-column field="attachmentName" title="附件" min-width="80" show-overflow />
              <vxe-column field="remark" title="备注" min-width="100" show-overflow />
              <vxe-column field="fileSavedAt" title="文件保存时间" min-width="150" show-overflow class-name="col-secondary" />
              <vxe-column field="createdAt" title="创建时间" min-width="150" show-overflow class-name="col-secondary" />
              <vxe-column field="createdBy" title="创建人" min-width="80" show-overflow />
              <vxe-column title="操作" width="80" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openDetail(row)">详情</el-button>
                </template>
              </vxe-column>
            </vxe-table>

            <vxe-pager
              v-model:current-page="pageNum"
              v-model:page-size="pageSize"
              :page-sizes="pageSizes"
              :total="filteredRows.length"
              :layouts="['Total', 'Sizes', 'PrevPage', 'Number', 'NextPage', 'Jump']"
              style="margin-top:12px"
            />
          </div>
          <demo-remark-aside v-if="remarkMode" :remarks="remarks"></demo-remark-aside>
        </div>

        <!-- 新增 -->
        <el-dialog
          v-model="addDlg"
          class="demo-dialog"
          title="新增"
          width="1200px"
          destroy-on-close
          :close-on-click-modal="false"
          @closed="onAddClosed"
        >
          <el-form label-width="120px" size="default" :model="form" class="demo-dialog-form">
            <el-row :gutter="16">
              <el-col :span="8">
                <el-form-item label="台账类型" required>
                  <el-select v-model="form.ledgerType" style="width:100%" @change="onHeadChange">
                    <el-option v-for="o in ledgerTypes" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="类型" required>
                  <el-select v-model="form.applyType" style="width:100%" @change="onHeadChange">
                    <el-option v-for="o in applyTypes" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="文件" required>
                  <el-upload :auto-upload="false" :show-file-list="false" accept=".json,.txt,.csv" @change="onFilePick">
                    <el-button>+ 点击上传</el-button>
                  </el-upload>
                  <span v-if="form.fileName" class="demo-file-picked">{{ form.fileName }}</span>
                </el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="示例谱图">
                  <div class="demo-spectrum-samples">
                    <div
                      v-for="ex in exampleSpectra"
                      :key="ex.id"
                      class="demo-spectrum-sample"
                      :title="ex.purpose"
                    >
                      <el-button size="small" @click="loadExample(ex)">{{ ex.shortLabel }}</el-button>
                      <el-button link type="primary" size="small" @click="downloadExample(ex)">下载</el-button>
                    </div>
                  </div>
                  <div class="demo-spectrum-samples-hint">
                    点击名称一键加载（等同上传并自动填表头）；也可下载后通过「点击上传」手动选择文件
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="文件名称" required>
                  <el-input v-model="form.fileName" @blur="onHeadChange" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="保存时间" required>
                  <el-input v-model="form.fileSavedAt" readonly />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="样品名称" required>
                  <el-input v-model="form.sampleName" @blur="onHeadChange" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="仪器编号" required>
                  <el-select v-model="form.instrumentCode" style="width:100%" @change="onInstrumentChange">
                    <el-option v-for="i in instruments" :key="i.code" :label="i.code" :value="i.code" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="仪器名称" required>
                  <el-input v-model="form.instrumentName" readonly />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="物料信息" required>
                  <el-input v-model="form.materialInfo" @blur="onHeadChange" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="批号" required>
                  <el-input v-model="form.batchNo" />
                </el-form-item>
              </el-col>
              <el-col v-if="showQcp" :span="8">
                <el-form-item label="QCP点" required>
                  <el-select v-model="form.qcpPoint" filterable clearable style="width:100%" @change="onHeadChange">
                    <el-option v-for="q in qcpOptions" :key="q.qcpCode" :label="q.qcpCode + ' ' + q.qcpName" :value="q.qcpCode" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="规则名称" required>
                  <el-input v-model="form.ruleName" readonly />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="预警规则名称" required>
                  <el-input v-model="form.warningRuleName" readonly />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="是否存在新杂">
                  <el-input v-model="form.hasNewImpurity" readonly placeholder="计算后生成" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="是否存在超标新杂">
                  <el-input v-model="form.hasExcessImpurity" readonly placeholder="计算后生成" />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="附件">
                  <el-upload :auto-upload="false" :show-file-list="false" @change="onAttachPick">
                    <el-button link type="primary">上传附件</el-button>
                  </el-upload>
                  <span v-if="form.attachmentName" class="demo-attach-name">{{ form.attachmentName }}</span>
                </el-form-item>
              </el-col>
              <el-col :span="16">
                <el-form-item label="备注">
                  <el-input v-model="form.remark" placeholder="输入" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>

          <div class="demo-detail-toolbar">
            <el-button type="primary" :loading="calculating" @click="doCalculate">计算</el-button>
            <el-button :loading="calculating" @click="doRecalculate">重新计算</el-button>
          </div>

          <vxe-table
            class="demo-table demo-dialog-table"
            :data="form.details"
            border
            :height="detailTableHeight"
            :column-config="{ resizable: true, minWidth: 90 }"
            empty-text="上传文件并点击「计算」生成明细"
          >
            <vxe-column field="abnormalNote" title="异常说明" min-width="120" show-overflow />
            <vxe-column field="peakNo" title="图谱峰号" width="90" />
            <vxe-column field="rt" title="图谱保留时间" min-width="110" />
            <vxe-column field="area" title="图谱峰面积" min-width="110" />
            <vxe-column field="componentName" title="组分名" min-width="100">
              <template #default="{ row }">
                <el-input v-model="row.componentName" size="default" />
              </template>
            </vxe-column>
            <vxe-column title="是否主峰" width="100">
              <template #default="{ row }">
                <el-select v-model="row.isMainPeak" size="default" :disabled="row.locked && row.isMainPeak" style="width:100%">
                  <el-option :value="true" label="是" />
                  <el-option :value="false" label="否" />
                </el-select>
              </template>
            </vxe-column>
            <vxe-column field="rrt" title="相对保留时间" min-width="120">
              <template #default="{ row }">
                <el-input-number v-model="row.rrt" :controls="false" :step="0.0001" size="default" style="width:100%" />
              </template>
            </vxe-column>
            <vxe-column title="对应典型保留时间" min-width="140">
              <template #default="{ row }">
                <el-select
                  v-model="row.typicalRt"
                  filterable
                  allow-create
                  clearable
                  size="default"
                  style="width:100%"
                  :disabled="row.isMainPeak || row.locked"
                >
                  <el-option v-for="t in typicalRtOptions" :key="t" :label="String(t)" :value="t" />
                </el-select>
              </template>
            </vxe-column>
            <vxe-column title="是否锁定" width="90">
              <template #default="{ row }">
                <el-switch v-model="row.locked" :disabled="row.isMainPeak" />
              </template>
            </vxe-column>
            <vxe-column field="deviationRange" title="理论偏差范围" min-width="120" show-overflow />
            <vxe-column title="是否新杂" width="90">
              <template #default="{ row }">
                <el-select v-model="row.isNewImpurity" size="default" style="width:100%">
                  <el-option :value="true" label="是" />
                  <el-option :value="false" label="否" />
                </el-select>
              </template>
            </vxe-column>
            <vxe-column field="isExcessImpurity" title="是否超标新杂" min-width="110" show-overflow />
          </vxe-table>

          <template #footer>
            <el-button @click="addDlg = false">取消</el-button>
            <el-button type="primary" @click="saveAdd">保存</el-button>
          </template>
        </el-dialog>

        <!-- 详情 -->
        <el-dialog v-model="detailDlg" class="demo-dialog" title="详情" width="1200px" destroy-on-close>
          <el-descriptions v-if="detailRow" :column="3" border size="default" class="demo-detail-desc">
            <el-descriptions-item label="台账类型">{{ detailRow.ledgerType }}</el-descriptions-item>
            <el-descriptions-item label="类型">{{ detailRow.applyType }}</el-descriptions-item>
            <el-descriptions-item label="文件名称">{{ detailRow.fileName }}</el-descriptions-item>
            <el-descriptions-item label="样品名称">{{ detailRow.sampleName }}</el-descriptions-item>
            <el-descriptions-item label="仪器编号">{{ detailRow.instrumentCode }}</el-descriptions-item>
            <el-descriptions-item label="仪器名称">{{ detailRow.instrumentName }}</el-descriptions-item>
            <el-descriptions-item label="批号">{{ detailRow.batchNo }}</el-descriptions-item>
            <el-descriptions-item label="QCP点">{{ detailRow.qcpPoint || '/' }}</el-descriptions-item>
            <el-descriptions-item label="规则名称">{{ detailRow.ruleName }}</el-descriptions-item>
            <el-descriptions-item label="物料信息">{{ detailRow.materialInfo }}</el-descriptions-item>
            <el-descriptions-item label="预警规则名称">{{ detailRow.warningRuleName }}</el-descriptions-item>
            <el-descriptions-item label="是否存在新杂">{{ detailRow.hasNewImpurity }}</el-descriptions-item>
            <el-descriptions-item label="是否存在超标新杂">{{ detailRow.hasExcessImpurity }}</el-descriptions-item>
            <el-descriptions-item label="附件">{{ detailRow.attachmentName || '/' }}</el-descriptions-item>
            <el-descriptions-item label="备注" :span="2">{{ detailRow.remark || '/' }}</el-descriptions-item>
            <el-descriptions-item label="文件保存时间">{{ detailRow.fileSavedAt }}</el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ detailRow.createdAt }}</el-descriptions-item>
            <el-descriptions-item label="创建人">{{ detailRow.createdBy }}</el-descriptions-item>
          </el-descriptions>

          <vxe-table
            v-if="detailRow"
            class="demo-table demo-dialog-table"
            :data="detailRow.details"
            border
            :height="detailTableHeight"
            :column-config="{ resizable: true, minWidth: 90 }"
            style="margin-top:16px"
          >
            <vxe-column field="abnormalNote" title="异常说明" min-width="120" show-overflow />
            <vxe-column field="peakNo" title="图谱峰号" width="90" />
            <vxe-column field="rt" title="图谱保留时间" min-width="110" />
            <vxe-column field="area" title="图谱峰面积" min-width="110" />
            <vxe-column title="是否主峰" width="90">
              <template #default="{ row }">{{ row.isMainPeak ? '是' : '否' }}</template>
            </vxe-column>
            <vxe-column field="rrt" title="相对保留时间" min-width="110" />
            <vxe-column field="typicalRt" title="对应典型保留时间" min-width="130" />
            <vxe-column field="deviationRange" title="理论偏差范围" min-width="120" show-overflow />
            <vxe-column title="是否新杂" width="90">
              <template #default="{ row }">{{ ynLabel(row.isNewImpurity) }}</template>
            </vxe-column>
            <vxe-column field="isExcessImpurity" title="是否超标新杂" min-width="110" />
          </vxe-table>
        </el-dialog>
      </div>
    `,
    components: {
      DemoToolbarIconBtn: ChromDriftToolbarIconBtn,
      DemoRemarkAside: ChromDriftRemarkAside,
      DemoModuleGuideCard: ChromDriftModuleGuideCard,
      DemoQueryPanel: ChromDriftQueryPanel,
      DemoQueryField: ChromDriftQueryField,
    },
    setup() {
      const records = usePersistedRef('recognition-records', SEED_RECOGNITION_RECORDS);
      const driftRules = usePersistedRef('drift-rules', SEED_DRIFT_RULES);
      const warningRules = ref(SEED_WARNING_RULES);
      const query = ref(emptyQuery());
      const appliedQuery = ref({});
      const pageNum = ref(1);
      const pageSize = ref(10);
      const selection = ref([]);
      const tableRef = ref(null);
      const listCardRef = ref(null);

      const addDlg = ref(false);
      const detailDlg = ref(false);
      const detailRow = ref(null);
      const form = ref(emptyForm());
      const uploadedPeaks = ref([]);
      const matchedDrift = ref(null);
      const matchedWarning = ref(null);
      const calculating = ref(false);
      const calcDone = ref(false);
      const detailTableHeight = 300;

      const fileSavedRange = ref(null);
      const createdRange = ref(null);

      const remarks = computed(() => ChromDriftRemarks.getPageRemarks('recognition'));
      const flow = computed(() => ChromDriftRemarks.getPageFlow('recognition'));
      const remarkMode = ChromDriftRemarkMode.state;

      const showQcp = computed(() => form.value.applyType === '生产过程');
      const qcpOptions = computed(() => SEED_QCP.filter((q) => q.enabled !== false));

      const typicalRtOptions = computed(() => {
        if (!matchedDrift.value) return [];
        return ChromDriftLedgerBuilder.getTypicalRtsForCalc(
          form.value.ledgerType,
          form.value.applyType,
          form.value.materialInfo,
          form.value.qcpPoint,
          matchedDrift.value,
        );
      });

      watch(fileSavedRange, (v) => {
        query.value.fileSavedStart = v?.[0] || '';
        query.value.fileSavedEnd = v?.[1] || '';
      });
      watch(createdRange, (v) => {
        query.value.createdStart = v?.[0] || '';
        query.value.createdEnd = v?.[1] || '';
      });

      function inDateRange(val, start, end) {
        if (!start && !end) return true;
        const d = (val || '').slice(0, 10);
        if (start && d < start) return false;
        if (end && d > end) return false;
        return true;
      }

      const filteredRows = computed(() => {
        const q = appliedQuery.value;
        return records.value.filter((r) => {
          if (q.ledgerType && r.ledgerType !== q.ledgerType) return false;
          if (q.applyType && r.applyType !== q.applyType) return false;
          if (q.fileName && !(r.fileName || '').includes(q.fileName)) return false;
          if (q.sampleName && !(r.sampleName || '').includes(q.sampleName)) return false;
          if (q.instrumentCode && !(r.instrumentCode || '').includes(q.instrumentCode)) return false;
          if (q.batchNo && !(r.batchNo || '').includes(q.batchNo)) return false;
          if (q.qcpPoint && !(r.qcpPoint || '').includes(q.qcpPoint)) return false;
          if (q.ruleName && !(r.ruleName || '').includes(q.ruleName)) return false;
          if (q.hasNewImpurity && r.hasNewImpurity !== q.hasNewImpurity) return false;
          if (!inDateRange(r.fileSavedAt, q.fileSavedStart, q.fileSavedEnd)) return false;
          if (!inDateRange(r.createdAt, q.createdStart, q.createdEnd)) return false;
          return true;
        }).sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      });

      const pagedRows = computed(() => {
        const start = (pageNum.value - 1) * pageSize.value;
        return filteredRows.value.slice(start, start + pageSize.value);
      });

      function doQuery() {
        appliedQuery.value = { ...query.value };
        pageNum.value = 1;
        ElMessage.success('查询完成');
      }

      function resetQuery() {
        query.value = emptyQuery();
        fileSavedRange.value = null;
        createdRange.value = null;
        appliedQuery.value = {};
        pageNum.value = 1;
      }

      function refreshList() {
        ElMessage.success('列表已刷新');
      }

      function onSelChange() {
        selection.value = tableRef.value?.getCheckboxRecords() || [];
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

      function matchRules() {
        const head = form.value;
        const drift = ChromDriftRuleMatcher.matchDriftRule(head, driftRules.value);
        const warning = ChromDriftRuleMatcher.matchWarningRule(head, warningRules.value);
        matchedDrift.value = drift;
        matchedWarning.value = warning;
        form.value.ruleName = drift?.name || '';
        form.value.warningRuleName = warning?.name || '';
        form.value.driftRuleId = drift?.id || '';
        form.value.warningRuleId = warning?.id || '';
      }

      function onHeadChange() {
        if (form.value.sampleName) {
          const s = form.value.sampleName.trim();
          if (!form.value.batchNo) form.value.batchNo = s.length > 8 ? s.slice(-8) : s;
          if (!form.value.materialInfo) form.value.materialInfo = s.length > 8 ? s.slice(0, -8) : s;
        }
        matchRules();
      }

      function onInstrumentChange(code) {
        const inst = SEED_INSTRUMENTS.find((i) => i.code === code);
        form.value.instrumentName = inst?.name || '';
      }

      async function onFilePick(uploadFile) {
        const file = uploadFile.raw;
        if (!file) return;
        form.value.fileName = file.name;
        form.value.fileSavedAt = nowStr();
        const inferred = ChromDriftSpectrumCalc.inferHeadFromFileName(file.name);
        form.value.sampleName = inferred.sampleName;
        form.value.batchNo = inferred.batchNo;
        form.value.materialInfo = inferred.materialInfo;
        try {
          uploadedPeaks.value = await ChromDriftSpectrumCalc.parseUploadFile(file);
          ElMessage.success('文件已解析');
        } catch {
          ElMessage.error('文件解析失败');
        }
        calcDone.value = false;
        form.value.details = [];
        matchRules();
      }

      function peaksFromExample(item) {
        return (item.peaks || []).map((p, i) => ({
          peakNo: p.peakNo ?? i + 1,
          rt: Number(p.rt),
          area: Number(p.area),
          component: p.component || '',
        }));
      }

      function exampleFileContent(item) {
        const peaks = item.peaks || [];
        if (item.format === 'json-wrap') {
          return JSON.stringify({ peaks }, null, 2);
        }
        if (item.format === 'csv') {
          const lines = ['peakNo,rt,area,component'];
          peaks.forEach((p) => {
            lines.push([p.peakNo, p.rt, p.area, `"${(p.component || '').replace(/"/g, '""')}"`].join(','));
          });
          return lines.join('\n');
        }
        if (item.format === 'tsv') {
          const lines = ['peakNo\trt\tarea\tcomponent'];
          peaks.forEach((p) => {
            lines.push([p.peakNo, p.rt, p.area, p.component || ''].join('\t'));
          });
          return lines.join('\n');
        }
        return JSON.stringify(peaks, null, 2);
      }

      function loadExample(item) {
        const s = item.suggest || {};
        form.value.ledgerType = s.ledgerType || 'GC';
        form.value.applyType = s.applyType || '生产过程';
        form.value.materialInfo = s.materialInfo || '';
        form.value.qcpPoint = s.qcpPoint || '';
        form.value.batchNo = s.batchNo || '';
        form.value.fileName = item.file;
        form.value.fileSavedAt = nowStr();
        form.value.sampleName = s.qcpPoint
          ? `${s.materialInfo}-${s.qcpPoint}-${s.batchNo}`
          : `${s.materialInfo}-${s.batchNo}`;
        form.value.instrumentCode = s.instrumentCode || '';
        onInstrumentChange(form.value.instrumentCode);
        form.value.remark = item.purpose || '';
        uploadedPeaks.value = peaksFromExample(item);
        calcDone.value = false;
        form.value.details = [];
        form.value.hasNewImpurity = '';
        form.value.hasExcessImpurity = '';
        matchRules();
        ElMessage.success(`已加载示例：${item.shortLabel || item.file}`);
      }

      function downloadExample(item) {
        const content = exampleFileContent(item);
        const ext = (item.file || '').split('.').pop()?.toLowerCase();
        const mime = ext === 'csv' ? 'text/csv' : ext === 'txt' ? 'text/plain' : 'application/json';
        const blob = new Blob([content], { type: `${mime};charset=utf-8` });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = item.file;
        a.click();
        URL.revokeObjectURL(a.href);
        ElMessage.success(`已下载 ${item.file}`);
      }

      function onAttachPick(uploadFile) {
        form.value.attachmentName = uploadFile.name || uploadFile.raw?.name || '';
      }

      function openAdd() {
        form.value = emptyForm();
        uploadedPeaks.value = [];
        matchedDrift.value = null;
        matchedWarning.value = null;
        calcDone.value = false;
        addDlg.value = true;
      }

      function onAddClosed() {
        form.value = emptyForm();
        uploadedPeaks.value = [];
        calcDone.value = false;
      }

      function runCalc(recalc) {
        const errs = V.headComplete(form.value, form.value.applyType);
        if (errs.length) {
          ElMessage.warning(errs[0]);
          return;
        }
        if (!matchedDrift.value) {
          ElMessage.warning('未匹配到漂移规则，请补全配置');
          return;
        }
        if (!uploadedPeaks.value.length && !form.value.details.length) {
          ElMessage.warning('请先上传谱图文件');
          return;
        }
        if (recalc) {
          const lockErr = ChromDriftSpectrumCalc.validateLockedUnique(form.value.details);
          if (lockErr) {
            ElMessage.warning(lockErr);
            return;
          }
        }
        calculating.value = true;
        setTimeout(() => {
          const typicalRts = ChromDriftLedgerBuilder.getTypicalRtsForCalc(
            form.value.ledgerType,
            form.value.applyType,
            form.value.materialInfo,
            form.value.qcpPoint,
            matchedDrift.value,
          );
          const structureCells = ChromDriftLedgerBuilder.getStructureNames(
            form.value.ledgerType,
            form.value.applyType,
            form.value.materialInfo,
            form.value.qcpPoint,
            matchedDrift.value,
          );
          const peaks = uploadedPeaks.value.length
            ? uploadedPeaks.value
            : ChromDriftSpectrumCalc.MOCK_PEAKS;
          const result = ChromDriftSpectrumCalc.runCalculation({
            peaks,
            typicalRts,
            structureCells,
            driftRule: matchedDrift.value,
            warningRule: matchedWarning.value,
            existingRows: recalc ? form.value.details : null,
            recalc,
          });
          form.value.details = result.details;
          form.value.hasNewImpurity = result.hasNewImpurity;
          form.value.hasExcessImpurity = result.hasExcessImpurity;
          calcDone.value = true;
          calculating.value = false;
          ElMessage.success(recalc ? '重新计算完成' : '计算完成');
        }, 300);
      }

      function doCalculate() {
        runCalc(false);
      }

      function doRecalculate() {
        if (!calcDone.value) {
          ElMessage.warning('请先执行计算');
          return;
        }
        runCalc(true);
      }

      function saveAdd() {
        const errs = V.validateSave(form.value, form.value.details);
        if (errs.length) {
          ElMessage.warning(errs[0]);
          return;
        }
        const row = {
          ...clone(form.value),
          id: uid(),
          createdAt: nowStr(),
          createdBy: 'Demo',
          details: clone(form.value.details),
        };
        ChromDriftLedgerBuilder.saveRecognitionToLedger(
          row,
          matchedDrift.value,
          matchedWarning.value,
        );
        ChromDriftLedgerBuilder.persistDriftRule(driftRules.value, matchedDrift.value);
        records.value = [row, ...records.value];
        addDlg.value = false;
        ElMessage.success('保存成功，已写入数据台账');
      }

      function openDetail(row) {
        detailRow.value = clone(row);
        detailDlg.value = true;
      }

      function batchDelete() {
        const rows = tableRef.value?.getCheckboxRecords() || [];
        if (!rows.length) {
          ElMessage.warning('请先勾选要删除的行');
          return;
        }
        ElMessageBox.confirm(`确定删除选中的 ${rows.length} 条记录？`, '批量删除', {
          type: 'warning',
        }).then(() => {
          const ids = new Set(rows.map((r) => r.id));
          records.value = records.value.filter((r) => !ids.has(r.id));
          tableRef.value?.clearCheckboxRow();
          selection.value = [];
          ElMessage.success('删除成功');
        }).catch(() => {});
      }

      function exportData() {
        const rows = tableRef.value?.getCheckboxRecords()?.length
          ? tableRef.value.getCheckboxRecords()
          : filteredRows.value;
        if (!rows.length) {
          ElMessage.warning('无数据可导出');
          return;
        }
        const header = ['台账类型', '类型', '文件名称', '样品名称', '批号', '规则名称', '是否存在新杂', '创建时间'];
        const lines = rows.map((r) => [
          r.ledgerType, r.applyType, r.fileName, r.sampleName, r.batchNo,
          r.ruleName, r.hasNewImpurity, r.createdAt,
        ].join(','));
        const csv = [header.join(','), ...lines].join('\n');
        const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '图谱识别.csv';
        a.click();
        ElMessage.success('导出完成');
      }

      return {
        query, doQuery, resetQuery, refreshList,
        ledgerTypes: LEDGER_TYPES, applyTypes: APPLY_TYPES, pageSizes: PAGE_SIZES,
        pageNum, pageSize, pagedRows, filteredRows,
        tableRef, listCardRef, onSelChange, batchDelete, exportData,
        openAdd, addDlg, form, showQcp, qcpOptions, instruments: SEED_INSTRUMENTS,
        exampleSpectra: TEST_SPECTRA,
        loadExample, downloadExample,
        onFilePick, onAttachPick, onHeadChange, onInstrumentChange,
        doCalculate, doRecalculate, saveAdd, onAddClosed,
        calculating, detailTableHeight, typicalRtOptions,
        openDetail, detailDlg, detailRow, ynLabel,
        remarks, flow, remarkMode, toast, toggleFullscreen,
        fileSavedRange, createdRange,
      };
    },
  };
})();
