/**
 * M2 · 偏差预警设置
 */
(function () {
  const { ref, computed } = Vue;
  const { ElMessage, ElMessageBox } = ElementPlus;
  const { usePersistedRef, uid, nowStr, clone } = ChromDriftStorage;
  const { SEED_WARNING_RULES } = ChromDriftSeedWarningRules;
  const { SEED_MATERIALS, SEED_QCP } = ChromDriftSeedMasters;
  const {
    APPLY_TYPES, DEVIATION_TYPES, UPPER_LIMIT_OPS, LOWER_LIMIT_OPS, PAGE_SIZES,
  } = ChromDriftEnums;
  const V = ChromDriftWarningValidators;

  function emptyForm() {
    return {
      id: '',
      code: '',
      name: '',
      deviationType: 'excess_impurity',
      uslOp: '≤',
      uslValue: null,
      lslOp: '≥',
      lslValue: null,
      uclOp: '≤',
      uclValue: null,
      lclOp: '≥',
      lclValue: null,
      applyType: '原材料',
      remark: '',
      enabled: true,
      materials: [],
      qcpPoints: [],
    };
  }

  window.ChromDriftWarningRulePage = {
    name: 'WarningRulePage',
    template: `
      <div class="warning-rule-page">
        <demo-query-panel :model="query" @submit="doQuery">
          <demo-query-field label="规则编码">
            <el-input v-model="query.code" clearable placeholder="模糊查询" @keyup.enter="doQuery" />
          </demo-query-field>
          <demo-query-field label="规则名称">
            <el-input v-model="query.name" clearable placeholder="模糊查询" @keyup.enter="doQuery" />
          </demo-query-field>
          <demo-query-field label="偏差类型">
            <el-select v-model="query.deviationType" clearable placeholder="全部">
              <el-option v-for="o in deviationTypes" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </demo-query-field>
          <demo-query-field label="适用类型">
            <el-select v-model="query.applyType" clearable placeholder="全部">
              <el-option v-for="o in applyTypes" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </demo-query-field>
          <demo-query-field label="启用状态">
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
              class="demo-table"
              :data="pagedRows"
              border stripe
              height="420"
              :column-config="{ resizable: true, minWidth: 80 }"
              :row-config="{ isHover: true, keyField: 'id' }"
              :checkbox-config="{ reserve: true, highlight: true }"
              empty-text="暂无数据"
              @checkbox-change="onSelChange"
              @checkbox-all="onSelChange"
            >
              <vxe-column type="checkbox" width="42" fixed="left" />
              <vxe-column type="seq" title="序号" width="55" fixed="left" />
              <vxe-column field="code" title="规则编码" min-width="100" show-overflow />
              <vxe-column field="name" title="规则名称" min-width="100" show-overflow />
              <vxe-column field="deviationTypeLabel" title="偏差类型" min-width="100" show-overflow />
              <vxe-column field="uclText" title="UCL" min-width="90" show-overflow />
              <vxe-column field="lclText" title="LCL" min-width="90" show-overflow />
              <vxe-column field="applyType" title="适用类型" min-width="100" show-overflow />
              <vxe-column field="matInfo" title="适用物料" min-width="100" show-overflow />
              <vxe-column field="qcpInfo" title="适用QCP点" min-width="100" show-overflow />
              <vxe-column field="remark" title="备注" min-width="100" show-overflow />
              <vxe-column title="启用状态" min-width="80" show-overflow>
                <template #default="{ row }">
                  <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '禁用' }}</el-tag>
                </template>
              </vxe-column>
              <vxe-column field="createdAt" title="创建时间" min-width="100" show-overflow class-name="col-secondary" />
              <vxe-column field="createdBy" title="创建人" min-width="80" show-overflow />
              <vxe-column title="操作" width="120" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="copyRow(row)">复制</el-button>
                  <el-button link type="primary" @click="editRow(row)">编辑</el-button>
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

        <el-dialog
          v-model="dlgVisible"
          class="demo-dialog"
          :title="dlgTitle"
          width="960px"
          destroy-on-close
          :close-on-click-modal="false"
          @closed="onDlgClosed"
        >
          <el-form label-width="120px" size="default" :model="form" class="demo-dialog-form">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="规则编码" required>
                  <el-input v-model="form.code" placeholder="输入,唯一" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="规则名称" required>
                  <el-input v-model="form.name" placeholder="输入,唯一" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="偏差类型" required>
                  <el-select v-model="form.deviationType" style="width:100%">
                    <el-option v-for="o in deviationTypes" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="适用类型" required>
                  <el-select v-model="form.applyType" style="width:100%" @change="onApplyTypeChange">
                    <el-option v-for="o in applyTypes" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="USL">
                  <div class="demo-form-limit">
                    <el-select v-model="form.uslOp" class="demo-form-limit__op">
                      <el-option v-for="o in upperOps" :key="o.value" :label="o.label" :value="o.value" />
                    </el-select>
                    <el-input-number v-model="form.uslValue" :step="0.01" :precision="3" controls-position="right" class="demo-form-limit__num" />
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="LSL">
                  <div class="demo-form-limit">
                    <el-select v-model="form.lslOp" class="demo-form-limit__op">
                      <el-option v-for="o in lowerOps" :key="o.value" :label="o.label" :value="o.value" />
                    </el-select>
                    <el-input-number v-model="form.lslValue" :step="0.01" :precision="3" controls-position="right" class="demo-form-limit__num" />
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="UCL">
                  <div class="demo-form-limit">
                    <el-select v-model="form.uclOp" class="demo-form-limit__op">
                      <el-option v-for="o in upperOps" :key="o.value" :label="o.label" :value="o.value" />
                    </el-select>
                    <el-input-number v-model="form.uclValue" :step="0.01" :precision="3" controls-position="right" class="demo-form-limit__num" />
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="LCL">
                  <div class="demo-form-limit">
                    <el-select v-model="form.lclOp" class="demo-form-limit__op">
                      <el-option v-for="o in lowerOps" :key="o.value" :label="o.label" :value="o.value" />
                    </el-select>
                    <el-input-number v-model="form.lclValue" :step="0.01" :precision="3" controls-position="right" class="demo-form-limit__num" />
                  </div>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="备注">
                  <el-input v-model="form.remark" placeholder="输入" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="启用状态" required>
                  <el-switch v-model="form.enabled" active-text="启用" inactive-text="禁用" />
                </el-form-item>
              </el-col>
            </el-row>
          </el-form>

          <el-tabs v-model="activeTab" class="demo-dialog-tabs">
            <el-tab-pane v-if="showMatTab" label="物料" name="material">
              <div style="margin-bottom:8px">
                <el-button type="primary" @click="openMatPicker">添加物料</el-button>
                <el-button type="danger" @click="batchDelMat">批量删除</el-button>
              </div>
              <vxe-table
                :data="form.materials"
                border
                class="demo-dialog-table"
                :height="dialogTableHeight"
                :row-config="{ keyField: 'id' }"
                :checkbox-config="{ highlight: true }"
                @checkbox-change="onMatSel"
                @checkbox-all="onMatSel"
              >
                <vxe-column type="checkbox" width="42" />
                <vxe-column type="seq" title="序号" width="55" />
                <vxe-column field="materialCode" title="物料编码" min-width="100" />
                <vxe-column field="materialName" title="物料名称" min-width="120" />
                <vxe-column field="spec" title="物料规格" width="90" />
                <vxe-column field="category" title="物料种类" width="90" />
                <vxe-column field="unit" title="基本单位" width="80" />
                <vxe-column title="启用状态" width="80">
                  <template #default="{ row }">
                    <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '禁用' }}</el-tag>
                  </template>
                </vxe-column>
              </vxe-table>
            </el-tab-pane>

            <el-tab-pane v-if="showQcpTab" label="QCP点" name="qcp">
              <div style="margin-bottom:8px">
                <el-button type="primary" @click="openQcpPicker">添加QCP点</el-button>
                <el-button type="danger" @click="batchDelQcp">批量删除</el-button>
              </div>
              <vxe-table
                :data="form.qcpPoints"
                border
                class="demo-dialog-table"
                :height="dialogTableHeight"
                :row-config="{ keyField: 'id' }"
                :checkbox-config="{ highlight: true }"
                @checkbox-change="onQcpSel"
                @checkbox-all="onQcpSel"
              >
                <vxe-column type="checkbox" width="42" />
                <vxe-column type="seq" title="序号" width="55" />
                <vxe-column field="qcpCode" title="QCP编码" min-width="100" />
                <vxe-column field="qcpName" title="QCP名称" min-width="120" />
                <vxe-column title="启用状态" width="80">
                  <template #default><el-tag type="success" size="small">启用</el-tag></template>
                </vxe-column>
              </vxe-table>
            </el-tab-pane>
          </el-tabs>

          <template #footer>
            <el-button @click="dlgVisible = false">取消</el-button>
            <el-button type="primary" @click="submitForm">保存</el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="matDlg" class="demo-dialog" title="物料列表" width="760px" destroy-on-close>
          <el-form :inline="true" size="default" :model="matQuery" @submit.prevent>
            <el-form-item label="物料编码"><el-input v-model="matQuery.code" clearable style="width:120px" /></el-form-item>
            <el-form-item label="物料名称"><el-input v-model="matQuery.name" clearable style="width:120px" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="filterMasters">查询</el-button>
              <el-button @click="resetMatQuery">重置</el-button>
            </el-form-item>
          </el-form>
          <vxe-table
            ref="matPickRef"
            :data="matPickPage"
            border
            class="demo-dialog-table"
            :height="pickerTableHeight"
            :row-config="{ keyField: 'id' }"
            :checkbox-config="{ reserve: true, highlight: true }"
          >
            <vxe-column type="checkbox" width="42" />
            <vxe-column type="seq" title="序号" width="55" />
            <vxe-column field="materialCode" title="物料编码" min-width="100" />
            <vxe-column field="materialName" title="物料名称" min-width="120" />
            <vxe-column field="spec" title="物料规格" width="90" />
            <vxe-column field="category" title="物料种类" width="90" />
            <vxe-column field="unit" title="基本单位" width="80" />
          </vxe-table>
          <vxe-pager
            v-model:current-page="matPageNum"
            v-model:page-size="matPageSize"
            :page-sizes="pageSizes"
            :total="matFiltered.length"
            :layouts="['Total', 'Sizes', 'PrevPage', 'Number', 'NextPage']"
            size="small"
            style="margin-top:8px"
          />
          <template #footer>
            <el-button @click="matDlg = false">取消</el-button>
            <el-button type="primary" @click="confirmMatPick">保存</el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="qcpDlg" class="demo-dialog" title="QCP 列表" width="720px" destroy-on-close>
          <el-form :inline="true" size="default" :model="qcpQuery" @submit.prevent>
            <el-form-item label="QCP编码"><el-input v-model="qcpQuery.code" clearable style="width:120px" /></el-form-item>
            <el-form-item label="QCP名称"><el-input v-model="qcpQuery.name" clearable style="width:120px" /></el-form-item>
            <el-form-item>
              <el-button type="primary" @click="filterMasters">查询</el-button>
              <el-button @click="resetQcpQuery">重置</el-button>
            </el-form-item>
          </el-form>
          <vxe-table
            ref="qcpPickRef"
            :data="qcpPickPage"
            border
            class="demo-dialog-table"
            :height="pickerTableHeight"
            :row-config="{ keyField: 'id' }"
            :checkbox-config="{ reserve: true, highlight: true }"
          >
            <vxe-column type="checkbox" width="42" />
            <vxe-column type="seq" title="序号" width="55" />
            <vxe-column field="qcpCode" title="QCP编码" min-width="100" />
            <vxe-column field="qcpName" title="QCP名称" min-width="120" />
            <vxe-column title="启用状态" width="80"><template #default><el-tag type="success" size="small">启用</el-tag></template></vxe-column>
            <vxe-column field="createdBy" title="创建人" width="80" />
            <vxe-column field="createdAt" title="创建时间" width="150" />
          </vxe-table>
          <vxe-pager
            v-model:current-page="qcpPageNum"
            v-model:page-size="qcpPageSize"
            :page-sizes="pageSizes"
            :total="qcpFiltered.length"
            :layouts="['Total', 'Sizes', 'PrevPage', 'Number', 'NextPage']"
            size="small"
            style="margin-top:8px"
          />
          <template #footer>
            <el-button @click="qcpDlg = false">取消</el-button>
            <el-button type="primary" @click="confirmQcpPick">保存</el-button>
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
    },
    setup() {
      const rules = usePersistedRef('warning-rules', SEED_WARNING_RULES);
      const query = ref({
        code: '', name: '', deviationType: '', applyType: '', enabled: '',
      });
      const appliedQuery = ref({});
      const pageNum = ref(1);
      const pageSize = ref(10);
      const selection = ref([]);
      const tableRef = ref(null);
      const listCardRef = ref(null);

      const dlgVisible = ref(false);
      const dlgMode = ref('add');
      const form = ref(emptyForm());
      const activeTab = ref('material');
      const matSel = ref([]);
      const qcpSel = ref([]);

      const matDlg = ref(false);
      const matQuery = ref({ code: '', name: '' });
      const matPageNum = ref(1);
      const matPageSize = ref(10);
      const matPickRef = ref(null);

      const qcpDlg = ref(false);
      const qcpQuery = ref({ code: '', name: '' });
      const qcpPageNum = ref(1);
      const qcpPageSize = ref(10);
      const qcpPickRef = ref(null);

      const remarks = computed(() => ChromDriftRemarks.getPageRemarks('warning-rule'));
      const flow = computed(() => ChromDriftRemarks.getPageFlow('warning-rule'));
      const remarkMode = ChromDriftRemarkMode.state;
      const dialogTableHeight = 320;
      const pickerTableHeight = 280;

      const showMatTab = computed(() => V.visibleTabs(form.value.applyType).includes('material'));
      const showQcpTab = computed(() => V.visibleTabs(form.value.applyType).includes('qcp'));

      const dlgTitle = computed(() => (dlgMode.value === 'edit' ? '编辑' : '新增'));

      function decorate(row) {
        return {
          ...row,
          deviationTypeLabel: V.deviationTypeLabel(row.deviationType),
          uclText: V.formatLimit(row.uclOp, row.uclValue),
          lclText: V.formatLimit(row.lclOp, row.lclValue),
          matInfo: V.materialSummary(row),
          qcpInfo: V.qcpSummary(row),
        };
      }

      const filteredRows = computed(() => {
        const q = appliedQuery.value;
        let list = [...rules.value].map(decorate);
        if (q.code) list = list.filter((r) => r.code.includes(q.code));
        if (q.name) list = list.filter((r) => r.name.includes(q.name));
        if (q.deviationType) list = list.filter((r) => r.deviationType === q.deviationType);
        if (q.applyType) list = list.filter((r) => r.applyType === q.applyType);
        if (q.enabled === '1') list = list.filter((r) => r.enabled);
        if (q.enabled === '0') list = list.filter((r) => !r.enabled);
        list.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
        return list;
      });

      const pagedRows = computed(() => {
        const start = (pageNum.value - 1) * pageSize.value;
        return filteredRows.value.slice(start, start + pageSize.value);
      });

      const enabledMaterials = computed(() => SEED_MATERIALS.filter((m) => m.enabled));
      const matFiltered = computed(() => {
        const q = matQuery.value;
        return enabledMaterials.value.filter((m) => {
          if (q.code && !m.materialCode.includes(q.code)) return false;
          if (q.name && !m.materialName.includes(q.name)) return false;
          return true;
        });
      });
      const matPickPage = computed(() => {
        const s = (matPageNum.value - 1) * matPageSize.value;
        return matFiltered.value.slice(s, s + matPageSize.value);
      });

      const enabledQcp = computed(() => SEED_QCP.filter((q) => q.enabled));
      const qcpFiltered = computed(() => {
        const q = qcpQuery.value;
        return enabledQcp.value.filter((item) => {
          if (q.code && !item.qcpCode.includes(q.code)) return false;
          if (q.name && !item.qcpName.includes(q.name)) return false;
          return true;
        });
      });
      const qcpPickPage = computed(() => {
        const s = (qcpPageNum.value - 1) * qcpPageSize.value;
        return qcpFiltered.value.slice(s, s + qcpPageSize.value);
      });

      function doQuery() {
        appliedQuery.value = { ...query.value };
        pageNum.value = 1;
        ElMessage.success('查询完成');
      }

      function resetQuery() {
        query.value = { code: '', name: '', deviationType: '', applyType: '', enabled: '' };
        appliedQuery.value = {};
        pageNum.value = 1;
        ElMessage.info('已重置查询条件');
      }

      function refreshList() { ElMessage.success('列表已刷新'); }

      function getTableSelection() {
        const t = tableRef.value;
        if (!t?.getCheckboxRecords) return selection.value;
        const cur = t.getCheckboxRecords() || [];
        const reserved = t.getCheckboxReserveRecords?.() || [];
        const map = new Map();
        [...reserved, ...cur].forEach((r) => map.set(r.id, r));
        return [...map.values()];
      }

      function onSelChange() { selection.value = getTableSelection(); }

      function openAdd() {
        dlgMode.value = 'add';
        form.value = emptyForm();
        activeTab.value = 'material';
        dlgVisible.value = true;
      }

      function fillForm(row, isCopy) {
        const data = clone(row);
        delete data.deviationTypeLabel;
        delete data.uclText;
        delete data.lclText;
        delete data.matInfo;
        delete data.qcpInfo;
        if (isCopy) {
          data.id = '';
          data.code = '';
          data.name = '';
        }
        form.value = data;
        activeTab.value = 'material';
      }

      function editRow(row) {
        dlgMode.value = 'edit';
        fillForm(row, false);
        dlgVisible.value = true;
      }

      function copyRow(row) {
        dlgMode.value = 'copy';
        fillForm(row, true);
        dlgVisible.value = true;
      }

      function onApplyTypeChange() {
        const tabs = V.visibleTabs(form.value.applyType);
        if (!tabs.includes(activeTab.value)) activeTab.value = tabs[0] || 'material';
      }

      function onMatSel({ records }) { matSel.value = records; }
      function onQcpSel({ records }) { qcpSel.value = records; }

      function batchDelMat() {
        if (!matSel.value.length) { ElMessage.warning('请先勾选行'); return; }
        const ids = new Set(matSel.value.map((r) => r.id));
        form.value.materials = form.value.materials.filter((r) => !ids.has(r.id));
        matSel.value = [];
      }

      function batchDelQcp() {
        if (!qcpSel.value.length) { ElMessage.warning('请先勾选行'); return; }
        const ids = new Set(qcpSel.value.map((r) => r.id));
        form.value.qcpPoints = form.value.qcpPoints.filter((r) => !ids.has(r.id));
        qcpSel.value = [];
      }

      function openMatPicker() {
        matQuery.value = { code: '', name: '' };
        matPageNum.value = 1;
        matDlg.value = true;
      }

      function openQcpPicker() {
        qcpQuery.value = { code: '', name: '' };
        qcpPageNum.value = 1;
        qcpDlg.value = true;
      }

      function resetMatQuery() { matQuery.value = { code: '', name: '' }; }
      function resetQcpQuery() { qcpQuery.value = { code: '', name: '' }; }
      function filterMasters() {}

      function confirmMatPick() {
        const t = matPickRef.value;
        const picked = [...(t?.getCheckboxReserveRecords?.() || []), ...(t?.getCheckboxRecords?.() || [])];
        const exist = new Set((form.value.materials || []).map((m) => m.materialCode));
        let added = 0;
        picked.forEach((m) => {
          if (exist.has(m.materialCode)) return;
          exist.add(m.materialCode);
          form.value.materials.push({
            id: uid(),
            materialCode: m.materialCode,
            materialName: m.materialName,
            spec: m.spec,
            category: m.category,
            unit: m.unit,
            enabled: m.enabled,
          });
          added += 1;
        });
        matDlg.value = false;
        ElMessage.success(added ? `已添加 ${added} 条物料` : '所选物料均已存在，已跳过');
      }

      function confirmQcpPick() {
        const t = qcpPickRef.value;
        const picked = [...(t?.getCheckboxReserveRecords?.() || []), ...(t?.getCheckboxRecords?.() || [])];
        const exist = new Set((form.value.qcpPoints || []).map((q) => q.qcpCode));
        let added = 0;
        picked.forEach((q) => {
          if (exist.has(q.qcpCode)) return;
          exist.add(q.qcpCode);
          form.value.qcpPoints.push({ id: uid(), qcpCode: q.qcpCode, qcpName: q.qcpName, enabled: true });
          added += 1;
        });
        qcpDlg.value = false;
        ElMessage.success(added ? `已添加 ${added} 条 QCP` : '所选 QCP 均已存在，已跳过');
      }

      function submitForm() {
        const f = clone(form.value);
        const errs = V.validateWarningRule(f, rules.value, dlgMode.value === 'edit' ? f.id : '');
        if (errs.length) {
          ElMessage.error(errs[0]);
          return;
        }
        if (dlgMode.value === 'edit') {
          const idx = rules.value.findIndex((r) => r.id === f.id);
          if (idx >= 0) rules.value[idx] = { ...rules.value[idx], ...f };
          ElMessage.success('保存成功');
        } else {
          f.id = uid();
          f.createdAt = nowStr();
          f.createdBy = '当前用户';
          rules.value.unshift(f);
          ElMessage.success('新增成功');
        }
        dlgVisible.value = false;
      }

      function batchDelete() {
        const rows = getTableSelection();
        if (!rows.length) {
          ElMessage.warning('请先勾选要删除的行');
          return;
        }
        ElMessageBox.confirm(`确定删除选中的 ${rows.length} 条规则？`, '批量删除', {
          type: 'warning',
        }).then(() => {
          const ids = new Set(rows.map((r) => r.id));
          rules.value = rules.value.filter((r) => !ids.has(r.id));
          selection.value = [];
          tableRef.value?.clearCheckboxRow();
          tableRef.value?.clearCheckboxReserve?.();
          ElMessage.success('删除成功');
        }).catch(() => {});
      }

      function exportData() {
        const rows = getTableSelection().length ? getTableSelection() : filteredRows.value;
        if (!rows.length) { ElMessage.warning('无数据可导出'); return; }
        const header = ['规则编码', '规则名称', '偏差类型', 'UCL', 'LCL', '适用类型', '备注'];
        const lines = rows.map((r) => [
          r.code, r.name, r.deviationTypeLabel, r.uclText, r.lclText, r.applyType, r.remark || '',
        ].join(','));
        const blob = new Blob([`\uFEFF${header.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '偏差预警规则.csv';
        a.click();
        ElMessage.success('导出完成');
      }

      function toggleFullscreen() {
        const el = listCardRef.value;
        if (!el) return;
        if (!document.fullscreenElement) el.requestFullscreen?.();
        else document.exitFullscreen?.();
      }

      function toast(name) { ElMessage.info(`${name}（Demo 占位）`); }
      function onDlgClosed() { matSel.value = []; qcpSel.value = []; }

      return {
        query, applyTypes: APPLY_TYPES, deviationTypes: DEVIATION_TYPES,
        upperOps: UPPER_LIMIT_OPS, lowerOps: LOWER_LIMIT_OPS, pageSizes: PAGE_SIZES,
        doQuery, resetQuery, refreshList, pagedRows, filteredRows, pageNum, pageSize,
        onSelChange, openAdd, editRow, copyRow, batchDelete, exportData, toggleFullscreen, toast,
        dlgVisible, dlgTitle, form, activeTab, showMatTab, showQcpTab, onApplyTypeChange,
        batchDelMat, batchDelQcp, onMatSel, onQcpSel,
        matDlg, matQuery, matPickPage, matFiltered, matPageNum, matPageSize, matPickRef,
        openMatPicker, confirmMatPick, resetMatQuery, filterMasters,
        qcpDlg, qcpQuery, qcpPickPage, qcpFiltered, qcpPageNum, qcpPageSize, qcpPickRef,
        openQcpPicker, confirmQcpPick, resetQcpQuery,
        submitForm, onDlgClosed, remarks, flow, remarkMode, dialogTableHeight, pickerTableHeight,
        tableRef, listCardRef,
      };
    },
  };
})();
