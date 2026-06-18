/**
 * 漂移规则 / 偏差预警规则自动匹配（PRD §8 / §9）
 */
(function () {
  function norm(s) {
    return (s || '').trim();
  }

  function scoreMaterials(ruleMaterials, materialInfo) {
    const info = norm(materialInfo);
    if (!info || !ruleMaterials?.length) return 0;
    let s = 0;
    ruleMaterials.forEach((m) => {
      const code = norm(m.materialCode);
      if (code && info.includes(code)) s += 2;
    });
    return s;
  }

  function scoreQcp(ruleQcps, qcpPoint) {
    const q = norm(qcpPoint);
    if (!q || !ruleQcps?.length) return 0;
    let s = 0;
    ruleQcps.forEach((item) => {
      const code = norm(item.qcpCode);
      if (code && (q === code || q.includes(code))) s += 2;
    });
    return s;
  }

  function pickBest(candidates) {
    if (!candidates.length) return null;
    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return (b.createdAt || '').localeCompare(a.createdAt || '');
    });
    return candidates[0].rule;
  }

  function matchDriftRule(head, driftRules) {
    const list = (driftRules || []).filter((r) => r.enabled !== false);
    const candidates = [];
    list.forEach((rule) => {
      if (rule.ledgerType !== head.ledgerType) return;
      if (rule.applyType !== head.applyType) return;
      const score = scoreMaterials(rule.materials, head.materialInfo)
        + scoreQcp(rule.qcpPoints, head.qcpPoint);
      if (head.applyType === '生产过程' && !head.qcpPoint && !rule.qcpPoints?.length) {
        return;
      }
      if (score <= 0 && (rule.materials?.length || rule.qcpPoints?.length)) return;
      candidates.push({ rule, score, createdAt: rule.createdAt });
    });
    return pickBest(candidates);
  }

  function matchWarningRule(head, warningRules) {
    const list = (warningRules || []).filter((r) => r.enabled !== false);
    const candidates = [];
    list.forEach((rule) => {
      if (rule.applyType !== head.applyType) return;
      const score = scoreMaterials(rule.materials, head.materialInfo)
        + scoreQcp(rule.qcpPoints, head.qcpPoint);
      if (score <= 0 && (rule.materials?.length || rule.qcpPoints?.length)) return;
      candidates.push({ rule, score, createdAt: rule.createdAt });
    });
    return pickBest(candidates);
  }

  function formatDeviationRange(rule) {
    if (!rule) return '';
    if (rule.deviationMin == null || rule.deviationMax == null) return '';
    return `${rule.deviationMin}~${rule.deviationMax}`;
  }

  window.ChromDriftRuleMatcher = {
    matchDriftRule,
    matchWarningRule,
    formatDeviationRange,
  };
})();
