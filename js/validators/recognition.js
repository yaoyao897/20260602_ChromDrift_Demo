(function () {
  function headComplete(form, applyType) {
    const errs = [];
    if (!form.ledgerType) errs.push('请选择台账类型');
    if (!form.applyType) errs.push('请选择类型');
    if (!form.fileName?.trim()) errs.push('请填写文件名称');
    if (!form.sampleName?.trim()) errs.push('请填写样品名称');
    if (!form.instrumentCode) errs.push('请选择仪器编号');
    if (!form.materialInfo?.trim()) errs.push('请填写物料信息');
    if (!form.batchNo?.trim()) errs.push('请填写批号');
    if (applyType === '生产过程' && !form.qcpPoint?.trim()) errs.push('请选择QCP点');
    if (!form.ruleName?.trim()) errs.push('未匹配到漂移规则，请补全配置');
    if (!form.warningRuleName?.trim()) errs.push('未匹配到偏差预警规则，请补全配置');
    return errs;
  }

  function validateSave(form, details) {
    const errs = headComplete(form, form.applyType);
    if (!details?.length) errs.push('请先计算生成明细');
    details.forEach((d) => {
      if (d.typicalRt == null || d.typicalRt === '') return;
      if (d.isNewImpurity !== true && d.isNewImpurity !== '是') return;
      const note = String(d.abnormalNote || '');
      if (note === '顺序异常' || note.includes('重复匹配')) return;
      errs.push(`峰${d.peakNo}：对应典型保留时间有值时不可标记为新杂`);
    });
    const lockErr = ChromDriftSpectrumCalc.validateLockedUnique(details);
    if (lockErr) errs.push(lockErr);
    return errs;
  }

  window.ChromDriftRecognitionValidators = {
    headComplete,
    validateSave,
  };
})();
