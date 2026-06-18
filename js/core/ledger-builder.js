/**
 * 图谱识别保存 → GC/LC 数据台账（列头实时读漂移规则详情 tR）
 */
(function () {
  const { uid, nowStr, clone } = ChromDriftStorage;
  const DTR = ChromDriftDriftTrResolver;

  function ledgerKey(ledgerType) {
    return ledgerType === 'LC' ? 'ledger-lc-data' : 'ledger-gc-data';
  }

  function loadLedger(ledgerType) {
    const seed = { categories: [], blocks: {} };
    return ChromDriftStorage.load(ledgerKey(ledgerType), seed);
  }

  function saveLedger(ledgerType, data) {
    ChromDriftStorage.save(ledgerKey(ledgerType), data);
  }

  function categoryName(head) {
    const mat = (head.materialInfo || '').trim();
    const qcp = (head.qcpPoint || '').trim();
    if (head.applyType === '生产过程' && qcp) {
      const product = mat.split('-')[0] || mat;
      return `${product}-${qcp}`;
    }
    if (qcp && mat) {
      const base = mat.includes('-') ? mat.split('-')[0] : mat;
      return `${base}-${qcp}`;
    }
    if (mat.includes('-')) return mat;
    return mat || '未分类';
  }

  function findCategory(store, head) {
    const name = categoryName(head);
    return store.categories.find(
      (c) => c.name === name && c.applyType === head.applyType && c.ledgerType === head.ledgerType,
    );
  }

  function ensureCategory(store, head, options) {
    let cat = findCategory(store, head);
    if (cat) {
      if (options?.driftRuleId && !cat.driftRuleId) cat.driftRuleId = options.driftRuleId;
      return cat;
    }
    const name = categoryName(head);
    const stableId = options?.categoryIds?.[`${head.ledgerType}|${head.applyType}|${name}`]
      || options?.categoryIds?.[name];
    cat = {
      id: stableId || uid(),
      name,
      applyType: head.applyType,
      ledgerType: head.ledgerType,
      materialInfo: head.materialInfo,
      qcpPoint: head.qcpPoint || '',
      productCode: options?.productCode || '',
      materialCode: options?.materialCode || '',
      driftRuleId: options?.driftRuleId || '',
      createdAt: options?.createdAt || nowStr(),
    };
    store.categories.push(cat);
    store.blocks[cat.id] = { batchRows: [] };
    return cat;
  }

  function categoryCtx(cat) {
    return {
      applyType: cat.applyType,
      materialInfo: cat.materialInfo || cat.name,
      materialCode: cat.materialCode,
      qcpPoint: cat.qcpPoint,
      ledgerType: cat.ledgerType,
    };
  }

  function detailRtForColumn(details, col, existingRts) {
    return (details || []).find((d) => {
      const t = deriveCol(d, details, existingRts);
      return t === col;
    });
  }

  function deriveCol(det, details, existingRts) {
    if (det.isNewImpurity === true || det.isNewImpurity === '是') {
      const fromSpectrum = det.rt != null && det.rt !== '' && !Number.isNaN(Number(det.rt))
        ? Number(Number(det.rt).toFixed(4))
        : null;
      if (fromSpectrum != null) return fromSpectrum;
    }
    if (det.typicalRt != null && det.typicalRt !== '' && !Number.isNaN(Number(det.typicalRt))) {
      return Number(Number(det.typicalRt).toFixed(4));
    }
    if (det.isNewImpurity === true || det.isNewImpurity === '是') {
      const existing = existingRts || [];
      if (det.rrt != null) {
        const fromRrt = Number(Number(det.rrt).toFixed(4));
        if (!existing.includes(fromRrt)) return fromRrt;
      }
      const main = details.find((d) => d.isMainPeak);
      if (main?.rt && main?.typicalRt && det.rt) {
        return Number((det.rt * main.typicalRt / main.rt).toFixed(4));
      }
    }
    if (det.typicalRt != null && det.typicalRt !== '') {
      return Number(Number(det.typicalRt).toFixed(4));
    }
    return null;
  }

  function impurityInfo(details, excess) {
    const key = excess ? 'isExcessImpurity' : 'isNewImpurity';
    const rows = (details || []).filter((d) => d[key] === true || d[key] === '是');
    if (!rows.length) return { flag: '/', info: '/' };
    const info = rows.map((r) => `${r.rt}:${r.area}`).join(',');
    return { flag: '是', info };
  }

  function deviationIndicator(warningRule) {
    if (!warningRule) return '/';
    const parts = [];
    if (warningRule.uclOp && warningRule.uclValue != null) {
      parts.push(`UCL:${warningRule.uclOp}${warningRule.uclValue}`);
    }
    if (warningRule.lclOp && warningRule.lclValue != null) {
      parts.push(`LCL:${warningRule.lclOp}${warningRule.lclValue}`);
    }
    return parts.join(' ') || '/';
  }

  function backfillBatchCells(batchRows, rtCols) {
    (batchRows || []).forEach((batch) => {
      if (!batch.cells) batch.cells = {};
      (rtCols || []).forEach((col) => {
        if (batch.cells[col] == null || batch.cells[col] === '') {
          batch.cells[col] = '/';
        }
      });
    });
  }

  function saveRecognitionToLedgerStore(store, record, driftRule, warningRule, options) {
    const opts = options || {};
    const genBatchId = opts.genBatchId || uid;
    const cat = ensureCategory(store, record, {
      ...opts,
      driftRuleId: driftRule?.id || opts.driftRuleId,
    });
    if (driftRule?.id) cat.driftRuleId = driftRule.id;
    const block = store.blocks[cat.id];
    const isFirstBatch = !block.batchRows.length;

    DTR.appendRollingTrRows(driftRule, record, isFirstBatch);

    const resolved = DTR.resolveForCategory(driftRule, cat);
    const rtCols = resolved.rtColumns;
    const prevRts = isFirstBatch ? [] : rtCols;

    const newImp = impurityInfo(record.details, false);
    const excessImp = impurityInfo(record.details, true);

    const cells = {};
    rtCols.forEach((col) => {
      const det = detailRtForColumn(record.details, col, prevRts);
      cells[col] = det ? Number(det.rt) : '/';
    });

    const batchId = opts.batchIds?.[record.id] || genBatchId();
    block.batchRows.push({
      id: batchId,
      batchNo: record.batchNo || `批号${block.batchRows.length + 1}`,
      cells,
      hasNewImpurity: newImp.flag,
      newImpurityInfo: newImp.info,
      hasExcessImpurity: excessImp.flag,
      excessImpurityInfo: excessImp.info,
      deviationIndicator: deviationIndicator(warningRule),
      createdAt: record.createdAt || nowStr(),
      createdBy: record.createdBy || 'Demo',
      enabled: record.enabled !== false,
      recognitionId: record.id || '',
    });

    backfillBatchCells(block.batchRows, rtCols);

    return { categoryId: cat.id, isFirstBatch, batchId, driftRuleChanged: true };
  }

  function saveRecognitionToLedger(record, driftRule, warningRule, options) {
    const store = loadLedger(record.ledgerType);
    const result = saveRecognitionToLedgerStore(store, record, driftRule, warningRule, options);
    saveLedger(record.ledgerType, store);
    return result;
  }

  function getTypicalRtsForCalc(ledgerType, applyType, materialInfo, qcpPoint, fallbackDriftRule) {
    const ctx = { applyType, materialInfo, qcpPoint, ledgerType };
    if (fallbackDriftRule) {
      return clone(DTR.typicalRtsForCalc(fallbackDriftRule, ctx));
    }
    const store = loadLedger(ledgerType);
    const head = { ledgerType, applyType, materialInfo, qcpPoint };
    const cat = findCategory(store, head);
    if (!cat) return [];
    const driftRules = optionsDriftRules();
    const rule = DTR.findDriftRule(driftRules, cat);
    return clone(DTR.typicalRtsForCalc(rule, cat));
  }

  function optionsDriftRules() {
    try {
      return ChromDriftStorage.load('drift-rules', ChromDriftSeedDriftRules.SEED_DRIFT_RULES);
    } catch {
      return [];
    }
  }

  function getStructureNames(ledgerType, applyType, materialInfo, qcpPoint, fallbackDriftRule) {
    const ctx = { applyType, materialInfo, qcpPoint, ledgerType };
    if (fallbackDriftRule) {
      return clone(DTR.structureNamesForCalc(fallbackDriftRule, ctx));
    }
    const store = loadLedger(ledgerType);
    const head = { ledgerType, applyType, materialInfo, qcpPoint };
    const cat = findCategory(store, head);
    if (!cat) return {};
    const rule = DTR.findDriftRule(optionsDriftRules(), cat);
    return clone(DTR.structureNamesForCalc(rule, cat));
  }

  function fixedRowMeta() {
    return {
      status: '/',
      hasNewImpurity: '/',
      newImpurityInfo: '/',
      hasExcessImpurity: '/',
      excessImpurityInfo: '/',
      deviationIndicator: '/',
      createdAt: '/',
      createdBy: '/',
    };
  }

  function buildMatrixRows(block, category, driftRule) {
    const resolved = DTR.resolveForCategory(driftRule, category);
    if (!resolved.rtColumns.length) return [];
    const categoryId = category.id;
    const rows = [];
    const fixed = fixedRowMeta();
    rows.push({
      id: `${categoryId}__rrt`,
      categoryId,
      categoryName: category?.name || '',
      rowType: 'rrt',
      rowLabel: 'RRT',
      isFixed: true,
      seq: 1,
      cells: { ...resolved.rrtCells },
      ...fixed,
    });
    rows.push({
      id: `${categoryId}__structure`,
      categoryId,
      categoryName: category?.name || '',
      rowType: 'structure',
      rowLabel: '定型结构',
      isFixed: true,
      seq: 2,
      cells: { ...resolved.structureCells },
      ...fixed,
    });
    const batches = [...(block.batchRows || [])].sort(
      (a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''),
    );
    backfillBatchCells(batches, resolved.rtColumns);
    batches.forEach((b, idx) => {
      rows.push({
        id: b.id,
        categoryId,
        categoryName: category?.name || '',
        rowType: 'batch',
        rowLabel: b.batchNo,
        isFixed: false,
        seq: 3 + idx,
        cells: { ...b.cells },
        status: b.enabled === false ? '禁用' : '启用',
        hasNewImpurity: b.hasNewImpurity || '/',
        newImpurityInfo: b.newImpurityInfo || '/',
        hasExcessImpurity: b.hasExcessImpurity || '/',
        excessImpurityInfo: b.excessImpurityInfo || '/',
        deviationIndicator: b.deviationIndicator || '/',
        createdAt: b.createdAt || '/',
        createdBy: b.createdBy || '/',
        enabled: b.enabled !== false,
        recognitionId: b.recognitionId || '',
      });
    });
    return rows;
  }

  function getRtColumnsUnion(resolvedList) {
    const set = new Set();
    (resolvedList || []).forEach((r) => (r.rtColumns || []).forEach((c) => set.add(c)));
    return [...set].sort((a, b) => a - b);
  }

  function buildTabMatrix(store, applyType, categoryId, query, ledgerType = 'GC', driftRules) {
    const rules = driftRules || optionsDriftRules();
    const cats = store.categories.filter(
      (c) => c.applyType === applyType && c.ledgerType === ledgerType,
    );
    const targetCats = categoryId
      ? cats.filter((c) => c.id === categoryId)
      : cats;
    const resolvedList = targetCats.map((cat) => ({
      cat,
      ...DTR.resolveForCategory(DTR.findDriftRule(rules, cat), cat),
    }));
    const rtColumns = getRtColumnsUnion(resolvedList);
    let rows = [];
    targetCats.forEach((cat) => {
      const block = store.blocks[cat.id];
      const rule = DTR.findDriftRule(rules, cat);
      if (block) rows = rows.concat(buildMatrixRows(block, cat, rule));
    });
    if (query) {
      rows = rows.filter((r) => {
        if (r.isFixed) return true;
        if (query.batchNo && !String(r.rowLabel).includes(query.batchNo)) return false;
        if (query.hasNewImpurity && r.hasNewImpurity !== query.hasNewImpurity) return false;
        if (query.enabled === '1' && r.status !== '启用') return false;
        if (query.enabled === '0' && r.status !== '禁用') return false;
        return true;
      });
    }
    return { rtColumns, rows };
  }

  function findSummaryCategory(store, f, ledgerType = 'GC') {
    const code = (f.materialCode || '').trim();
    const qcp = (f.qcpPoint || '').trim();
    return store.categories.find((c) => {
      if (c.applyType !== f.applyType || c.ledgerType !== ledgerType) return false;
      if (f.applyType === '生产过程') {
        if (qcp && (c.qcpPoint || '') !== qcp) return false;
        return (c.name || '') === qcp
          || (c.name || '').endsWith(`-${qcp}`)
          || (c.name || '').includes(qcp);
      }
      return (c.materialCode || '') === code
        || (c.name || '') === `${c.productCode || 'CP001'}-${code}`
        || (c.name || '').endsWith(`-${code}`);
    });
  }

  function buildUnionFixedCells(chunks, rtColumns) {
    const rrtCells = {};
    const structureCells = {};
    (rtColumns || []).forEach((col) => {
      const rrtParts = [];
      const structParts = [];
      (chunks || []).forEach((ch) => {
        const rrt = ch.resolved?.rrtCells?.[col];
        const structure = ch.resolved?.structureCells?.[col];
        if (rrt != null && rrt !== '/' && rrt !== '') rrtParts.push(String(rrt));
        if (structure != null && structure !== '/' && structure !== '') {
          structParts.push(String(structure));
        }
      });
      rrtCells[col] = rrtParts.length ? rrtParts.join(',') : '/';
      structureCells[col] = structParts.length ? structParts.join(',') : '/';
    });
    return { rrtCells, structureCells };
  }

  function buildSummaryMatrix(store, filters, ledgerType = 'GC', driftRules) {
    const rules = driftRules || optionsDriftRules();
    const rtSet = new Set();
    const chunks = [];
    (filters || []).forEach((f) => {
      const cat = findSummaryCategory(store, f, ledgerType);
      if (!cat) return;
      const block = store.blocks[cat.id];
      if (!block) return;
      const rule = DTR.findDriftRule(rules, cat);
      const resolved = DTR.resolveForCategory(rule, cat);
      (resolved.rtColumns || []).forEach((c) => rtSet.add(c));
      const batch = (block.batchRows || []).find(
        (b) => !f.batchNo || String(b.batchNo).includes(f.batchNo),
      ) || block.batchRows?.[0];
      if (!batch) return;
      chunks.push({
        sourceType: f.applyType,
        qcpPoint: cat.qcpPoint || '/',
        resolved,
        batch,
      });
    });
    const rtColumns = [...rtSet].sort((a, b) => a - b);
    const rows = [];
    if (rtColumns.length && chunks.length) {
      const union = buildUnionFixedCells(chunks, rtColumns);
      const fixed = fixedRowMeta();
      rows.push({
        id: 'sum_header_rrt',
        rowType: 'rrt',
        rowLabel: 'RRT',
        isFixed: true,
        sourceType: '/',
        qcpPoint: '/',
        cells: union.rrtCells,
        ...fixed,
      });
      rows.push({
        id: 'sum_header_struct',
        rowType: 'structure',
        rowLabel: '定性结构',
        isFixed: true,
        sourceType: '/',
        qcpPoint: '/',
        cells: union.structureCells,
        ...fixed,
      });
    }
    chunks.forEach((ch, ci) => {
      backfillBatchCells([ch.batch], rtColumns);
      rows.push({
        id: `sum_${ci}_batch`,
        rowType: 'batch',
        rowLabel: ch.batch.batchNo,
        isFixed: false,
        sourceType: ch.sourceType,
        qcpPoint: ch.qcpPoint,
        cells: { ...ch.batch.cells },
        hasNewImpurity: ch.batch.hasNewImpurity || '/',
        newImpurityInfo: ch.batch.newImpurityInfo || '/',
        hasExcessImpurity: ch.batch.hasExcessImpurity || '/',
        excessImpurityInfo: ch.batch.excessImpurityInfo || '/',
        deviationIndicator: ch.batch.deviationIndicator || '/',
      });
    });
    return { rtColumns, rows };
  }

  function addCategory(store, payload) {
    const { applyType, materialCode, qcpPoint, qcpName, ledgerType = 'GC' } = payload;
    let name = '';
    if (applyType === '生产过程') {
      name = qcpPoint || '';
    } else if (materialCode && qcpPoint) {
      name = `${materialCode}-${qcpPoint}`;
    } else {
      name = materialCode || qcpPoint || '';
    }
    if (!name) return { error: '请填写分类信息' };
    if (store.categories.some((c) => c.name === name && c.applyType === applyType)) {
      return { error: '分类已存在' };
    }
    const cat = {
      id: uid(),
      name,
      applyType,
      ledgerType,
      materialInfo: name,
      qcpPoint: qcpPoint || '',
      productCode: '',
      materialCode: materialCode || '',
      driftRuleId: '',
      createdAt: nowStr(),
    };
    store.categories.push(cat);
    store.blocks[cat.id] = { batchRows: [] };
    return { category: cat };
  }

  function deleteBatchRows(store, categoryId, batchIds) {
    const block = store.blocks[categoryId];
    if (!block) return { error: '分类不存在' };
    const inUse = batchIds.filter((id) => {
      const row = block.batchRows.find((b) => b.id === id);
      return row?.recognitionId;
    });
    if (inUse.length) return { error: '此数据正在使用，不可删除' };
    block.batchRows = block.batchRows.filter((b) => !batchIds.includes(b.id));
    return { ok: true };
  }

  function deleteCategory(store, categoryId) {
    const block = store.blocks[categoryId];
    if (block?.batchRows?.length) return { error: '分类下有关联数据，不可删除' };
    store.categories = store.categories.filter((c) => c.id !== categoryId);
    delete store.blocks[categoryId];
    return { ok: true };
  }

  function persistDriftRule(driftRules, driftRule) {
    if (!driftRule || !driftRules) return;
    const idx = driftRules.findIndex((r) => r.id === driftRule.id);
    if (idx >= 0) driftRules[idx] = driftRule;
    ChromDriftStorage.save('drift-rules', driftRules);
  }

  window.ChromDriftLedgerBuilder = {
    loadLedger,
    saveLedger,
    saveRecognitionToLedger,
    saveRecognitionToLedgerStore,
    persistDriftRule,
    getTypicalRtsForCalc,
    getStructureNames,
    categoryName,
    buildMatrixRows,
    buildTabMatrix,
    buildSummaryMatrix,
    addCategory,
    deleteBatchRows,
    deleteCategory,
    getRtColumnsUnion,
    optionsDriftRules,
  };
})();
