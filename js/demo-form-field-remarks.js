/**
 * ③ 新增/编辑表单字段备注 · 与 PRD《字段备注清单》对齐
 */
(function () {
  function fieldSpec(o) {
    const p = [];
    if (o.type) p.push(`类型：${o.type}`);
    if (o.source) p.push(`来源：${o.source}`);
    if (o.required != null) p.push(`必填：${o.required}`);
    if (o.format) p.push(`格式/取值：${o.format}`);
    if (o.unique) p.push(`唯一/校验：${o.unique}`);
    if (o.readonly) p.push(`只读/联动：${o.readonly}`);
    if (o.note) p.push(`说明：${o.note}`);
    return p;
  }

  const s = fieldSpec;

  const PAGE_FORM_FIELD_LABELS = {
    driftRule: {
      code: '规则编码',
      name: '规则名称',
      rtAccumMode: '典型保留时间数量',
      deviationRange: 'RRT&tR差值范围',
      ledgerType: '适用台账类型',
      applyType: '适用类型',
      remark: '备注',
      enabled: '启用状态',
      trRowType: '类型（tR子表）',
      trApplyMaterial: '适用物料（tR行级）',
      trApplyQcp: '适用QCP（tR行级）',
      trMainPeak: '主峰',
      trTypicalRt: '典型保留时间',
      trCompoundName: '化合物名称',
      matCode: '物料编码',
      matName: '物料名称',
      qcpCode: 'QCP编码',
      qcpName: 'QCP名称',
    },
    warningRule: {
      code: '规则编码',
      name: '规则名称',
      deviationType: '偏差类型',
      usl: 'USL',
      lsl: 'LSL',
      ucl: 'UCL',
      lcl: 'LCL',
      applyType: '适用类型',
      remark: '备注',
      enabled: '启用状态',
      matCode: '物料编码',
      qcpCode: 'QCP编码',
    },
    recognition: {
      ledgerType: '台账类型',
      applyType: '类型',
      file: '文件',
      fileName: '文件名称',
      fileSavedAt: '保存时间',
      sampleName: '样品名称',
      instrumentCode: '仪器编号',
      instrumentName: '仪器名称',
      materialInfo: '物料信息',
      batchNo: '批号',
      qcpPoint: 'QCP点',
      ruleName: '规则名称',
      warningRuleName: '预警规则名称',
      hasNewImpurity: '是否存在新杂',
      hasExcessImpurity: '是否存在超标新杂',
      attachment: '附件',
      remark: '备注',
      detAbnormalNote: '异常说明',
      detPeakNo: '图谱峰号',
      detRt: '图谱保留时间',
      detArea: '图谱峰面积',
      detComponent: '组分名',
      detMainPeak: '是否主峰',
      detRrt: '相对保留时间',
      detTypicalRt: '对应典型保留时间',
      detLocked: '是否锁定',
      detDeviationRange: '理论偏差范围',
      detNewImpurity: '是否新杂',
      detExcessImpurity: '是否超标新杂',
    },
    ledgerCategory: {
      materialCode: '物料编码',
      qcpCode: 'QCP点',
    },
    ledgerSummary: {
      applyType: '类型',
      materialInfo: '物料信息',
      qcpPoint: 'QCP点',
      batchNo: '批号',
    },
  };

  const PAGE_FORM_FIELD_REMARKS = {
    driftRule: {
      code: s({
        type: '文本',
        source: '手工录入',
        required: '是',
        format: '全局唯一',
        unique: '规则编码不可重复',
        readonly: '复制时清空后重新录入',
      }),
      name: s({
        type: '文本',
        source: '手工录入',
        required: '是',
        format: '全局唯一',
        unique: '规则名称不可重复',
        readonly: '复制时清空',
      }),
      rtAccumMode: s({
        type: '枚举',
        source: '下拉',
        required: '是',
        format: '按固定值不叠加 / 按批次新杂滚动叠加 / 首批次新杂滚动',
        readonly: '控制图谱保存是否回写台账典型 RT 列及滚动叠加行',
        note: '默认按固定值不叠加',
      }),
      deviationRange: s({
        type: '数值区间',
        source: '手工录入',
        required: '是',
        format: '符号+正数×2，中间 ~；如 -0.002~0.002',
        readonly: '图谱识别明细「理论偏差范围」来源；M=T就近−T相对 校验',
      }),
      ledgerType: s({
        type: '枚举',
        source: '下拉',
        required: '是',
        format: 'GC / LC',
        readonly: '与图谱识别台账类型匹配维度一致',
      }),
      applyType: s({
        type: '枚举',
        source: '下拉',
        required: '是',
        format: '原材料 / 生产过程 / 生产物料',
        readonly: '驱动物料/QCP Tab 显隐与子表必填',
      }),
      remark: s({ type: '文本', source: '手工录入', required: '否' }),
      enabled: s({
        type: '开关',
        source: '手工录入',
        required: '是',
        format: '启用 / 禁用',
        readonly: '禁用规则不参与图谱自动匹配',
      }),
      trRowType: s({
        type: '枚举',
        source: '系统/手工',
        required: '是',
        format: '初始设置 / 滚动叠加',
        readonly: '初始=规则建档；滚动=图谱保存回写；滚动行新增页不可删',
      }),
      trApplyMaterial: s({
        type: '引用',
        source: '滚动行填写',
        required: '条件',
        format: '物料编码；初始行可留空=共用',
        readonly: '与物料子表一致；供台账按物料过滤列集',
      }),
      trApplyQcp: s({
        type: '引用',
        source: '滚动行填写',
        required: '条件',
        format: 'QCP 编码',
        readonly: '仅生产过程展示列；与 QCP 子表一致',
      }),
      trMainPeak: s({
        type: '单选',
        source: '手工录入',
        required: '是',
        format: '有且仅一行初始设置为主峰',
        readonly: 'RRT 计算分母；滚动模式子表可空时跳过',
      }),
      trTypicalRt: s({
        type: '数值',
        source: '手工/系统',
        required: '条件',
        format: '按类型+物料+QCP 子表内唯一',
        readonly: '固定模式必填；滚动模式可不填初始行；台账列头实时取值',
        note: '滚动行由系统写入图谱保留时间',
      }),
      trCompoundName: s({
        type: '文本',
        source: '手工/系统',
        required: '是',
        format: '与典型 RT 同行',
        readonly: '台账定型结构来源',
      }),
      matCode: s({
        type: '引用',
        source: '物料选择器',
        required: '条件',
        format: '物料信息 ID',
        unique: '子表内物料编码唯一',
        readonly: '原材料/生产物料必填；生产过程非必填',
      }),
      matName: s({
        type: '引用',
        source: '随物料编码带出',
        required: '—',
        readonly: '只读',
      }),
      qcpCode: s({
        type: '引用',
        source: 'QCP 选择器',
        required: '条件',
        format: 'QCP 列表 ID',
        unique: '子表内 QCP 编码唯一',
        readonly: '生产过程类型下必填',
      }),
      qcpName: s({
        type: '引用',
        source: '随 QCP 编码带出',
        required: '—',
        readonly: '只读',
      }),
    },
    warningRule: {
      code: s({
        type: '文本',
        source: '手工录入',
        required: '是',
        unique: '全局唯一',
        readonly: '复制时清空',
      }),
      name: s({
        type: '文本',
        source: '手工录入',
        required: '是',
        unique: '全局唯一',
        readonly: '复制时清空',
      }),
      deviationType: s({
        type: '枚举',
        source: '下拉',
        required: '是',
        format: '超标新杂（可扩展）',
        readonly: '驱动图谱预警判定类型',
      }),
      usl: s({
        type: '阈值',
        source: '手工录入',
        required: '否',
        format: '比较符（≤/＜）+ 数值',
        readonly: '上规格限；仅表单维护，列表默认不展示',
      }),
      lsl: s({
        type: '阈值',
        source: '手工录入',
        required: '否',
        format: '比较符（≥/＞）+ 数值',
        readonly: '下规格限；仅表单维护',
      }),
      ucl: s({
        type: '阈值',
        source: '手工录入',
        required: '否',
        format: '比较符+数值，如 ≤0.05',
        readonly: '图谱判定超标新杂主阈值；列表展示',
      }),
      lcl: s({
        type: '阈值',
        source: '手工录入',
        required: '否',
        format: '比较符（≥/＞）+ 数值',
        readonly: '下控制限',
      }),
      applyType: s({
        type: '枚举',
        source: '下拉',
        required: '是',
        format: '原材料 / 生产过程 / 生产物料',
        readonly: '无适用台账类型；驱动子表 Tab',
      }),
      remark: s({ type: '文本', source: '手工录入', required: '否' }),
      enabled: s({
        type: '开关',
        required: '是',
        readonly: '禁用不参与图谱匹配',
      }),
      matCode: s({
        type: '引用',
        required: '条件',
        unique: '子表内唯一',
        readonly: '适用物料 Tab；选择器仅展示启用物料',
      }),
      qcpCode: s({
        type: '引用',
        required: '条件',
        unique: '子表内唯一',
        readonly: '生产过程 QCP 必填',
      }),
    },
    recognition: {
      ledgerType: s({
        type: '枚举',
        required: '是',
        format: 'GC / LC',
        readonly: '决定写入 GC 或 LC 台账',
      }),
      applyType: s({
        type: '枚举',
        required: '是',
        format: '原材料 / 生产过程 / 生产物料',
        readonly: '驱动 QCP 必填与规则匹配',
      }),
      file: s({
        type: '文件',
        source: '上传',
        required: '是',
        format: '谱图原始文件 .json/.csv/.txt',
        readonly: '解析生成明细峰表',
      }),
      fileName: s({
        type: '文本',
        source: '自动+可改',
        required: '是',
        readonly: '默认取上传文件名',
      }),
      fileSavedAt: s({
        type: '日期时间',
        source: '自动',
        required: '是',
        readonly: '只读；列表列名「文件保存时间」',
      }),
      sampleName: s({
        type: '文本',
        source: '自动+可改',
        required: '是',
        note: '命名规则因组织/类型而异',
      }),
      instrumentCode: s({
        type: '引用',
        source: '下拉',
        required: '是',
        readonly: '关联仪器台账；可修改',
      }),
      instrumentName: s({
        type: '引用',
        source: '随仪器编号带出',
        required: '是',
        readonly: '只读',
      }),
      materialInfo: s({
        type: '文本',
        source: '自动+可改',
        required: '是',
        format: '一般为样品名称去掉后 8 位',
        readonly: '台账分类键来源之一',
      }),
      batchNo: s({
        type: '文本',
        source: '自动+可改',
        required: '是',
        format: '默认样品名称后 8 位',
      }),
      qcpPoint: s({
        type: '引用',
        source: 'QCP 列表',
        required: '条件',
        readonly: '生产过程类型必填',
      }),
      ruleName: s({
        type: '文本',
        source: '自动匹配',
        required: '是',
        readonly: '头信息完整后匹配漂移规则回填',
      }),
      warningRuleName: s({
        type: '文本',
        source: '自动匹配',
        required: '是',
        readonly: '匹配偏差预警规则回填',
      }),
      hasNewImpurity: s({
        type: '枚举',
        source: '明细聚合',
        format: '是 / 否',
        readonly: '只读',
      }),
      hasExcessImpurity: s({
        type: '枚举',
        source: '明细聚合',
        format: '是 / 否',
        readonly: '只读',
      }),
      attachment: s({ type: '文件', source: '上传', required: '否' }),
      remark: s({ type: '文本', source: '手工录入', required: '否' }),
      detAbnormalNote: s({
        type: '文本',
        source: '自动',
        format: '未匹配到 / 重复匹配 / 顺序异常 / /',
        readonly: '事后校验生成；只读',
      }),
      detRt: s({
        type: '数值',
        source: '文件解析',
        readonly: '只读；台账滚动扩列时列头取此值',
      }),
      detTypicalRt: s({
        type: '数值',
        source: '匹配+可改',
        format: '主峰/已定性不可改',
        readonly: '新杂时置空；锁定行重算不变',
      }),
      detRrt: s({
        type: '数值',
        source: '自动+可改',
        format: 'RT×参考峰典型RT/参考峰RT',
      }),
      detMainPeak: s({
        type: '枚举',
        format: '是/否；默认最大峰面积',
        readonly: '主峰/已定性默认可锁定',
      }),
      detComponent: s({
        type: '文本',
        source: '手工录入',
        required: '否',
        note: '仅新增页展示',
      }),
      detLocked: s({
        type: '开关',
        readonly: '锁定行重算不重匹配典型 RT',
      }),
      detNewImpurity: s({
        type: '枚举',
        format: '是 / 否',
        readonly: '新杂时对应典型 RT 必须为空',
      }),
      detExcessImpurity: s({
        type: '枚举',
        source: '自动',
        format: '新杂按 UCL/LCL；非新杂 /',
        readonly: '只读',
      }),
      detDeviationRange: s({
        type: '文本',
        source: '匹配漂移规则',
        readonly: '用于 M 值校验',
      }),
      detPeakNo: s({ type: '数值', source: '文件解析', readonly: '只读' }),
      detArea: s({ type: '数值', source: '文件解析', readonly: '只读' }),
    },
    ledgerCategory: {
      materialCode: s({
        type: '引用',
        source: '物料选择器',
        required: '是',
        format: '原材料/生产物料 Tab 下新增分类',
        unique: '分类内编码唯一',
        readonly: '仅展示启用物料',
      }),
      qcpCode: s({
        type: '引用',
        source: 'QCP 选择器',
        required: '是',
        format: '生产过程 Tab 下新增分类',
        unique: '分类内 QCP 唯一',
      }),
    },
    ledgerSummary: {
      applyType: s({
        type: '枚举',
        required: '是',
        format: '生产过程 / 生产物料（不含原材料）',
        readonly: '样本过滤必填',
      }),
      materialInfo: s({
        type: '引用',
        required: '是',
        readonly: '只展示启用物料',
      }),
      qcpPoint: s({
        type: '引用',
        required: '是',
        format: '模糊单选',
      }),
      batchNo: s({
        type: '文本',
        required: '是',
        format: '支持多行过滤条件',
      }),
    },
  };

  function fieldRemarkLabel(formKey, fieldKey) {
    return PAGE_FORM_FIELD_LABELS[formKey]?.[fieldKey] || fieldKey;
  }

  function fieldRemark(formKey, fieldKey) {
    return PAGE_FORM_FIELD_REMARKS[formKey]?.[fieldKey] || [];
  }

  function fieldRemarkProps(formKey, fieldKey) {
    return {
      label: fieldRemarkLabel(formKey, fieldKey),
      points: fieldRemark(formKey, fieldKey),
    };
  }

  function fieldRemarkListItems(formKey, fieldKeys) {
    return (fieldKeys || []).map((fieldKey) => ({
      key: fieldKey,
      label: fieldRemarkLabel(formKey, fieldKey),
      points: fieldRemark(formKey, fieldKey),
    }));
  }

  window.ChromDriftFormFieldRemarks = {
    fieldSpec,
    fieldRemarkLabel,
    fieldRemark,
    fieldRemarkProps,
    fieldRemarkListItems,
    PAGE_FORM_FIELD_LABELS,
    PAGE_FORM_FIELD_REMARKS,
  };
})();
