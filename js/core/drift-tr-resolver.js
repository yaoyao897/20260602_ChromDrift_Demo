/**
 * 漂移规则详情 tR 子表 → 台账列头 / 比对基准（PRD 实时渲染）
 */
(function () {
  const { uid } = ChromDriftStorage;

  function norm(s) {
    return (s || '').trim();
  }

  function rowTypeOf(tr) {
    const t = tr?.rowType || 'initial';
    if (t === '初始设置' || t === 'initial') return 'initial';
    if (t === '滚动叠加' || t === 'rolling') return 'rolling';
    return t;
  }

  function materialKey(ctx) {
    return norm(ctx.materialCode) || norm(ctx.materialInfo);
  }

  function filterTrRows(trRows, ctx) {
    const mat = materialKey(ctx);
    const qcp = norm(ctx.qcpPoint);
    const applyType = ctx.applyType || '';
    return (trRows || []).filter((tr) => {
      if (rowTypeOf(tr) === 'initial') return true;
      const trMat = norm(tr.applyMaterial);
      const trQcp = norm(tr.applyQcp);
      if (trMat && mat && trMat !== mat && !mat.includes(trMat)) return false;
      if (trQcp && qcp && trQcp !== qcp) return false;
      return true;
    });
  }

  function buildMatrixFromTrRows(trRows) {
    const rows = (trRows || []).filter((r) => r.typicalRt != null && r.typicalRt !== '');
    if (!rows.length) {
      return { rtColumns: [], rrtCells: {}, structureCells: {} };
    }
    const rtColumns = [...new Set(
      rows.map((r) => Number(Number(r.typicalRt).toFixed(4))),
    )].sort((a, b) => a - b);
    const main = rows.find((r) => r.isMainPeak && rowTypeOf(r) === 'initial')
      || rows.find((r) => r.isMainPeak)
      || rows[0];
    const mainTypical = main ? Number(main.typicalRt) : null;
    const rrtCells = {};
    const structureCells = {};
    rtColumns.forEach((col) => {
      const tr = rows.find((r) => Number(Number(r.typicalRt).toFixed(4)) === col);
      if (!tr) return;
      rrtCells[col] = mainTypical
        ? Number((Number(tr.typicalRt) / mainTypical).toFixed(4))
        : '/';
      structureCells[col] = tr.isMainPeak ? '主峰' : (tr.compoundName || '/');
    });
    return { rtColumns, rrtCells, structureCells };
  }

  function resolveForCategory(driftRule, category) {
    if (!driftRule) {
      return { rtColumns: [], rrtCells: {}, structureCells: {} };
    }
    const ctx = {
      applyType: category?.applyType,
      materialInfo: category?.materialInfo || category?.name,
      materialCode: category?.materialCode,
      qcpPoint: category?.qcpPoint,
    };
    const filtered = filterTrRows(driftRule.trRows, ctx);
    return buildMatrixFromTrRows(filtered);
  }

  function findDriftRule(driftRules, category) {
    if (!category) return null;
    const list = driftRules || [];
    if (category.driftRuleId) {
      const hit = list.find((r) => r.id === category.driftRuleId);
      if (hit) return hit;
    }
    const head = {
      ledgerType: category.ledgerType,
      applyType: category.applyType,
      materialInfo: category.materialInfo || category.name,
      qcpPoint: category.qcpPoint,
    };
    return ChromDriftRuleMatcher.matchDriftRule(head, list);
  }

  function shouldExpandNewImpurityCols(rtAccumMode, isFirstBatch) {
    if (rtAccumMode === 'batch') return true;
    if (rtAccumMode === 'first_batch') return isFirstBatch;
    return false;
  }

  function rollingColumnKey(det) {
    if (det?.rt == null || det.rt === '' || Number.isNaN(Number(det.rt))) return null;
    return Number(Number(det.rt).toFixed(4));
  }

  function deriveTypicalRt(det, details, existingRts) {
    const existing = new Set((existingRts || []).map((c) => Number(Number(c).toFixed(4))));
    const fromSpectrum = rollingColumnKey(det);
    if (fromSpectrum != null && !existing.has(fromSpectrum)) return fromSpectrum;
    if (det.isNewImpurity !== true && det.isNewImpurity !== '是') {
      if (det.typicalRt != null && det.typicalRt !== '' && !Number.isNaN(Number(det.typicalRt))) {
        return Number(Number(det.typicalRt).toFixed(4));
      }
      return null;
    }
    if (det.rrt != null && !Number.isNaN(Number(det.rrt))) {
      const fromRrt = Number(Number(det.rrt).toFixed(4));
      if (!existing.has(fromRrt)) return fromRrt;
    }
    const main = (details || []).find((d) => d.isMainPeak);
    if (main?.rt && main?.typicalRt && det.rt) {
      const derived = Number((det.rt * main.typicalRt / main.rt).toFixed(4));
      if (!existing.has(derived)) return derived;
    }
    return null;
  }

  function rollingTrExists(trRows, col, ctx) {
    const mat = materialKey(ctx);
    const qcp = norm(ctx.qcpPoint);
    return (trRows || []).some((tr) => {
      if (rowTypeOf(tr) !== 'rolling') return false;
      if (Number(Number(tr.typicalRt).toFixed(4)) !== col) return false;
      const trMat = norm(tr.applyMaterial);
      const trQcp = norm(tr.applyQcp);
      if (trMat && mat && trMat !== mat) return false;
      if (trQcp && qcp && trQcp !== qcp) return false;
      return true;
    });
  }

  function appendRollingTrRows(driftRule, record, isFirstBatch) {
    if (!driftRule) return false;
    const mode = driftRule.rtAccumMode || 'fixed';
    if (!shouldExpandNewImpurityCols(mode, isFirstBatch)) return false;
    const ctx = {
      applyType: record.applyType,
      materialInfo: record.materialInfo,
      materialCode: record.materialCode,
      qcpPoint: record.qcpPoint,
    };
    const filtered = filterTrRows(driftRule.trRows, ctx);
    const existingRts = filtered.map((t) => Number(Number(t.typicalRt).toFixed(4)));
    const newRows = (record.details || [])
      .filter((d) => d.isNewImpurity === true || d.isNewImpurity === '是');
    let changed = false;
    if (!driftRule.trRows) driftRule.trRows = [];
    newRows.forEach((det) => {
      const col = deriveTypicalRt(det, record.details, existingRts);
      if (col == null || Number.isNaN(col)) return;
      if (rollingTrExists(driftRule.trRows, col, ctx)) return;
      driftRule.trRows.push({
        id: uid(),
        rowType: 'rolling',
        applyMaterial: materialKey(ctx),
        applyQcp: norm(record.qcpPoint),
        typicalRt: col,
        compoundName: det.componentName || '新杂',
        isMainPeak: false,
      });
      existingRts.push(col);
      changed = true;
    });
    return changed;
  }

  function typicalRtsForCalc(driftRule, ctx) {
    if (!driftRule) return [];
    return resolveForCategory(driftRule, ctx).rtColumns;
  }

  function structureNamesForCalc(driftRule, ctx) {
    if (!driftRule) return {};
    return { ...resolveForCategory(driftRule, ctx).structureCells };
  }

  window.ChromDriftDriftTrResolver = {
    filterTrRows,
    buildMatrixFromTrRows,
    resolveForCategory,
    findDriftRule,
    appendRollingTrRows,
    typicalRtsForCalc,
    structureNamesForCalc,
    rowTypeOf,
  };
})();
