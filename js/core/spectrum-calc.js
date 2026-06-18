/**
 * 图谱识别计算（PRD §5 简化 Demo 实现）
 */
(function () {
  const MOCK_PEAKS = [
    { peakNo: 1, rt: 1.142, area: 1200, component: '杂质A' },
    { peakNo: 2, rt: 2.142, area: 890, component: '杂质B' },
    { peakNo: 3, rt: 5.156, area: 52000, component: '主峰' },
    { peakNo: 4, rt: 7.652, area: 2100, component: '杂质C' },
    { peakNo: 5, rt: 8.135, area: 1.2, component: '未知峰' },
  ];

  function parseSpectrumInput(raw, fileName) {
    if (Array.isArray(raw)) {
      return raw.map((p, i) => ({
        peakNo: p.peakNo ?? i + 1,
        rt: Number(p.rt),
        area: Number(p.area),
        component: p.component || p.componentName || '',
      }));
    }
    if (raw?.peaks && Array.isArray(raw.peaks)) return parseSpectrumInput(raw.peaks, fileName);
    return clonePeaks(MOCK_PEAKS);
  }

  function clonePeaks(peaks) {
    return peaks.map((p) => ({ ...p }));
  }

  function parseCsvOrTsv(text) {
    const lines = String(text).trim().split(/\r?\n/).filter((l) => l.trim());
    if (!lines.length) return null;
    const sep = lines[0].includes('\t') ? '\t' : ',';
    const header = lines[0].split(sep).map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());
    const hasHeader = header.some((h) => /peak|序号|rt|保留|area|面积|component|组分|化合物/.test(h));
    const peaks = [];
    const start = hasHeader ? 1 : 0;
    for (let i = start; i < lines.length; i++) {
      const cols = lines[i].split(sep).map((c) => c.trim().replace(/^"|"$/g, ''));
      if (!cols.length) continue;
      if (hasHeader) {
        const peak = { peakNo: peaks.length + 1, rt: NaN, area: 0, component: '' };
        header.forEach((h, j) => {
          const v = cols[j];
          if (!v) return;
          if (/peak|序号/.test(h)) peak.peakNo = Number(v);
          else if (/rt|保留/.test(h)) peak.rt = Number(v);
          else if (/area|面积/.test(h)) peak.area = Number(v);
          else if (/component|组分|化合物/.test(h)) peak.component = v;
        });
        peaks.push(peak);
      } else {
        peaks.push({
          peakNo: Number(cols[0]) || peaks.length + 1,
          rt: Number(cols[1]),
          area: Number(cols[2]) || 0,
          component: cols[3] || '',
        });
      }
    }
    return peaks.filter((p) => !Number.isNaN(p.rt));
  }

  function parseTextSpectrum(text, fileName) {
    const trimmed = String(text).trim();
    if (!trimmed) return null;
    const ext = (fileName || '').split('.').pop()?.toLowerCase();
    if (ext === 'csv' || ext === 'txt') {
      const fromDelim = parseCsvOrTsv(trimmed);
      if (fromDelim?.length) return fromDelim;
    }
    try {
      const json = JSON.parse(trimmed);
      return parseSpectrumInput(json, fileName);
    } catch {
      const fromDelim = parseCsvOrTsv(trimmed);
      if (fromDelim?.length) return fromDelim;
    }
    return null;
  }

  function parseUploadFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const text = reader.result;
          const peaks = parseTextSpectrum(text, file.name);
          resolve(peaks?.length ? peaks : clonePeaks(MOCK_PEAKS));
        } catch {
          resolve(clonePeaks(MOCK_PEAKS));
        }
      };
      reader.onerror = () => reject(new Error('文件读取失败'));
      reader.readAsText(file);
    });
  }

  function inferHeadFromFileName(fileName) {
    const base = (fileName || 'RA001-1-2026012601').replace(/\.[^.]+$/, '');
    const batchNo = base.length > 8 ? base.slice(-8) : base;
    const materialInfo = base.length > 8 ? base.slice(0, -8) : base;
    return { sampleName: base, batchNo, materialInfo };
  }

  function nearestTypical(rrt, typicalRts) {
    if (!typicalRts?.length || rrt == null) return null;
    let best = typicalRts[0];
    let bestDiff = Math.abs(rrt - best);
    typicalRts.forEach((t) => {
      const d = Math.abs(rrt - t);
      if (d < bestDiff) {
        best = t;
        bestDiff = d;
      }
    });
    return best;
  }

  function inDeviation(m, min, max) {
    if (m == null || min == null || max == null) return false;
    return m >= min && m <= max;
  }

  function compareLimit(area, op, val) {
    if (val == null || area == null) return true;
    const a = Number(area);
    const v = Number(val);
    if (op === '≤') return a <= v;
    if (op === '＜') return a < v;
    if (op === '≥') return a >= v;
    if (op === '>') return a > v;
    return true;
  }

  function checkExcessImpurity(area, warningRule) {
    if (!warningRule) return '/';
    const uclOk = warningRule.uclValue == null
      || compareLimit(area, warningRule.uclOp, warningRule.uclValue);
    const lclOk = warningRule.lclValue == null
      || compareLimit(area, warningRule.lclOp, warningRule.lclValue);
    return (uclOk && lclOk) ? '否' : '是';
  }

  function isQualifiedInLedger(component, structureCells, typicalRt) {
    const names = Object.values(structureCells || {});
    if (component && names.some((n) => n && n !== '主峰' && n === component)) return true;
    return false;
  }

  function findReferencePeak(peaks, rows, mainIdx, structureCells) {
    const main = rows[mainIdx];
    if (!main) return null;
    const qualified = rows.filter((r, i) => i !== mainIdx && (
      isQualifiedInLedger(r.componentName, structureCells, r.typicalRt)
      || (r.typicalRt != null && r.isNewImpurity !== true && r.isNewImpurity !== '是')
    ));
    if (!qualified.length) {
      const mainPeakNo = main.peakNo;
      return (target) => {
        const tNo = target.peakNo;
        if (tNo < mainPeakNo) {
          const next = rows.find((r) => r.peakNo === tNo + 1);
          return next || main;
        }
        if (tNo > mainPeakNo) {
          const prev = rows.find((r) => r.peakNo === tNo - 1);
          return prev || main;
        }
        return main;
      };
    }
    return (target) => {
      let best = main;
      let bestDiff = Math.abs(target.rt - main.rt);
      qualified.forEach((q) => {
        const d = Math.abs(target.rt - q.rt);
        if (d < bestDiff) {
          best = q;
          bestDiff = d;
        }
      });
      [main, ...qualified].forEach((q) => {
        const d = Math.abs(target.rt - q.rt);
        if (d < bestDiff) {
          best = q;
          bestDiff = d;
        }
      });
      return best;
    };
  }

  function buildDetailRows(peaks) {
    const maxArea = Math.max(...peaks.map((p) => p.area));
    return peaks.map((p) => ({
      id: `${p.peakNo}`,
      peakNo: p.peakNo,
      rt: p.rt,
      area: p.area,
      componentName: p.component || '',
      isMainPeak: p.area === maxArea,
      rrt: null,
      typicalRt: null,
      locked: false,
      abnormalNote: '/',
      deviationRange: '',
      isNewImpurity: false,
      isExcessImpurity: '/',
      calcMark: '',
    }));
  }

  function runCalculation(ctx) {
    const {
      peaks,
      typicalRts,
      structureCells,
      driftRule,
      warningRule,
      existingRows,
      recalc,
    } = ctx;

    const deviationRange = ChromDriftRuleMatcher.formatDeviationRange(driftRule);
    const min = driftRule?.deviationMin;
    const max = driftRule?.deviationMax;
    const rows = existingRows?.length && recalc
      ? existingRows.map((r) => ({ ...r }))
      : buildDetailRows(peaks);

    rows.forEach((r) => {
      if (!recalc || !existingRows?.length) {
        r.isMainPeak = r.area === Math.max(...rows.map((x) => x.area));
      }
      if (r.isMainPeak) {
        r.locked = true;
        const mainTr = typicalRts.find((t) => structureCells && Object.entries(structureCells).some(
          ([col, name]) => name === '主峰' && Number(col) === t,
        )) || typicalRts.find((t) => driftRule?.trRows?.some(
          (tr) => tr.isMainPeak && Number(tr.typicalRt) === t,
        )) || nearestTypical(r.rt, typicalRts) || typicalRts[0];
        r.typicalRt = mainTr != null ? mainTr : null;
        r.rrt = 1;
        r.isNewImpurity = false;
        r.deviationRange = deviationRange;
        r.abnormalNote = r.typicalRt == null ? '未匹配到' : '/';
        r.isExcessImpurity = '/';
        return;
      }

      const qualified = isQualifiedInLedger(
        r.componentName,
        structureCells,
        r.typicalRt,
      );
      if (qualified) {
        const matchTr = typicalRts.find((t) => structureCells && Object.entries(structureCells).some(
          ([col, name]) => name === r.componentName && Number(col) === t,
        ));
        r.typicalRt = matchTr != null ? matchTr : nearestTypical(r.rt, typicalRts);
        r.locked = true;
        r.isNewImpurity = false;
        r.deviationRange = deviationRange;
        r.abnormalNote = r.typicalRt == null ? '未匹配到' : '/';
        r.isExcessImpurity = '/';
        return;
      }

      if (recalc && r.locked && r.typicalRt != null) {
        r.deviationRange = deviationRange;
        r.isNewImpurity = false;
        r.abnormalNote = '/';
        r.isExcessImpurity = r.isNewImpurity ? checkExcessImpurity(r.area, warningRule) : '/';
        return;
      }
    });

    const mainIdx = rows.findIndex((r) => r.isMainPeak);
    const refFn = findReferencePeak(peaks, rows, mainIdx, structureCells);

    rows.forEach((r) => {
      if (r.isMainPeak || r.locked) return;
      if (recalc && r.locked) return;
      const ref = refFn(r);
      if (!ref || ref.typicalRt == null || !ref.rt) {
        r.calcMark = '▲';
        return;
      }
      r.rrt = Number((r.rt * ref.typicalRt / ref.rt).toFixed(4));
      const tNear = nearestTypical(r.rrt, typicalRts);
      const m = tNear != null ? Number((tNear - r.rrt).toFixed(4)) : null;
      r.deviationRange = deviationRange;
      if (tNear == null || !inDeviation(m, min, max)) {
        r.typicalRt = null;
        r.isNewImpurity = true;
        r.abnormalNote = '未匹配到';
        r.isExcessImpurity = checkExcessImpurity(r.area, warningRule);
        r.calcMark = '❌';
        return;
      }
      const dup = rows.filter(
        (x) => x !== r && x.typicalRt != null && Number(x.typicalRt) === tNear && !x.isNewImpurity,
      );
      if (dup.length) {
        r.typicalRt = tNear;
        r.isNewImpurity = true;
        r.abnormalNote = `重复匹配(${tNear})`;
        r.isExcessImpurity = checkExcessImpurity(r.area, warningRule);
        r.calcMark = '❌';
        return;
      }
      r.typicalRt = tNear;
      r.isNewImpurity = false;
      r.abnormalNote = '/';
      r.isExcessImpurity = '/';
      r.calcMark = '✅';
    });

    postValidateOrder(rows, typicalRts, warningRule);

    const hasNew = rows.some((r) => r.isNewImpurity === true || r.isNewImpurity === '是');
    const hasExcess = rows.some((r) => r.isExcessImpurity === '是');

    return {
      details: rows,
      hasNewImpurity: hasNew ? '是' : '否',
      hasExcessImpurity: hasExcess ? '是' : '否',
      deviationRange,
    };
  }

  function postValidateOrder(rows, typicalRts, warningRule) {
    const sorted = [...typicalRts].sort((a, b) => a - b);
    rows.forEach((r, idx) => {
      if (r.typicalRt == null) return;
      const tr = Number(r.typicalRt);
      const prior = rows.slice(0, idx).filter((x) => x.typicalRt != null && !x.isNewImpurity);
      prior.forEach((p) => {
        const pTr = Number(p.typicalRt);
        const minPrior = sorted.filter((t) => t < pTr);
        if (minPrior.some((t) => tr < t)) {
          r.abnormalNote = '顺序异常';
          r.isNewImpurity = true;
          r.isExcessImpurity = checkExcessImpurity(r.area, warningRule);
        }
      });
    });
  }

  function validateLockedUnique(rows) {
    const locked = rows.filter((r) => r.locked && r.typicalRt != null);
    const seen = new Set();
    for (const r of locked) {
      const k = String(r.typicalRt);
      if (seen.has(k)) return '锁定峰的典型保留时间不可重复';
      seen.add(k);
    }
    return '';
  }

  window.ChromDriftSpectrumCalc = {
    MOCK_PEAKS,
    parseUploadFile,
    inferHeadFromFileName,
    runCalculation,
    validateLockedUnique,
    checkExcessImpurity,
  };
})();
