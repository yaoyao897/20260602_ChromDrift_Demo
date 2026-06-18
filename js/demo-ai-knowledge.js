/**
 * 全局 AI 助理 · 备注/字段规格知识包（供 DeepSeek 与 Mock 检索）
 */
(function () {
  const PAGE_LABELS = {
    'drift-rule': '漂移规则设置',
    'warning-rule': '偏差预警设置',
    recognition: '图谱识别',
    'ledger-gc': 'GC 数据台账',
    'ledger-lc': 'LC 数据台账',
    'ledger-compare-gc': 'GC 数据比对',
    'ledger-compare-lc': 'LC 数据比对',
  };

  const PAGE_FORM_KEYS = {
    'drift-rule': ['driftRule'],
    'warning-rule': ['warningRule'],
    recognition: ['recognition'],
    'ledger-gc': ['ledgerCategory'],
    'ledger-lc': ['ledgerCategory'],
    'ledger-compare-gc': ['ledgerSummary'],
    'ledger-compare-lc': ['ledgerSummary'],
  };

  function formatRemarksBlock(pageId, remarks, { detailed } = { detailed: false }) {
    const lines = [`### ${remarks.title || PAGE_LABELS[pageId] || pageId}`];
    if (remarks.dataSource?.length) {
      lines.push('数据源：');
      const src = detailed ? remarks.dataSource : remarks.dataSource.slice(0, 3);
      src.forEach((s) => lines.push(`- ${s}`));
      if (!detailed && remarks.dataSource.length > 3) {
        lines.push(`- …共 ${remarks.dataSource.length} 条`);
      }
    }
    if (detailed && remarks.actions?.length) {
      lines.push('按钮/交互：');
      remarks.actions.forEach((act) => {
        lines.push(`- ${act.title}：${(act.points || []).join(' ')}`);
      });
    }
    return lines.join('\n');
  }

  function formatFlowBlock(flow) {
    if (!flow) return '';
    const lines = [`### ${flow.title} · 流程要点`];
    (flow.summary || []).forEach((s) => lines.push(`- ${s}`));
    (flow.sections || []).forEach((sec) => {
      lines.push(`- ${sec.title}：${(sec.points || []).join(' ')}`);
    });
    return lines.join('\n');
  }

  function formatFieldSpecs(formKeys, { detailed } = { detailed: false }) {
    const FR = window.ChromDriftFormFieldRemarks;
    if (!FR) return '';
    const lines = [];
    (formKeys || []).forEach((formKey) => {
      const labels = FR.PAGE_FORM_FIELD_LABELS?.[formKey] || {};
      const keys = Object.keys(labels);
      const useKeys = detailed ? keys : keys.slice(0, 24);
      useKeys.forEach((fieldKey) => {
        const label = FR.fieldRemarkLabel(formKey, fieldKey);
        const points = FR.fieldRemark(formKey, fieldKey);
        if (!points.length) return;
        lines.push(`- ${label}：${points.join('；')}`);
      });
      if (!detailed && keys.length > useKeys.length) {
        lines.push(`- …${formKey} 另有 ${keys.length - useKeys.length} 个字段规格`);
      }
    });
    return lines.length ? `字段规格：\n${lines.join('\n')}` : '';
  }

  function buildGlobalChatContext({ currentPage, ledgerTab } = {}) {
    const remarksApi = window.ChromDriftRemarks;
    const pageId = currentPage || 'drift-rule';
    const parts = [
      `当前菜单：${PAGE_LABELS[pageId] || pageId}`,
      ledgerTab ? `当前 Tab：${ledgerTab}` : '',
      '',
      '【当前页 · 详细】',
      formatRemarksBlock(pageId, remarksApi.getPageRemarks(pageId), { detailed: true }),
      formatFlowBlock(remarksApi.getPageFlow(pageId)),
      formatFieldSpecs(PAGE_FORM_KEYS[pageId], { detailed: true }),
      '',
      '【其他模块 · 摘要】',
    ];

    Object.keys(remarksApi.PAGE_REMARKS || {}).forEach((pid) => {
      if (pid === pageId) return;
      parts.push(formatRemarksBlock(pid, remarksApi.getPageRemarks(pid), { detailed: false }));
    });

    parts.push('');
    parts.push('【跨模块字段规格索引】');
    ['driftRule', 'warningRule', 'recognition', 'ledgerCategory', 'ledgerSummary'].forEach((fk) => {
      if ((PAGE_FORM_KEYS[pageId] || []).includes(fk)) return;
      const block = formatFieldSpecs([fk], { detailed: false });
      if (block) parts.push(block);
    });

    return {
      assistant: 'global',
      currentPage: pageId,
      currentPageLabel: PAGE_LABELS[pageId] || pageId,
      ledgerTab: ledgerTab || '',
      knowledgePack: parts.filter(Boolean).join('\n').slice(0, 28000),
    };
  }

  function tokenizeQuery(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[？?，,。；;：:\s]+/g, ' ')
      .split(' ')
      .filter((t) => t.length >= 2);
  }

  function scoreLine(line, tokens) {
    const low = line.toLowerCase();
    let score = 0;
    tokens.forEach((t) => {
      if (low.includes(t)) score += t.length >= 4 ? 3 : 1;
    });
    return score;
  }

  function replyMock(userText, ctx) {
    const t = (userText || '').trim();
    if (!t) return { content: '请输入问题，例如：规则名称字段取值来源？图谱识别列表数据从哪来？' };

    const pageId = ctx.currentPage || 'recognition';
    const remarksApi = window.ChromDriftRemarks;

    if (/当前页.*数据源|列表.*数据.*来源|^数据源$|数据从哪来|数据从哪儿来/.test(t)) {
      const remarks = remarksApi?.getPageRemarks(pageId);
      const lines = (remarks?.dataSource || []).map((d) => `· ${d}`);
      return {
        content: [
          `【${ctx.currentPageLabel || pageId} · 列表/页面数据来源】`,
          '',
          lines.length ? lines.join('\n') : '（备注中暂无数据源说明）',
          '',
          '字段级取值请继续问具体字段名，例如「规则名称怎么取值」。',
        ].join('\n'),
      };
    }

    if (/字段.*来源|取值来源|怎么取值|从哪来/.test(t) && pageId) {
      const formKeys = PAGE_FORM_KEYS[pageId] || [];
      const specBlock = formatFieldSpecs(formKeys, { detailed: true });
      if (specBlock) {
        return {
          content: `【${ctx.currentPageLabel} · 字段取值规格】\n\n${specBlock}`,
        };
      }
    }

    const tokens = tokenizeQuery(t);
    const hits = [];

    const pushHits = (text, source) => {
      text.split('\n').forEach((line) => {
        const s = scoreLine(line, tokens);
        if (s > 0) hits.push({ line: line.trim(), source, score: s });
      });
    };

    pushHits(ctx.knowledgePack || '', '逻辑备注');

    const FR = window.ChromDriftFormFieldRemarks;
    if (FR) {
      Object.keys(FR.PAGE_FORM_FIELD_LABELS || {}).forEach((formKey) => {
        Object.keys(FR.PAGE_FORM_FIELD_LABELS[formKey]).forEach((fieldKey) => {
          const label = FR.fieldRemarkLabel(formKey, fieldKey);
          const points = FR.fieldRemark(formKey, fieldKey);
          const block = `${label}：${points.join('；')}`;
          if (tokens.some((tok) => label.includes(tok) || block.toLowerCase().includes(tok))) {
            hits.push({ line: block, source: `字段规格·${formKey}`, score: 5 });
          }
        });
      });
    }

    hits.sort((a, b) => b.score - a.score);
    const top = hits.slice(0, 8);

    if (/DeepSeek|代理|8788|连接/.test(t)) {
      return {
        content: `全局助理优先连接本项目 DeepSeek 代理（127.0.0.1:${ChromDriftDeepSeekClient?.PROXY_PORT || 8788}）。\n请运行 ChromDrift_Demo.sh 或配置 scripts/ai-assistant/.env 后点「重连」。\n离线时将基于 Demo 内嵌逻辑备注回答。`,
      };
    }

    if (!top.length) {
      return {
        content: `未在备注库中命中「${t}」。\n可尝试：① 开启备注模式对照字段说明 ② 提问具体字段名或列表名 ③ 说明当前所在菜单页。\n\n当前上下文：${ctx.currentPageLabel || '—'}`,
      };
    }

    const lines = [
      `【${ctx.currentPageLabel || '色谱漂移'} · 备注检索】`,
      '',
      ...top.map((h) => `· ${h.line}${h.source ? ` （${h.source}）` : ''}`),
    ];
    if (/数据来源|列表.*来源|从哪来|localStorage|种子/.test(t)) {
      lines.push('', '提示：Demo 列表多来自 localStorage（chrom-drift-demo-v1: 前缀）+ 种子脚本，详见各模块「数据源」条目。');
    }
    return { content: lines.join('\n') };
  }

  window.ChromDriftAiKnowledge = {
    PAGE_LABELS,
    PAGE_FORM_KEYS,
    buildGlobalChatContext,
    replyMock,
  };
})();
