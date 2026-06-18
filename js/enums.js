window.ChromDriftEnums = {
  LEDGER_TYPES: [
    { value: 'GC', label: 'GC' },
    { value: 'LC', label: 'LC' },
  ],
  APPLY_TYPES: [
    { value: '原材料', label: '原材料' },
    { value: '生产过程', label: '生产过程' },
    { value: '生产物料', label: '生产物料' },
  ],
  RT_ACCUM_MODES: [
    { value: 'fixed', label: '按固定值不叠加（默认）' },
    { value: 'batch', label: '按批次新杂滚动叠加' },
    { value: 'first_batch', label: '首批次新杂滚动增加，其余批次不叠加' },
  ],
  /** 展示文案：QCP点 → 采样点（内部字段仍用 qcp*） */
  SAMPLE_POINT: {
    label: '采样点',
    code: '采样点编码',
    name: '采样点名称',
    listTitle: '采样点列表',
    apply: '适用采样点',
    applyTab: '适用采样点',
  },
  DRIFT_TAB_CONFIG: {
    原材料: { tabs: ['tr', 'material', 'qcp'], materialRequired: true, qcpRequired: true },
    生产过程: { tabs: ['tr', 'material', 'qcp'], materialRequired: false, qcpRequired: true },
    生产物料: { tabs: ['tr', 'material', 'qcp'], materialRequired: true, qcpRequired: true },
  },
  WARNING_TAB_CONFIG: {
    原材料: { tabs: ['material', 'limit', 'qcp'], materialRequired: true, qcpRequired: true },
    生产过程: { tabs: ['material', 'limit', 'qcp'], materialRequired: false, qcpRequired: true },
    生产物料: { tabs: ['material', 'limit', 'qcp'], materialRequired: true, qcpRequired: true },
  },
  DEVIATION_TYPES: [
    { value: 'excess_impurity', label: '超标新杂' },
  ],
  UPPER_LIMIT_OPS: [
    { value: '≤', label: '≤' },
    { value: '＜', label: '＜' },
  ],
  LOWER_LIMIT_OPS: [
    { value: '≥', label: '≥' },
    { value: '>', label: '>' },
  ],
  PAGE_SIZES: [10, 50, 100, 500, 1000, 1500],
};
