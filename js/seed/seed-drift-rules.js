(function () {
  const { uid } = window.ChromDriftStorage;

  function trRow(rt, name, isMain) {
    return {
      id: uid(),
      rowType: 'initial',
      applyMaterial: '',
      applyQcp: '',
      typicalRt: rt,
      compoundName: name,
      isMainPeak: !!isMain,
    };
  }

  function matRow(code, name, spec, category, unit) {
    return { id: uid(), materialCode: code, materialName: name, spec, category, unit, enabled: true };
  }

  function qcpRow(code, name) {
    return { id: uid(), qcpCode: code, qcpName: name, enabled: true };
  }

  function rule(id, code, name, opts) {
    return {
      id,
      code,
      name,
      rtAccumMode: opts.rtAccumMode || 'fixed',
      deviationMin: opts.deviationMin ?? -0.002,
      deviationMax: opts.deviationMax ?? 0.002,
      ledgerType: opts.ledgerType,
      applyType: opts.applyType,
      remark: opts.remark || '',
      enabled: opts.enabled !== false,
      createdAt: opts.createdAt,
      createdBy: opts.createdBy || '张三',
      trRows: opts.trRows,
      materials: opts.materials || [],
      qcpPoints: opts.qcpPoints || [],
    };
  }

  const SEED_DRIFT_RULES = [
    // —— GC 生产过程（3 条：不同成品/QCP，tR 不同）——
    rule('dr-1', 'DR-GC-P01', 'GC生产过程-CP001反应', {
      rtAccumMode: 'batch',
      ledgerType: 'GC', applyType: '生产过程',
      remark: 'CP001·QCP01，按批次新杂滚动',
      createdAt: '2025-04-28 09:28:01',
      trRows: [trRow(0.2, '杂质A', false), trRow(1.05, '杂质B', false), trRow(2.07, '主峰', true)],
      materials: [matRow('CP001', '成品A', '500g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP01', '反应步骤1')],
    }),
    rule('dr-7', 'DR-GC-P02', 'GC生产过程-CP001干燥', {
      rtAccumMode: 'first_batch',
      ledgerType: 'GC', applyType: '生产过程',
      remark: 'CP001·QCP03，首批次新杂滚动',
      createdAt: '2025-04-29 09:00:00',
      trRows: [trRow(0.15, '杂质D', false), trRow(0.95, '杂质E', false), trRow(1.88, '主峰', true)],
      materials: [matRow('CP001', '成品A', '500g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP03', '干燥步骤')],
    }),
    rule('dr-8', 'DR-GC-P03', 'GC生产过程-CP002反应', {
      rtAccumMode: 'fixed',
      ledgerType: 'GC', applyType: '生产过程',
      remark: 'CP002·QCP01，固定RT',
      createdAt: '2025-05-02 10:00:00',
      trRows: [trRow(0.25, '杂质F', false), trRow(1.1, '杂质G', false), trRow(2.2, '主峰', true)],
      materials: [matRow('CP002', '成品B', '1kg', '成品', '袋')],
      qcpPoints: [qcpRow('QCP01', '反应步骤1')],
    }),

    // —— GC 原材料（3 条）——
    rule('dr-2', 'DR-GC-R01', 'GC原材料-RM001', {
      ledgerType: 'GC', applyType: '原材料',
      remark: '原料X入库',
      createdAt: '2025-04-20 08:00:00',
      trRows: [trRow(1.2, '杂质X', false), trRow(2.5, '主峰', true)],
      materials: [matRow('RM001', '原料X', 'AR', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP01', '进厂采样')],
    }),
    rule('dr-9', 'DR-GC-R02', 'GC原材料-RM003', {
      deviationMin: -0.003, deviationMax: 0.003,
      ledgerType: 'GC', applyType: '原材料',
      remark: '原料Z，较宽偏差',
      createdAt: '2025-04-22 08:00:00',
      trRows: [trRow(0.9, '杂质Z1', false), trRow(2.1, '主峰', true)],
      materials: [matRow('RM003', '原料Z', 'AR', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP01', '进厂采样')],
    }),
    rule('dr-10', 'DR-GC-R03', 'GC原材料-RM004', {
      rtAccumMode: 'batch',
      ledgerType: 'GC', applyType: '原材料',
      remark: '原料W，新杂可扩展列',
      createdAt: '2025-04-24 08:00:00',
      trRows: [trRow(1.5, '杂质W1', false), trRow(3.0, '主峰', true)],
      materials: [matRow('RM004', '原料W', 'CP', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP02', '精制步骤')],
    }),

    // —— GC 生产物料（3 条）——
    rule('dr-4', 'DR-GC-M01', 'GC生产物料-CP001', {
      ledgerType: 'GC', applyType: '生产物料',
      remark: '成品A放行',
      createdAt: '2025-04-15 08:30:00',
      trRows: [trRow(0.8, '杂质P', false), trRow(1.8, '主峰', true), trRow(3.2, '杂质Q', false)],
      materials: [matRow('CP001', '成品A', '500g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
    rule('dr-11', 'DR-GC-M02', 'GC生产物料-CP002', {
      ledgerType: 'GC', applyType: '生产物料',
      remark: '成品B放行',
      createdAt: '2025-04-16 08:30:00',
      trRows: [trRow(0.7, '杂质R', false), trRow(1.6, '主峰', true), trRow(2.9, '杂质S', false)],
      materials: [matRow('CP002', '成品B', '1kg', '成品', '袋')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
    rule('dr-12', 'DR-GC-M03', 'GC生产物料-CP003', {
      rtAccumMode: 'first_batch',
      ledgerType: 'GC', applyType: '生产物料',
      remark: '成品C放行',
      createdAt: '2025-04-17 08:30:00',
      trRows: [trRow(1.0, '杂质T', false), trRow(2.2, '主峰', true)],
      materials: [matRow('CP003', '成品C', '250g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),

    // —— LC 生产过程（3 条）——
    rule('dr-3', 'DR-LC-P01', 'LC生产过程-CP002精制', {
      deviationMin: -0.003, deviationMax: 0.003,
      ledgerType: 'LC', applyType: '生产过程',
      remark: 'CP002·QCP02精制',
      createdAt: '2025-06-01 10:00:00',
      trRows: [trRow(2.5, '主峰', true), trRow(4.1, '杂质C', false)],
      materials: [matRow('CP002', '成品B', '1kg', '成品', '袋')],
      qcpPoints: [qcpRow('QCP02', '精制步骤')],
    }),
    rule('dr-13', 'DR-LC-P02', 'LC生产过程-CP002灌装', {
      deviationMin: -0.003, deviationMax: 0.003,
      ledgerType: 'LC', applyType: '生产过程',
      remark: 'CP002·QCP04灌装',
      createdAt: '2025-06-02 10:00:00',
      trRows: [trRow(3.0, '主峰', true), trRow(5.2, '杂质U', false)],
      materials: [matRow('CP002', '成品B', '1kg', '成品', '袋')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
    rule('dr-14', 'DR-LC-P03', 'LC生产过程-CP001精制', {
      rtAccumMode: 'batch',
      deviationMin: -0.003, deviationMax: 0.003,
      ledgerType: 'LC', applyType: '生产过程',
      remark: 'CP001·QCP02，新杂可扩展',
      createdAt: '2025-06-03 10:00:00',
      trRows: [trRow(2.8, '主峰', true), trRow(4.5, '杂质V', false)],
      materials: [matRow('CP001', '成品A', '500g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP02', '精制步骤')],
    }),

    // —— LC 原材料（3 条）——
    rule('dr-5', 'DR-LC-R01', 'LC原材料-RM002', {
      deviationMin: -0.003, deviationMax: 0.003,
      ledgerType: 'LC', applyType: '原材料',
      remark: '原料Y液相入库',
      createdAt: '2025-05-28 08:00:00',
      trRows: [trRow(3.2, '杂质Y', false), trRow(5.8, '主峰', true)],
      materials: [matRow('RM002', '原料Y', 'CP', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP01', '进厂采样')],
    }),
    rule('dr-15', 'DR-LC-R02', 'LC原材料-RM003', {
      deviationMin: -0.003, deviationMax: 0.003,
      ledgerType: 'LC', applyType: '原材料',
      remark: '原料Z液相入库',
      createdAt: '2025-05-29 08:00:00',
      trRows: [trRow(2.8, '杂质Z2', false), trRow(6.2, '主峰', true)],
      materials: [matRow('RM003', '原料Z', 'AR', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP01', '进厂采样')],
    }),
    rule('dr-16', 'DR-LC-R03', 'LC原材料-RM001', {
      rtAccumMode: 'batch',
      deviationMin: -0.003, deviationMax: 0.003,
      ledgerType: 'LC', applyType: '原材料',
      remark: '原料X液相入库，新杂可扩展列',
      createdAt: '2025-05-30 08:00:00',
      trRows: [trRow(2.0, '杂质X2', false), trRow(4.5, '主峰', true)],
      materials: [matRow('RM001', '原料X', 'AR', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP02', '精制步骤')],
    }),

    // —— LC 生产物料（3 条）——
    rule('dr-6', 'DR-LC-M01', 'LC生产物料-CP002', {
      deviationMin: -0.003, deviationMax: 0.003,
      ledgerType: 'LC', applyType: '生产物料',
      remark: '成品B液相放行',
      createdAt: '2025-05-20 09:00:00',
      trRows: [trRow(1.5, '杂质M', false), trRow(3.0, '主峰', true), trRow(5.5, '杂质N', false)],
      materials: [matRow('CP002', '成品B', '1kg', '成品', '袋')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
    rule('dr-17', 'DR-LC-M02', 'LC生产物料-CP001', {
      rtAccumMode: 'batch',
      deviationMin: -0.003, deviationMax: 0.003,
      ledgerType: 'LC', applyType: '生产物料',
      remark: '成品A液相放行，新杂可扩展列',
      createdAt: '2025-05-21 09:00:00',
      trRows: [trRow(1.2, '杂质M2', false), trRow(2.8, '主峰', true), trRow(4.8, '杂质N2', false)],
      materials: [matRow('CP001', '成品A', '500g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
    rule('dr-18', 'DR-LC-M03', 'LC生产物料-CP003', {
      deviationMin: -0.003, deviationMax: 0.003,
      ledgerType: 'LC', applyType: '生产物料',
      remark: '成品C液相放行',
      createdAt: '2025-05-22 09:00:00',
      trRows: [trRow(1.8, '杂质M3', false), trRow(3.5, '主峰', true)],
      materials: [matRow('CP003', '成品C', '250g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
  ];

  window.ChromDriftSeedDriftRules = { SEED_DRIFT_RULES };
})();
