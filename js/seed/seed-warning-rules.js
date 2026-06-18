(function () {
  const { uid } = window.ChromDriftStorage;

  function matRow(code, name, spec, category, unit) {
    return { id: uid(), materialCode: code, materialName: name, spec, category, unit, enabled: true };
  }

  function qcpRow(code, name) {
    return { id: uid(), qcpCode: code, qcpName: name, enabled: true };
  }

  function wr(id, code, name, applyType, opts) {
    return {
      id,
      code,
      name,
      deviationType: 'excess_impurity',
      uslOp: '≤',
      uslValue: opts.uslValue ?? null,
      lslOp: '≥',
      lslValue: null,
      uclOp: '≤',
      uclValue: opts.uclValue ?? 0.05,
      lclOp: '≥',
      lclValue: opts.lclValue ?? null,
      applyType,
      remark: opts.remark || '',
      enabled: true,
      createdAt: opts.createdAt,
      createdBy: opts.createdBy || '张三',
      materials: opts.materials || [],
      qcpPoints: opts.qcpPoints || [],
    };
  }

  const SEED_WARNING_RULES = [
    wr('wr-1', 'WR-GC-P01', 'GC生产过程-CP001反应', '生产过程', {
      uclValue: 0.05, createdAt: '2025-05-10 09:00:00',
      remark: 'CP001·QCP01',
      materials: [matRow('CP001', '成品A', '500g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP01', '反应步骤1')],
    }),
    wr('wr-7', 'WR-GC-P02', 'GC生产过程-CP001干燥', '生产过程', {
      uclValue: 0.04, createdAt: '2025-05-11 09:00:00',
      remark: 'CP001·QCP03',
      materials: [matRow('CP001', '成品A', '500g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP03', '干燥步骤')],
    }),
    wr('wr-8', 'WR-GC-P03', 'GC生产过程-CP002反应', '生产过程', {
      uclValue: 0.06, createdAt: '2025-05-12 09:00:00',
      remark: 'CP002·QCP01',
      materials: [matRow('CP002', '成品B', '1kg', '成品', '袋')],
      qcpPoints: [qcpRow('QCP01', '反应步骤1')],
    }),
    wr('wr-2', 'WR-GC-R01', 'GC原材料-RM001', '原材料', {
      uclValue: 0.08, uslValue: 0.1, createdAt: '2025-05-08 14:30:00',
      materials: [matRow('RM001', '原料X', 'AR', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP01', '进厂采样')],
    }),
    wr('wr-9', 'WR-GC-R02', 'GC原材料-RM003', '原材料', {
      uclValue: 0.07, createdAt: '2025-05-09 14:30:00',
      materials: [matRow('RM003', '原料Z', 'AR', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP01', '进厂采样')],
    }),
    wr('wr-10', 'WR-GC-R03', 'GC原材料-RM004', '原材料', {
      uclValue: 0.09, createdAt: '2025-05-10 14:30:00',
      materials: [matRow('RM004', '原料W', 'CP', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP02', '精制步骤')],
    }),
    wr('wr-6', 'WR-GC-M01', 'GC生产物料-CP001', '生产物料', {
      uclValue: 0.03, createdAt: '2025-05-12 11:00:00',
      materials: [matRow('CP001', '成品A', '500g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
    wr('wr-11', 'WR-GC-M02', 'GC生产物料-CP002', '生产物料', {
      uclValue: 0.035, createdAt: '2025-05-13 11:00:00',
      materials: [matRow('CP002', '成品B', '1kg', '成品', '袋')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
    wr('wr-12', 'WR-GC-M03', 'GC生产物料-CP003', '生产物料', {
      uclValue: 0.025, createdAt: '2025-05-14 11:00:00',
      materials: [matRow('CP003', '成品C', '250g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
    wr('wr-4', 'WR-LC-P01', 'LC生产过程-CP002精制', '生产过程', {
      uclValue: 0.05, createdAt: '2025-06-01 10:30:00',
      materials: [matRow('CP002', '成品B', '1kg', '成品', '袋')],
      qcpPoints: [qcpRow('QCP02', '精制步骤')],
    }),
    wr('wr-13', 'WR-LC-P02', 'LC生产过程-CP002灌装', '生产过程', {
      uclValue: 0.045, createdAt: '2025-06-02 10:30:00',
      materials: [matRow('CP002', '成品B', '1kg', '成品', '袋')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
    wr('wr-14', 'WR-LC-P03', 'LC生产过程-CP001精制', '生产过程', {
      uclValue: 0.055, createdAt: '2025-06-03 10:30:00',
      materials: [matRow('CP001', '成品A', '500g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP02', '精制步骤')],
    }),
    wr('wr-5', 'WR-LC-R01', 'LC原材料-RM002', '原材料', {
      uclValue: 0.08, uslValue: 0.1, createdAt: '2025-05-28 14:00:00',
      materials: [matRow('RM002', '原料Y', 'CP', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP01', '进厂采样')],
    }),
    wr('wr-15', 'WR-LC-R02', 'LC原材料-RM003', '原材料', {
      uclValue: 0.075, createdAt: '2025-05-29 14:00:00',
      materials: [matRow('RM003', '原料Z', 'AR', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP01', '进厂采样')],
    }),
    wr('wr-16', 'WR-LC-R03', 'LC原材料-RM001', '原材料', {
      uclValue: 0.085, createdAt: '2025-05-30 14:00:00',
      materials: [matRow('RM001', '原料X', 'AR', '原料', 'kg')],
      qcpPoints: [qcpRow('QCP02', '精制步骤')],
    }),
    wr('wr-19', 'WR-LC-M01', 'LC生产物料-CP002', '生产物料', {
      uclValue: 0.03, lclValue: 0.01, createdAt: '2025-05-20 11:00:00',
      materials: [matRow('CP002', '成品B', '1kg', '成品', '袋')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
    wr('wr-17', 'WR-LC-M02', 'LC生产物料-CP001', '生产物料', {
      uclValue: 0.028, createdAt: '2025-05-21 11:00:00',
      materials: [matRow('CP001', '成品A', '500g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
    wr('wr-18', 'WR-LC-M03', 'LC生产物料-CP003', '生产物料', {
      uclValue: 0.032, createdAt: '2025-05-22 11:00:00',
      materials: [matRow('CP003', '成品C', '250g', '成品', '瓶')],
      qcpPoints: [qcpRow('QCP04', '灌装步骤')],
    }),
  ];

  window.ChromDriftSeedWarningRules = { SEED_WARNING_RULES };
})();
