/**
 * Mock 数据工厂：6 类 × 3 物料/规则 × 3 批 → 识别记录 + GC/LC 台账
 */
(function () {
  const LB = window.ChromDriftLedgerBuilder;
  const { SEED_DRIFT_RULES } = window.ChromDriftSeedDriftRules;
  const { SEED_WARNING_RULES } = window.ChromDriftSeedWarningRules;

  const DRIFT_MAP = Object.fromEntries(SEED_DRIFT_RULES.map((r) => [r.id, r]));
  const WARNING_MAP = Object.fromEntries(SEED_WARNING_RULES.map((r) => [r.id, r]));
  const CREATORS = ['张三', '李四', '王五'];

  function categoryKey(ledgerType, applyType, name) {
    return `${ledgerType}|${applyType}|${name}`;
  }

  function deviationRange(rule) {
    if (!rule) return '-0.002~0.002';
    return `${rule.deviationMin}~${rule.deviationMax}`;
  }

  function peaksFromTr(trRows, mainRtActual, batchIdx) {
    const main = trRows.find((r) => r.isMainPeak) || trRows[0];
    const scale = mainRtActual / Number(main.typicalRt);
    const drift = batchIdx * 0.006;
    return trRows.map((t) => {
      const isMain = !!t.isMainPeak;
      return {
        rt: Number((Number(t.typicalRt) * scale + drift).toFixed(3)),
        area: isMain ? 42000 - batchIdx * 150 : 1200 - batchIdx * 30,
        component: isMain ? '主峰' : t.compoundName,
        typicalRt: Number(t.typicalRt),
        isMainPeak: isMain,
      };
    });
  }

  function makeBatches(trRows, mainRtBase, batchStart, baseDateStr, impurityBatchIdxs) {
    const impuritySet = new Set(impurityBatchIdxs || []);
    const base = new Date(baseDateStr.replace(/-/g, '/'));
    return [0, 1, 2].map((i) => {
      const d = new Date(base);
      d.setDate(d.getDate() + i);
      const pad = (n) => String(n).padStart(2, '0');
      const peaks = peaksFromTr(trRows, mainRtBase + i * 0.015, i);
      if (impuritySet.has(i)) {
        const main = trRows.find((r) => r.isMainPeak) || trRows[0];
        const mainRtActual = mainRtBase + i * 0.015;
        const lastRt = peaks[peaks.length - 1]?.rt || mainRtActual;
        const newRt = Number((lastRt + 0.85 + i * 0.12).toFixed(3));
        peaks.push({
          rt: newRt,
          area: Number((1.2 + i * 0.3).toFixed(1)),
          component: i === 0 ? '未知峰' : `新杂峰${i + 1}`,
          isNewImpurity: true,
          isExcessImpurity: i >= 2 ? '是' : '/',
          abnormalNote: '顺序异常',
        });
      }
      return {
        batchNo: String(batchStart + i),
        createdAt: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${String(9 + i).padStart(2, '0')}:20:00`,
        createdBy: CREATORS[i],
        peaks,
      };
    });
  }

  function resolveImpurityBatches(def) {
    if (def.newImpurityBatches?.length) return def.newImpurityBatches;
    if (def.newImpurityBatch3) return [2];
    if (def.newImpurityBatch1) return [0];
    return [];
  }

  function spectrumLabel(ledgerType, applyType, materialInfo, qcpPoint) {
    const typeMap = { 原材料: '原材料', 生产过程: '生产过程', 生产物料: '生产物料' };
    const tag = qcpPoint ? `${materialInfo}-${qcpPoint}` : materialInfo;
    return `${ledgerType}-${typeMap[applyType] || applyType}-${tag}`;
  }

  /** 每适用类型 3 组物料/规则（GC/LC 各 6 类 → 18 场景） */
  const SCENARIO_DEFS = [
    // GC 生产过程
    { key: 'gc-proc-1', driftRuleId: 'dr-1', warningRuleId: 'wr-1', ledgerType: 'GC', applyType: '生产过程', materialInfo: 'CP001', qcpPoint: 'QCP01', materialCode: '', productCode: 'CP001', mainRtBase: 5.15, batchStart: 2025042801, baseDate: '2025-04-28', instrumentCode: 'GC-001', newImpurityBatches: [1, 2] },
    { key: 'gc-proc-2', driftRuleId: 'dr-7', warningRuleId: 'wr-7', ledgerType: 'GC', applyType: '生产过程', materialInfo: 'CP001', qcpPoint: 'QCP03', materialCode: '', productCode: 'CP001', mainRtBase: 4.68, batchStart: 2025042901, baseDate: '2025-04-29', instrumentCode: 'GC-001', newImpurityBatches: [0] },
    { key: 'gc-proc-3', driftRuleId: 'dr-8', warningRuleId: 'wr-8', ledgerType: 'GC', applyType: '生产过程', materialInfo: 'CP002', qcpPoint: 'QCP01', materialCode: '', productCode: 'CP002', mainRtBase: 5.48, batchStart: 2025050201, baseDate: '2025-05-02', instrumentCode: 'GC-002' },
    // GC 原材料
    { key: 'gc-rm-1', driftRuleId: 'dr-2', warningRuleId: 'wr-2', ledgerType: 'GC', applyType: '原材料', materialInfo: 'RM001', qcpPoint: 'QCP01', materialCode: 'RM001', productCode: '', mainRtBase: 5.18, batchStart: 2025042001, baseDate: '2025-04-20', instrumentCode: 'GC-002' },
    { key: 'gc-rm-2', driftRuleId: 'dr-9', warningRuleId: 'wr-9', ledgerType: 'GC', applyType: '原材料', materialInfo: 'RM003', qcpPoint: 'QCP01', materialCode: 'RM003', productCode: '', mainRtBase: 4.35, batchStart: 2025042201, baseDate: '2025-04-22', instrumentCode: 'GC-002' },
    { key: 'gc-rm-3', driftRuleId: 'dr-10', warningRuleId: 'wr-10', ledgerType: 'GC', applyType: '原材料', materialInfo: 'RM004', qcpPoint: 'QCP02', materialCode: 'RM004', productCode: '', mainRtBase: 6.2, batchStart: 2025042401, baseDate: '2025-04-24', instrumentCode: 'GC-002', newImpurityBatches: [2] },
    // GC 生产物料
    { key: 'gc-pm-1', driftRuleId: 'dr-4', warningRuleId: 'wr-6', ledgerType: 'GC', applyType: '生产物料', materialInfo: 'CP001', qcpPoint: 'QCP04', materialCode: 'CP001', productCode: 'CP001', mainRtBase: 3.65, batchStart: 2025041501, baseDate: '2025-04-15', instrumentCode: 'GC-001' },
    { key: 'gc-pm-2', driftRuleId: 'dr-11', warningRuleId: 'wr-11', ledgerType: 'GC', applyType: '生产物料', materialInfo: 'CP002', qcpPoint: 'QCP04', materialCode: 'CP002', productCode: 'CP002', mainRtBase: 3.25, batchStart: 2025041601, baseDate: '2025-04-16', instrumentCode: 'GC-001' },
    { key: 'gc-pm-3', driftRuleId: 'dr-12', warningRuleId: 'wr-12', ledgerType: 'GC', applyType: '生产物料', materialInfo: 'CP003', qcpPoint: 'QCP04', materialCode: 'CP003', productCode: 'CP003', mainRtBase: 4.48, batchStart: 2025041701, baseDate: '2025-04-17', instrumentCode: 'GC-001', newImpurityBatches: [0] },
    // LC 生产过程
    { key: 'lc-proc-1', driftRuleId: 'dr-3', warningRuleId: 'wr-4', ledgerType: 'LC', applyType: '生产过程', materialInfo: 'CP002', qcpPoint: 'QCP02', materialCode: '', productCode: 'CP002', mainRtBase: 2.51, batchStart: 2025060101, baseDate: '2025-06-01', instrumentCode: 'LC-001' },
    { key: 'lc-proc-2', driftRuleId: 'dr-13', warningRuleId: 'wr-13', ledgerType: 'LC', applyType: '生产过程', materialInfo: 'CP002', qcpPoint: 'QCP04', materialCode: '', productCode: 'CP002', mainRtBase: 3.02, batchStart: 2025060201, baseDate: '2025-06-02', instrumentCode: 'LC-001' },
    { key: 'lc-proc-3', driftRuleId: 'dr-14', warningRuleId: 'wr-14', ledgerType: 'LC', applyType: '生产过程', materialInfo: 'CP001', qcpPoint: 'QCP02', materialCode: '', productCode: 'CP001', mainRtBase: 2.82, batchStart: 2025060301, baseDate: '2025-06-03', instrumentCode: 'LC-001', newImpurityBatches: [1, 2] },
    // LC 原材料
    { key: 'lc-rm-1', driftRuleId: 'dr-5', warningRuleId: 'wr-5', ledgerType: 'LC', applyType: '原材料', materialInfo: 'RM002', qcpPoint: 'QCP01', materialCode: 'RM002', productCode: '', mainRtBase: 5.92, batchStart: 2025052801, baseDate: '2025-05-28', instrumentCode: 'LC-001' },
    { key: 'lc-rm-2', driftRuleId: 'dr-15', warningRuleId: 'wr-15', ledgerType: 'LC', applyType: '原材料', materialInfo: 'RM003', qcpPoint: 'QCP01', materialCode: 'RM003', productCode: '', mainRtBase: 6.32, batchStart: 2025052901, baseDate: '2025-05-29', instrumentCode: 'LC-001' },
    { key: 'lc-rm-3', driftRuleId: 'dr-16', warningRuleId: 'wr-16', ledgerType: 'LC', applyType: '原材料', materialInfo: 'RM001', qcpPoint: 'QCP02', materialCode: 'RM001', productCode: '', mainRtBase: 4.58, batchStart: 2025053001, baseDate: '2025-05-30', instrumentCode: 'LC-001', newImpurityBatches: [2] },
    // LC 生产物料
    { key: 'lc-pm-1', driftRuleId: 'dr-6', warningRuleId: 'wr-19', ledgerType: 'LC', applyType: '生产物料', materialInfo: 'CP002', qcpPoint: 'QCP04', materialCode: 'CP002', productCode: 'CP002', mainRtBase: 3.65, batchStart: 2025052001, baseDate: '2025-05-20', instrumentCode: 'LC-001' },
    { key: 'lc-pm-2', driftRuleId: 'dr-17', warningRuleId: 'wr-17', ledgerType: 'LC', applyType: '生产物料', materialInfo: 'CP001', qcpPoint: 'QCP04', materialCode: 'CP001', productCode: 'CP001', mainRtBase: 3.42, batchStart: 2025052101, baseDate: '2025-05-21', instrumentCode: 'LC-001', newImpurityBatches: [2] },
    { key: 'lc-pm-3', driftRuleId: 'dr-18', warningRuleId: 'wr-18', ledgerType: 'LC', applyType: '生产物料', materialInfo: 'CP003', qcpPoint: 'QCP04', materialCode: 'CP003', productCode: 'CP003', mainRtBase: 3.88, batchStart: 2025052201, baseDate: '2025-05-22', instrumentCode: 'LC-001' },
  ];

  function buildScenarios() {
    return SCENARIO_DEFS.map((def) => {
      const drift = DRIFT_MAP[def.driftRuleId];
      const warning = WARNING_MAP[def.warningRuleId];
      const catName = def.qcpPoint
        ? `${def.materialInfo}-${def.qcpPoint}`
        : def.materialInfo;
      return {
        ...def,
        categoryId: `cat-${def.key}`,
        categoryCreatedAt: def.baseDate + ' 09:00:00',
        ruleName: drift?.name || '',
        warningRuleName: warning?.name || '',
        deviationRange: deviationRange(drift),
        spectrumPrefix: spectrumLabel(def.ledgerType, def.applyType, def.materialInfo, def.qcpPoint),
        instrumentName: def.instrumentCode === 'GC-001' ? '气相色谱仪-A' : def.instrumentCode === 'GC-002' ? '气相色谱仪-B' : '液相色谱仪-1',
        batches: makeBatches(
          drift?.trRows || [],
          def.mainRtBase,
          def.batchStart,
          def.baseDate,
          resolveImpurityBatches(def),
        ),
        _catName: catName,
      };
    });
  }

  const SCENARIOS = buildScenarios();

  function buildDetails(peaks, devRange) {
    const main = peaks.find((p) => p.isMainPeak);
    const mainRt = main ? Number(main.rt) : null;
    return peaks.map((p, i) => ({
      id: String(i + 1),
      peakNo: i + 1,
      rt: Number(p.rt),
      area: Number(p.area),
      componentName: p.component,
      isMainPeak: !!p.isMainPeak,
      rrt: p.typicalRt != null && mainRt
        ? Number((Number(p.rt) / mainRt).toFixed(4))
        : null,
      typicalRt: p.isNewImpurity ? null : (p.typicalRt != null ? Number(p.typicalRt) : null),
      locked: !p.isNewImpurity && p.typicalRt != null,
      abnormalNote: p.abnormalNote || (p.isNewImpurity ? '顺序异常' : (p.typicalRt != null ? '/' : '未匹配到')),
      deviationRange: devRange,
      isNewImpurity: p.isNewImpurity === true,
      isExcessImpurity: p.isExcessImpurity || '/',
    }));
  }

  function impurityFlags(details) {
    const hasNew = details.some((d) => d.isNewImpurity === true);
    const hasExcess = details.some((d) => d.isExcessImpurity === '是');
    return { hasNewImpurity: hasNew ? '是' : '/', hasExcessImpurity: hasExcess ? '是' : '/' };
  }

  function toSpectrumJson(peaks) {
    return peaks.map((p, i) => ({
      peakNo: i + 1,
      rt: p.rt,
      area: p.area,
      component: p.component,
    }));
  }

  function buildRecognitionRecords() {
    const records = [];
    const spectrumFiles = {};

    SCENARIOS.forEach((sc) => {
      sc.batches.forEach((batch, bi) => {
        const recId = `rec-${sc.key}-${bi + 1}`;
        const batchId = `batch-${sc.key}-${bi + 1}`;
        const fileName = `${sc.spectrumPrefix}-${String(bi + 1).padStart(2, '0')}.json`;
        const details = buildDetails(batch.peaks, sc.deviationRange);
        const flags = impurityFlags(details);
        const sampleName = sc.qcpPoint
          ? `${sc.materialInfo}-${sc.qcpPoint}-${batch.batchNo}`
          : `${sc.materialInfo}-${batch.batchNo}`;

        records.push({
          id: recId,
          ledgerType: sc.ledgerType,
          applyType: sc.applyType,
          fileName,
          fileSavedAt: batch.createdAt.replace(/:\d{2}$/, ':00'),
          sampleName,
          instrumentCode: sc.instrumentCode,
          instrumentName: sc.instrumentName,
          materialInfo: sc.materialInfo,
          batchNo: batch.batchNo,
          qcpPoint: sc.qcpPoint || '',
          ruleName: sc.ruleName,
          warningRuleName: sc.warningRuleName,
          hasNewImpurity: flags.hasNewImpurity,
          hasExcessImpurity: flags.hasExcessImpurity,
          attachmentName: '',
          remark: `Mock · ${sc.ruleName} 第${bi + 1}批`,
          createdAt: batch.createdAt,
          createdBy: batch.createdBy,
          driftRuleId: sc.driftRuleId,
          warningRuleId: sc.warningRuleId,
          _batchId: batchId,
          _categoryId: sc.categoryId,
          _productCode: sc.productCode,
          _materialCode: sc.materialCode,
          _categoryCreatedAt: sc.categoryCreatedAt,
          details,
        });

        spectrumFiles[fileName] = toSpectrumJson(batch.peaks);
      });
    });

    return { records, spectrumFiles };
  }

  function buildLedgers(records) {
    const gcStore = { categories: [], blocks: {} };
    const lcStore = { categories: [], blocks: {} };
    const categoryIds = {};
    const batchIds = {};

    SCENARIOS.forEach((sc) => {
      categoryIds[categoryKey(sc.ledgerType, sc.applyType, sc._catName)] = sc.categoryId;
    });

    records.forEach((rec) => {
      batchIds[rec.id] = rec._batchId;
      const drift = DRIFT_MAP[rec.driftRuleId];
      const warning = WARNING_MAP[rec.warningRuleId];
      const store = rec.ledgerType === 'LC' ? lcStore : gcStore;
      LB.saveRecognitionToLedgerStore(store, rec, drift, warning, {
        categoryIds,
        batchIds,
        driftRuleId: rec.driftRuleId,
        productCode: rec._productCode,
        materialCode: rec._materialCode,
        createdAt: rec._categoryCreatedAt,
      });
    });

    return { SEED_LEDGER_GC: gcStore, SEED_LEDGER_LC: lcStore };
  }

  const { records, spectrumFiles } = buildRecognitionRecords();
  const cleanRecords = records.map((r) => {
    const copy = { ...r };
    delete copy._batchId;
    delete copy._categoryId;
    delete copy._productCode;
    delete copy._materialCode;
    delete copy._categoryCreatedAt;
    return copy;
  });
  const ledgers = buildLedgers(records);

  window.ChromDriftSeedRecognition = { SEED_RECOGNITION_RECORDS: cleanRecords };
  window.ChromDriftSeedLedgerGc = { SEED_LEDGER_GC: ledgers.SEED_LEDGER_GC };
  window.ChromDriftSeedLedgerLc = { SEED_LEDGER_LC: ledgers.SEED_LEDGER_LC };
  window.ChromDriftMockSpectra = { MOCK_SPECTRUM_FILES: spectrumFiles };
  /** 数据比对 · 默认样本过滤行（与台账 Mock 批号对齐，打开页即可并集矩阵） */
  window.ChromDriftSeedCompareDefaults = {
    GC: [
      { applyType: '生产过程', materialCode: 'CP001', qcpPoint: 'QCP01', batchNo: '2025042801' },
      { applyType: '生产过程', materialCode: 'CP001', qcpPoint: 'QCP01', batchNo: '2025042802' },
      { applyType: '生产物料', materialCode: 'CP001', qcpPoint: 'QCP04', batchNo: '2025041501' },
    ],
    LC: [
      { applyType: '生产过程', materialCode: 'CP002', qcpPoint: 'QCP02', batchNo: '2025060101' },
      { applyType: '生产过程', materialCode: 'CP001', qcpPoint: 'QCP02', batchNo: '2025060301' },
      { applyType: '生产物料', materialCode: 'CP002', qcpPoint: 'QCP04', batchNo: '2025052001' },
    ],
  };
  window.ChromDriftSeedRollingMeta = {
    ROLLING_SCENARIO_KEYS: SCENARIO_DEFS
      .filter((d) => resolveImpurityBatches(d).length)
      .map((d) => d.key),
  };
})();
