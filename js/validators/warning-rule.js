(function () {
  const { WARNING_TAB_CONFIG, DEVIATION_TYPES } = window.ChromDriftEnums;
  const { materialSummary, qcpSummary } = window.ChromDriftDriftValidators;

  function visibleTabs(applyType) {
    const cfg = WARNING_TAB_CONFIG[applyType] || WARNING_TAB_CONFIG['原材料'];
    return cfg.tabs;
  }

  function deviationTypeLabel(v) {
    return DEVIATION_TYPES.find((o) => o.value === v)?.label || v;
  }

  function formatLimit(op, value) {
    if (value == null || value === '') return '';
    return `${op || ''}${value}`;
  }

  function validateWarningRule(form, allRules, editingId) {
    const errs = [];
    if (!form.code?.trim()) errs.push('请填写规则编码');
    if (!form.name?.trim()) errs.push('请填写规则名称');
    if (!form.deviationType) errs.push('请选择偏差类型');
    const dupCode = allRules.some((r) => r.code === form.code && r.id !== editingId);
    const dupName = allRules.some((r) => r.name === form.name && r.id !== editingId);
    if (dupCode) errs.push('规则编码已存在');
    if (dupName) errs.push('规则名称已存在');

    const cfg = WARNING_TAB_CONFIG[form.applyType] || {};
    if (cfg.materialRequired && !(form.materials || []).length) errs.push('请添加适用物料');
    if (cfg.qcpRequired && !(form.qcpPoints || []).length) errs.push('请添加 QCP点');

    const matCodes = (form.materials || []).map((m) => m.materialCode);
    if (matCodes.length !== new Set(matCodes).size) errs.push('物料编码不可重复');
    const qcpCodes = (form.qcpPoints || []).map((q) => q.qcpCode);
    if (qcpCodes.length !== new Set(qcpCodes).size) errs.push('QCP编码不可重复');

    return errs;
  }

  window.ChromDriftWarningValidators = {
    visibleTabs,
    deviationTypeLabel,
    formatLimit,
    materialSummary,
    qcpSummary,
    validateWarningRule,
  };
})();
