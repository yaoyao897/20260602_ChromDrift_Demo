/**
 * M1 · 漂移规则设置
 */
(function () {
  const { ref, computed, watch, reactive } = Vue;
  const { ElMessage, ElMessageBox } = ElementPlus;
  const { usePersistedRef, uid, nowStr, clone } = ChromDriftStorage;
  const { SEED_DRIFT_RULES } = ChromDriftSeedDriftRules;
  const { SEED_MATERIALS, SEED_QCP } = ChromDriftSeedMasters;
  const { LEDGER_TYPES, APPLY_TYPES, RT_ACCUM_MODES, PAGE_SIZES } = ChromDriftEnums;
  const V = ChromDriftDriftValidators;

  function emptyForm() {
    return {
      id: '',
      code: '',
      name: '',
      rtAccumMode: 'fixed',
      deviationMin: -0.002,
      deviationMax: 0.002,
      ledgerType: 'GC',
      applyType: '原材料',
      remark: '',
      enabled: true,
      trRows: [],
      materials: [],
      qcpPoints: [],
    };
  }

  window.ChromDriftDriftRulePage = {
    name: 'DriftRulePage',
    template: `
      <div class="drift-rule-page">
        <demo-query-panel :model="query" @submit="doQuery">
          <demo-query-field label="规则编码">
            <el-input v-model="query.code" clearable placeholder="模糊查询" @keyup.enter="doQuery" />
          </demo-query-field>
          <demo-query-field label="规则名称">
            <el-input v-model="query.name" clearable placeholder="模糊查询" @keyup.enter="doQuery" />
          </demo-query-field>
          <demo-query-field label="适用台账类型">
            <el-select v-model="query.ledgerType" clearable placeholder="全部">
              <el-option v-for="o in ledgerTypes" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </demo-query-field>
          <demo-query-field label="适用类型">
            <el-select v-model="query.applyType" clearable placeholder="全部">
              <el-option v-for="o in applyTypes" :key="o.value" :label="o.label" :value="o.value" />
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
              <vxe-column field="rtModeLabel" title="典型保留时间数量" min-width="100" show-overflow />
              <vxe-column field="deviationText" title="RRT&amp;tR的偏差范围" min-width="100" show-overflow />
              <vxe-column field="ledgerType" title="适用台账类型" min-width="100" show-overflow />
              <vxe-column field="applyType" title="适用类型" min-width="100" show-overflow />
              <vxe-column field="trInfo" title="典型保留时间信息" min-width="100" show-overflow />
              <vxe-column field="matInfo" title="适用物料" min-width="100" show-overflow />
              <vxe-column field="qcpInfo" title="适用QCP点" min-width="100" show-overflow />
              <vxe-column title="启用状态" min-width="80" show-overflow>
                <template #default="{ row }">
                  <el-tag :type="row.enabled ? 'success' : 'info'" size="small">{{ row.enabled ? '启用' : '禁用' }}</el-tag>
                </template>
              </vxe-column>
              <vxe-column field="createdAt" title="创建时间" min-width="100" show-overflow class-name="col-secondary" />
              <vxe-column field="createdBy" title="创建人" min-width="80" show-overflow />
              <vxe-column title="操作" width="160" fixed="right">
                <template #default="{ row }">
                  <el-button link type="primary" @click="copyRow(row)">复制</el-button>
                  <el-button link type="primary" @click="editRow(row)">编辑</el-button>
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

        <!-- 新增/编辑弹窗 -->
        <el-dialog
          v-model="dlgVisible"
          class="demo-dialog"
          :title="dlgTitle"
          width="960px"
          destroy-on-close
          :close-on-click-modal="false"
          @closed="onDlgClosed"
        >
          <el-form label-width="200px" size="default" :model="form" class="demo-dialog-form">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="规则编码" required>
                  <el-input v-model="form.code" placeholder="输入,唯一" />
                </el-form-item>
                <demo-field-remark v-if="remarkMode" v-bind="fieldRemarkProps('driftRule', 'code')" />
              </el-col>
              <el-col :span="12">
                <el-form-item label="规则名称" required>
                  <el-input v-model="form.name" placeholder="输入,唯一" />
                </el-form-item>
                <demo-field-remark v-if="remarkMode" v-bind="fieldRemarkProps('driftRule', 'name')" />
              </el-col>
              <el-col :span="12">
                <el-form-item label="典型保留时间数量" required>
                  <el-select v-model="form.rtAccumMode" style="width:100%">
                    <el-option v-for="o in rtModes" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
                <demo-field-remark v-if="remarkMode" v-bind="fieldRemarkProps('driftRule', 'rtAccumMode')" />
              </el-col>
              <el-col :span="12">
                <el-form-item label="适用台账类型" required>
                  <el-select v-model="form.ledgerType" style="width:100%">
                    <el-option v-for="o in ledgerTypes" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
                <demo-field-remark v-if="remarkMode" v-bind="fieldRemarkProps('driftRule', 'ledgerType')" />
              </el-col>
              <el-col :span="24">
                <el-form-item label="RRT&amp;tR差值范围" required class="demo-form-item-deviation">
                  <div class="demo-form-deviation">
                    <el-select v-model="devSignMin" class="demo-form-deviation__sign">
                      <el-option label="-" value="-" />
                      <el-option label="+" value="+" />
                    </el-select>
                    <el-input-number v-model="devAbsMin" :min="0" :step="0.001" :precision="3" controls-position="right" class="demo-form-deviation__num" />
                    <span class="demo-form-deviation__sep">~</span>
                    <el-select v-model="devSignMax" class="demo-form-deviation__sign">
                      <el-option label="-" value="-" />
                      <el-option label="+" value="+" />
                    </el-select>
                    <el-input-number v-model="devAbsMax" :min="0" :step="0.001" :precision="3" controls-position="right" class="demo-form-deviation__num" />
                  </div>
                </el-form-item>
                <demo-field-remark v-if="remarkMode" v-bind="fieldRemarkProps('driftRule', 'deviationRange')" />
              </el-col>
              <el-col :span="12">
                <el-form-item label="适用类型" required>
                  <el-select v-model="form.applyType" style="width:100%" @change="onApplyTypeChange">
                    <el-option v-for="o in applyTypes" :key="o.value" :label="o.label" :value="o.value" />
                  </el-select>
                </el-form-item>
                <demo-field-remark v-if="remarkMode" v-bind="fieldRemarkProps('driftRule', 'applyType')" />
              </el-col>
              <el-col :span="12">
                <el-form-item label="启用状态" required>
                  <el-switch v-model="form.enabled" active-text="启用" inactive-text="禁用" />
                </el-form-item>
                <demo-field-remark v-if="remarkMode" v-bind="fieldRemarkProps('driftRule', 'enabled')" />
              </el-col>
              <el-col :span="24">
                <el-form-item label="备注">
                  <el-input v-model="form.remark" />
                </el-form-item>
                <demo-field-remark v-if="remarkMode" v-bind="fieldRemarkProps('driftRule', 'remark')" />
              </el-col>
            </el-row>
          </el-form>

          <el-tabs v-model="activeTab" class="demo-dialog-tabs">
            <el-tab-pane label="tR典型保留时间" name="tr">
              <p v-if="trSubtableOptional" class="demo-form-hint" style="margin:0 0 8px;color:var(--el-text-color-secondary);font-size:12px">
                典型保留时间数量为「按批次新杂滚动叠加」或「首批次新杂滚动」时，tR 子表可不填，列头由图谱识别保存后回写滚动叠加行。
              </p>
              <template v-if="remarkMode">
                <demo-field-remark v-bind="fieldRemarkProps('driftRule', 'trRowType')" />
                <demo-field-remark v-bind="fieldRemarkProps('driftRule', 'trTypicalRt')" />
                <demo-field-remark v-bind="fieldRemarkProps('driftRule', 'trCompoundName')" />
                <demo-field-remark v-if="showTrQcpCol" v-bind="fieldRemarkProps('driftRule', 'trApplyQcp')" />
              </template>
              <div style="margin-bottom:8px">
                <el-button type="primary" @click="addTrRow">添加一行</el-button>
                <el-button @click="toast('导入数据')">导入数据</el-button>
                <el-button type="danger" @click="batchDelTr">批量删除</el-button>
              </div>
              <vxe-table
                :data="form.trRows"
                border
                class="demo-dialog-table"
                :height="dialogTableHeight"
                :row-config="{ keyField: 'id' }"
                :checkbox-config="{ highlight: true }"
                @checkbox-change="onTrSel"
                @checkbox-all="onTrSel"
              >
                <vxe-column type="checkbox" width="42" />
                <vxe-column title="类型" width="96">
                  <template #default="{ row }">{{ rowTypeLabel(row) }}</template>
                </vxe-column>
                <vxe-column title="适用物料" width="100" show-overflow>
                  <template #default="{ row }">{{ row.applyMaterial || '/' }}</template>
                </vxe-column>
                <vxe-column v-if="showTrQcpCol" title="适用QCP" width="90" show-overflow>
                  <template #default="{ row }">{{ row.applyQcp || '/' }}</template>
                </vxe-column>
                <vxe-column title="主峰" width="70">
                  <template #default="{ row }">
                    <el-radio v-model="mainPeakId" :label="row.id" :disabled="isRollingRow(row)">&nbsp;</el-radio>
                  </template>
                </vxe-column>
                <vxe-column title="典型保留时间" min-width="120">
                  <template #default="{ row }">
                    <el-input-number
                      v-model="row.typicalRt"
                      :step="0.01"
                      :precision="4"
                      controls-position="right"
                      style="width:100%"
                      :disabled="isRollingRow(row)"
                    />
                  </template>
                </vxe-column>
                <vxe-column title="化合物名称" min-width="120">
                  <template #default="{ row }">
                    <el-input v-model="row.compoundName" :disabled="isRollingRow(row)" />
                  </template>
                </vxe-column>
              </vxe-table>
            </el-tab-pane>

            <el-tab-pane v-if="showMatTab" label="物料" name="material">
              <demo-field-remark v-if="remarkMode" v-bind="fieldRemarkProps('driftRule', 'matCode')" />
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
              <demo-field-remark v-if="remarkMode" v-bind="fieldRemarkProps('driftRule', 'qcpCode')" />
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
                  <template #default="{ row }">
                    <el-tag type="success" size="small">启用</el-tag>
                  </template>
                </vxe-column>
              </vxe-table>
            </el-tab-pane>
          </el-tabs>

          <template #footer>
            <el-button @click="dlgVisible = false">取消</el-button>
            <el-button type="primary" @click="submitForm">提交</el-button>
          </template>
        </el-dialog>

        <!-- 详情弹窗 -->
        <el-dialog
          v-model="detailVisible"
          class="demo-dialog"
          title="详情"
          width="960px"
          destroy-on-close
          :close-on-click-modal="false"
          @closed="onDetailClosed"
        >
          <el-form label-width="200px" size="default" :model="detailForm" class="demo-dialog-form" disabled>
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="规则编码"><el-input :model-value="detailForm.code" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="规则名称"><el-input :model-value="detailForm.name" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="典型保留时间数量">
                  <el-input :model-value="detailRtModeLabel" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="适用台账类型"><el-input :model-value="detailForm.ledgerType" /></el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="相对保留时间与典型保留时间差值范围">
                  <el-input :model-value="detailDeviationText" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="适用类型"><el-input :model-value="detailForm.applyType" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="启用状态">
                  <el-input :model-value="detailForm.enabled ? '启用' : '禁用'" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="创建时间"><el-input :model-value="detailForm.createdAt" /></el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="创建人"><el-input :model-value="detailForm.createdBy" /></el-form-item>
              </el-col>
              <el-col :span="24">
                <el-form-item label="备注"><el-input :model-value="detailForm.remark" /></el-form-item>
              </el-col>
            </el-row>
          </el-form>

          <el-tabs v-model="detailActiveTab" class="demo-dialog-tabs">
            <el-tab-pane label="tR典型保留时间" name="tr">
              <vxe-table
                :data="detailForm.trRows"
                border
                class="demo-dialog-table"
                :height="dialogTableHeight"
                :row-config="{ keyField: 'id' }"
              >
                <vxe-column title="类型" width="96">
                  <template #default="{ row }">{{ rowTypeLabel(row) }}</template>
                </vxe-column>
                <vxe-column title="适用物料" width="100" show-overflow>
                  <template #default="{ row }">{{ row.applyMaterial || '/' }}</template>
                </vxe-column>
                <vxe-column v-if="detailShowTrQcpCol" title="适用QCP" width="90" show-overflow>
                  <template #default="{ row }">{{ row.applyQcp || '/' }}</template>
                </vxe-column>
                <vxe-column title="主峰" width="70">
                  <template #default="{ row }">{{ row.isMainPeak ? '是' : '否' }}</template>
                </vxe-column>
                <vxe-column title="典型保留时间" min-width="130">
                  <template #default="{ row }">
                    <span v-if="!isRollingRow(row)">{{ row.typicalRt }}</span>
                    <el-input-number
                      v-else
                      v-model="row.typicalRt"
                      :step="0.0001"
                      :precision="4"
                      controls-position="right"
                      style="width:100%"
                    />
                  </template>
                </vxe-column>
                <vxe-column title="化合物名称" min-width="120">
                  <template #default="{ row }">
                    <span v-if="!isRollingRow(row)">{{ row.compoundName }}</span>
                    <el-input v-else v-model="row.compoundName" />
                  </template>
                </vxe-column>
              </vxe-table>
              <p v-if="detailHasRolling" class="demo-form-hint" style="margin-top:8px;color:var(--el-text-color-secondary);font-size:12px">
                滚动叠加行由图谱识别保存回写；可在此修正典型保留时间、化合物名称，保存后台账列头实时刷新。
              </p>
            </el-tab-pane>

            <el-tab-pane label="物料" name="material">
              <vxe-table
                :data="detailForm.materials"
                border
                class="demo-dialog-table"
                :height="dialogTableHeight"
                :row-config="{ keyField: 'id' }"
              >
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

            <el-tab-pane v-if="detailShowQcpTab" label="QCP点" name="qcp">
              <vxe-table
                :data="detailForm.qcpPoints"
                border
                class="demo-dialog-table"
                :height="dialogTableHeight"
                :row-config="{ keyField: 'id' }"
              >
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
            <el-button @click="detailVisible = false">关闭</el-button>
            <el-button type="primary" @click="saveDetail">保存</el-button>
          </template>
        </el-dialog>

        <!-- 物料选择 -->
        <el-dialog v-model="matDlg" class="demo-dialog" title="物料列表" width="760px" destroy-on-close>
          <el-form :inline="true" size="default" :model="matQuery" @submit.prevent="filterMasters">
            <el-form-item label="物料编码"><el-input v-model="matQuery.code" clearable style="width:120px" /></el-form-item>
            <el-form-item label="物料名称"><el-input v-model="matQuery.name" clearable style="width:120px" /></el-form-item>
            <el-form-item>
              <el-button type="primary" native-type="submit">查询</el-button>
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
            style="margin-top:8px"
          />
          <template #footer>
            <el-button @click="matDlg = false">取消</el-button>
            <el-button type="primary" @click="confirmMatPick">保存</el-button>
          </template>
        </el-dialog>

        <!-- QCP 选择 -->
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
      DemoFieldRemark: ChromDriftFieldRemark,
    },
    setup() {
      const rules = usePersistedRef('drift-rules', SEED_DRIFT_RULES);
      const query = ref({ code: '', name: '', ledgerType: '', applyType: '' });
      const appliedQuery = ref({});
      const pageNum = ref(1);
      const pageSize = ref(10);
      const selection = ref([]);
      const tableRef = ref(null);
      const listCardRef = ref(null);

      const dlgVisible = ref(false);
      const dlgMode = ref('add');
      const form = ref(emptyForm());
      const activeTab = ref('tr');
      const trSel = ref([]);
      const matSel = ref([]);
      const qcpSel = ref([]);

      const detailVisible = ref(false);
      const detailForm = ref(emptyForm());
      const detailActiveTab = ref('tr');
      const detailSourceId = ref('');

      const devSignMin = ref('-');
      const devSignMax = ref('+');
      const devAbsMin = ref(0.002);
      const devAbsMax = ref(0.002);

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

      const remarks = computed(() => ChromDriftRemarks.getPageRemarks('drift-rule'));
      const flow = computed(() => ChromDriftRemarks.getPageFlow('drift-rule'));
      const remarkMode = ChromDriftRemarkMode.state;

      const dialogTableHeight = 320;
      const pickerTableHeight = 280;

      const mainPeakId = computed({
        get() {
          const m = (form.value.trRows || []).find((r) => r.isMainPeak);
          return m ? m.id : '';
        },
        set(id) {
          (form.value.trRows || []).forEach((r) => { r.isMainPeak = r.id === id; });
        },
      });

      const showMatTab = computed(() => V.visibleTabs(form.value.applyType).includes('material'));
      const showQcpTab = computed(() => V.visibleTabs(form.value.applyType).includes('qcp'));
      const showTrQcpCol = computed(() => V.showTrApplyQcp(form.value.applyType));
      const detailShowTrQcpCol = computed(() => V.showTrApplyQcp(detailForm.value.applyType));
      const trSubtableOptional = computed(() => V.isRollingRtMode(form.value.rtAccumMode));
      const detailShowQcpTab = computed(() => V.visibleTabs(detailForm.value.applyType).includes('qcp'));
      const detailRtModeLabel = computed(() => V.rtModeLabel(detailForm.value.rtAccumMode));
      const detailDeviationText = computed(() => V.formatDeviationRange(
        detailForm.value.deviationMin,
        detailForm.value.deviationMax,
      ));
      const detailHasRolling = computed(() => (detailForm.value.trRows || []).some((r) => V.isRollingRow(r)));

      const isRollingRow = V.isRollingRow;
      const rowTypeLabel = V.rowTypeLabel;

      const dlgTitle = computed(() => {
        if (dlgMode.value === 'add') return '新增';
        if (dlgMode.value === 'copy') return '新增';
        return '编辑';
      });

      function decorate(row) {
        const trs = row.trRows || [];
        const trInfo = trs.length
          ? trs.map((r) => Number(r.typicalRt).toFixed(2)).join(',')
          : '/';
        return {
          ...row,
          rtModeLabel: V.rtModeLabel(row.rtAccumMode),
          deviationText: V.formatDeviationRange(row.deviationMin, row.deviationMax),
          trInfo,
          matInfo: V.materialSummary(row),
          qcpInfo: V.qcpSummary(row),
        };
      }

      const filteredRows = computed(() => {
        const q = appliedQuery.value;
        let list = [...rules.value].map(decorate);
        if (q.code) list = list.filter((r) => r.code.includes(q.code));
        if (q.name) list = list.filter((r) => r.name.includes(q.name));
        if (q.ledgerType) list = list.filter((r) => r.ledgerType === q.ledgerType);
        if (q.applyType) list = list.filter((r) => r.applyType === q.applyType);
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

      function syncDevToForm() {
        const s = (sign, abs) => (sign === '-' ? -abs : abs);
        form.value.deviationMin = s(devSignMin.value, devAbsMin.value);
        form.value.deviationMax = s(devSignMax.value, devAbsMax.value);
      }

      function loadDevFromForm(f) {
        const load = (n) => {
          const sign = n < 0 ? '-' : '+';
          return { sign, abs: Math.abs(n) };
        };
        const a = load(f.deviationMin ?? -0.002);
        const b = load(f.deviationMax ?? 0.002);
        devSignMin.value = a.sign;
        devAbsMin.value = a.abs;
        devSignMax.value = b.sign;
        devAbsMax.value = b.abs;
      }

      function doQuery() {
        appliedQuery.value = { ...query.value };
        pageNum.value = 1;
        ElMessage.success('查询完成');
      }

      function resetQuery() {
        query.value = { code: '', name: '', ledgerType: '', applyType: '' };
        appliedQuery.value = {};
        pageNum.value = 1;
        ElMessage.info('已重置查询条件');
      }

      function refreshList() {
        ElMessage.success('列表已刷新');
      }

      function getTableSelection() {
        const t = tableRef.value;
        if (!t?.getCheckboxRecords) return selection.value;
        const cur = t.getCheckboxRecords() || [];
        const reserved = t.getCheckboxReserveRecords?.() || [];
        const map = new Map();
        [...reserved, ...cur].forEach((r) => map.set(r.id, r));
        return [...map.values()];
      }

      function onSelChange() {
        selection.value = getTableSelection();
      }

      function openAdd() {
        dlgMode.value = 'add';
        form.value = emptyForm();
        loadDevFromForm(form.value);
        activeTab.value = 'tr';
        dlgVisible.value = true;
      }

      function fillForm(row, isCopy) {
        const data = clone(row);
        if (isCopy) {
          data.id = '';
          data.code = '';
          data.name = '';
          data.trRows = (data.trRows || []).filter((r) => !V.isRollingRow(r));
        }
        form.value = data;
        loadDevFromForm(form.value);
        activeTab.value = 'tr';
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

      function openDetail(row) {
        detailSourceId.value = row.id;
        detailForm.value = clone(rules.value.find((r) => r.id === row.id) || row);
        detailActiveTab.value = 'tr';
        detailVisible.value = true;
      }

      function saveDetail() {
        const f = clone(detailForm.value);
        const errs = V.validateRollingTrSave(f);
        if (errs.length) {
          ElMessage.error(errs[0]);
          return;
        }
        const idx = rules.value.findIndex((r) => r.id === detailSourceId.value);
        if (idx < 0) {
          ElMessage.error('规则不存在');
          return;
        }
        rules.value[idx] = { ...rules.value[idx], trRows: f.trRows };
        detailVisible.value = false;
        ElMessage.success('保存成功，台账列头将随详情 tR 实时刷新');
      }

      function onDetailClosed() {
        detailForm.value = emptyForm();
        detailSourceId.value = '';
      }

      function onApplyTypeChange() {
        const tabs = V.visibleTabs(form.value.applyType);
        if (!tabs.includes(activeTab.value)) activeTab.value = 'tr';
      }

      function addTrRow() {
        form.value.trRows.push({
          id: uid(),
          rowType: 'initial',
          applyMaterial: '',
          applyQcp: '',
          typicalRt: 0,
          compoundName: '',
          isMainPeak: false,
        });
      }

      function onTrSel({ records }) { trSel.value = records; }
      function onMatSel({ records }) { matSel.value = records; }
      function onQcpSel({ records }) { qcpSel.value = records; }

      function batchDelTr() {
        if (!trSel.value.length) { ElMessage.warning('请先勾选行'); return; }
        const deletable = trSel.value.filter((r) => !V.isRollingRow(r));
        if (!deletable.length) {
          ElMessage.warning('滚动叠加行不可删除');
          return;
        }
        const ids = new Set(deletable.map((r) => r.id));
        form.value.trRows = form.value.trRows.filter((r) => !ids.has(r.id));
        trSel.value = [];
      }

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
      function filterMasters() { /* reactive filter */ }

      function confirmMatPick() {
        const t = matPickRef.value;
        const picked = [
          ...(t?.getCheckboxReserveRecords?.() || []),
          ...(t?.getCheckboxRecords?.() || []),
        ];
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
        const picked = [
          ...(t?.getCheckboxReserveRecords?.() || []),
          ...(t?.getCheckboxRecords?.() || []),
        ];
        const exist = new Set((form.value.qcpPoints || []).map((q) => q.qcpCode));
        let added = 0;
        picked.forEach((q) => {
          if (exist.has(q.qcpCode)) return;
          exist.add(q.qcpCode);
          form.value.qcpPoints.push({
            id: uid(),
            qcpCode: q.qcpCode,
            qcpName: q.qcpName,
            enabled: true,
          });
          added += 1;
        });
        qcpDlg.value = false;
        ElMessage.success(added ? `已添加 ${added} 条 QCP` : '所选 QCP 均已存在，已跳过');
      }

      function submitForm() {
        syncDevToForm();
        const f = clone(form.value);
        const errs = V.validateDriftRule(f, rules.value, dlgMode.value === 'edit' ? f.id : '');
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
        const header = ['规则编码', '规则名称', '典型保留时间数量', '偏差范围', '适用台账类型', '适用类型'];
        const lines = rows.map((r) => [
          r.code, r.name, r.rtModeLabel, r.deviationText, r.ledgerType, r.applyType,
        ].join(','));
        const blob = new Blob([`\uFEFF${header.join(',')}\n${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = '漂移规则.csv';
        a.click();
        ElMessage.success('导出完成');
      }

      function toggleFullscreen() {
        const el = listCardRef.value;
        if (!el) return;
        if (!document.fullscreenElement) {
          el.requestFullscreen?.();
        } else {
          document.exitFullscreen?.();
        }
      }

      function toast(name) { ElMessage.info(`${name}（Demo 占位）`); }
      function onDlgClosed() {
        trSel.value = [];
        matSel.value = [];
        qcpSel.value = [];
      }

      return {
        query, ledgerTypes: LEDGER_TYPES, applyTypes: APPLY_TYPES, rtModes: RT_ACCUM_MODES, pageSizes: PAGE_SIZES,
        doQuery, resetQuery, refreshList, pagedRows, filteredRows, pageNum, pageSize,
        onSelChange, openAdd, editRow, copyRow, openDetail, saveDetail, onDetailClosed, batchDelete, exportData, toggleFullscreen, toast,
        dlgVisible, dlgTitle, form, activeTab, showMatTab, showQcpTab, showTrQcpCol, detailShowTrQcpCol, trSubtableOptional, mainPeakId,
        detailVisible, detailForm, detailActiveTab, detailShowQcpTab, detailRtModeLabel, detailDeviationText, detailHasRolling,
        isRollingRow, rowTypeLabel,
        devSignMin, devSignMax, devAbsMin, devAbsMax,
        addTrRow, batchDelTr, batchDelMat, batchDelQcp, onTrSel, onMatSel, onQcpSel, onApplyTypeChange,
        matDlg, matQuery, matPickPage, matFiltered, matPageNum, matPageSize, matPickRef, openMatPicker, confirmMatPick, resetMatQuery, filterMasters,
        qcpDlg, qcpQuery, qcpPickPage, qcpFiltered, qcpPageNum, qcpPageSize, qcpPickRef, openQcpPicker, confirmQcpPick, resetQcpQuery,
        submitForm, onDlgClosed, remarks, flow, remarkMode,
        fieldRemarkProps: ChromDriftFormFieldRemarks.fieldRemarkProps,
        dialogTableHeight, pickerTableHeight, tableRef, listCardRef,
      };
    },
  };
})();
