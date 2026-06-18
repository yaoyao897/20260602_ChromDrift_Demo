(function () {
  const { DRIFT_TAB_CONFIG } = window.ChromDriftEnums;

  function visibleTabs(applyType) {
    const cfg = DRIFT_TAB_CONFIG[applyType] || DRIFT_TAB_CONFIG['原材料'];
    return cfg.tabs;
  }

  function formatDeviationRange(min, max) {
    if (min == null || max == null) return '';
    return `${min}~${max}`;
  }

  function trSummary(row) {
    const arr = (row.trRows || []).map((r) => r.typicalRt);
    return arr.length ? arr.join(', ') : '/';
  }

  function materialSummary(row) {
    const codes = (row.materials || []).map((m) => m.materialCode);
    return codes.length ? codes.join(', ') : '/';
  }

  function qcpSummary(row) {
    const codes = (row.qcpPoints || []).map((q) => q.qcpCode);
    return codes.length ? codes.join(', ') : '/';
  }

  function rtModeLabel(v) {
    return window.ChromDriftEnums.RT_ACCUM_MODES.find((o) => o.value === v)?.label || v;
  }

  function isRollingRow(row) {
    const t = row?.rowType || 'initial';
    return t === 'rolling' || t === '滚动叠加';
  }

  function rowTypeLabel(row) {
    return isRollingRow(row) ? '滚动叠加' : '初始设置';
  }

  function isRollingRtMode(mode) {
    return mode === 'batch' || mode === 'first_batch';
  }

  function showTrApplyQcp(applyType) {
    return applyType === '生产过程';
  }

  function validateDriftRule(form, allRules, editingId) {
    const errs = [];
    if (!form.code?.trim()) errs.push('请填写规则编码');
    if (!form.name?.trim()) errs.push('请填写规则名称');
    if (form.deviationMin == null || form.deviationMax == null) errs.push('请填写相对保留时间与典型保留时间差值范围');
    const dupCode = allRules.some((r) => r.code === form.code && r.id !== editingId);
    const dupName = allRules.some((r) => r.name === form.name && r.id !== editingId);
    if (dupCode) errs.push('规则编码已存在');
    if (dupName) errs.push('规则名称已存在');

    const initialTrs = (form.trRows || []).filter((r) => !isRollingRow(r));
    const mainCount = initialTrs.filter((r) => r.isMainPeak).length;

    if (!isRollingRtMode(form.rtAccumMode)) {
      if (!initialTrs.length) errs.push('请添加 tR 典型保留时间');
      if (mainCount !== 1) errs.push('请指定一个主峰');
    } else if (initialTrs.length && mainCount !== 1) {
      errs.push('请指定一个主峰');
    }

    const allTrs = form.trRows || [];
    const rts = allTrs
      .filter((r) => r.typicalRt != null && r.typicalRt !== '')
      .map((r) => Number(Number(r.typicalRt).toFixed(4)));
    if (rts.some((n) => Number.isNaN(n))) errs.push('典型保留时间须为有效数值');
    if (rts.length && new Set(rts).size !== rts.length) errs.push('典型保留时间不可重复');
    const names = allTrs.map((r) => (r.compoundName || '').trim()).filter(Boolean);
    if (new Set(names).size !== names.length) errs.push('化合物名称不可重复');

    const cfg = DRIFT_TAB_CONFIG[form.applyType] || {};
    if (cfg.materialRequired && !(form.materials || []).length) errs.push('请添加适用物料');
    if (cfg.qcpRequired && !(form.qcpPoints || []).length) errs.push('请添加 QCP点');

    const matCodes = (form.materials || []).map((m) => m.materialCode);
    if (matCodes.length !== new Set(matCodes).size) errs.push('物料编码不可重复');
    const qcpCodes = (form.qcpPoints || []).map((q) => q.qcpCode);
    if (qcpCodes.length !== new Set(qcpCodes).size) errs.push('QCP编码不可重复');

    return errs;
  }

  function validateRollingTrSave(rule) {
    const errs = [];
    const trs = rule.trRows || [];
    const rts = trs.map((r) => Number(Number(r.typicalRt).toFixed(4)));
    if (rts.some((n) => Number.isNaN(n))) errs.push('典型保留时间须为有效数值');
    if (new Set(rts).size !== rts.length) errs.push('典型保留时间不可重复');
    const names = trs.map((r) => (r.compoundName || '').trim()).filter(Boolean);
    if (new Set(names).size !== names.length) errs.push('化合物名称不可重复');
    const rolling = trs.filter((r) => isRollingRow(r));
    rolling.forEach((r) => {
      if (!r.compoundName?.trim()) errs.push('滚动叠加行请填写化合物名称');
    });
    return errs;
  }

  window.ChromDriftDriftValidators = {
    visibleTabs,
    formatDeviationRange,
    trSummary,
    materialSummary,
    qcpSummary,
    rtModeLabel,
    isRollingRow,
    rowTypeLabel,
    isRollingRtMode,
    showTrApplyQcp,
    validateDriftRule,
    validateRollingTrSave,
  };
})();
