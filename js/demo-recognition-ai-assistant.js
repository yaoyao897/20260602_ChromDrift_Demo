/**
 * 图谱识别 · AI 助理（异常解读 + 锁定/重算建议）
 * list：列表旁（可选）；calc：新增/复核弹窗 · 计算明细旁
 */
(function () {
  const { ref, computed, watch, nextTick } = Vue;

  const ABNORMAL_HELP = {
    未匹配到:
      '相对保留时间换算后，在台账典型 RT 列中未找到 M 值落在理论偏差范围内的有效匹配；该峰已标为新杂，对应典型保留时间为空。',
    重复匹配:
      '多个未标定峰匹配到相同典型 RT，系统无法唯一归属，已标为新杂（典型 RT 不置空，待人工判定）。',
    顺序异常:
      '该峰典型 RT 小于前序序号任一台账典型 RT，属于「新增列」类顺序异常；新杂峰对应典型 RT 置空，台账滚动扩列时列头取图谱 RT。',
  };

  function abnormalRows(details) {
    return (details || []).filter((d) => d.abnormalNote && d.abnormalNote !== '/');
  }

  function buildExceptionReport(record, mode) {
    if (!record || !(record.details || []).length) {
      return {
        content: mode === 'calc'
          ? '请先点击「计算」或「重新计算」生成色谱识别明细，我再结合当前表格解读异常。'
          : '请先在左侧列表点击一行记录，我再结合该批色谱明细解读异常。',
      };
    }
    const details = record.details || [];
    const rows = abnormalRows(details);
    if (!rows.length) {
      return {
        content: `【${record.sampleName}】明细中异常说明均为「/」，计算链路正常。\n\n若需复核，仍可在新增页上传同批谱图重新计算比对。`,
      };
    }
    const lines = [
      `【${record.sampleName}】共 ${rows.length} 个异常峰：`,
      '',
    ];
    rows.forEach((d) => {
      const hint = ABNORMAL_HELP[d.abnormalNote] || '请结合漂移规则偏差范围与台账典型矩阵人工判断。';
      lines.push(`峰 ${d.peakNo} · RT ${d.rt} · ${d.componentName || '未命名'}`);
      lines.push(`异常：${d.abnormalNote}`);
      lines.push(`说明：${hint}`);
      if (d.isNewImpurity) lines.push('状态：已标为新杂');
      if (d.isExcessImpurity === '是') lines.push('预警：超标新杂（峰面积超 UCL/LCL）');
      lines.push('');
    });
    if (record.hasNewImpurity === '是') {
      lines.push('记录级：存在新杂；保存后已写入台账批号行新杂信息。');
    }
    return { content: lines.join('\n').trim() };
  }

  function buildLockRecalcAdvice(record, mode) {
    if (!record || !(record.details || []).length) {
      return {
        content: mode === 'calc'
          ? '请先完成计算，再向我索取锁定/重算建议。'
          : '请先选择列表中的一条图谱识别记录。',
        actions: [],
      };
    }
    const details = record.details || [];
    const abnormal = abnormalRows(details);
    if (!abnormal.length) {
      return {
        content: '当前批次无异常峰，一般无需锁定重算。若手工改过相对保留时间，可对确认无误的峰锁定典型 RT 后再点「重新计算」。',
        actions: [],
      };
    }

    const locks = details
      .filter((d) => !d.isNewImpurity && d.typicalRt != null && d.typicalRt !== '')
      .map((d) => ({
        peakNo: d.peakNo,
        typicalRt: Number(d.typicalRt),
        componentName: d.componentName || `峰${d.peakNo}`,
      }));

    const lines = [
      `【锁定 / 重算建议】${record.sampleName}`,
      '',
      '操作顺序（与客户计算逻辑一致）：',
      '1. 对已确认的典型 RT 锁定（锁定行重算时不重新推导 RRT）',
      '2. 点击「重新计算」，待决峰（▲/⬛️）将多轮迭代',
      '3. 核查异常说明后保存',
      '',
    ];

    abnormal.forEach((d) => {
      lines.push(`• 峰 ${d.peakNo}：${d.abnormalNote}`);
      if (d.abnormalNote === '顺序异常') {
        lines.push('  → 建议确认主峰与已定性峰锁定正确后重算；新杂峰无法填写对应典型 RT。');
      } else if (d.abnormalNote === '未匹配到') {
        lines.push('  → 可尝试锁定相邻已匹配峰作为参考，或检查台账典型 RT 是否缺失。');
      } else if (d.abnormalNote === '重复匹配') {
        lines.push('  → 建议人工锁定其中一组归属，其余峰标新杂后重算。');
      }
    });

    if (locks.length) {
      lines.push('');
      lines.push(`建议保持锁定 ${locks.length} 个已有效匹配峰：`);
      locks.forEach((l) => {
        lines.push(`  峰 ${l.peakNo} → 典型 RT ${l.typicalRt}`);
      });
    }

    const actions = locks.length
      ? [
          {
            type: 'applyLocks',
            id: `lock-${record.id || record.batchNo || 'calc'}`,
            summary: mode === 'calc'
              ? '采纳建议：在下方明细表应用锁定（可再点「重新计算」）'
              : '采纳建议：打开复核页并应用锁定，再执行重新计算',
            locks,
            recordId: record.id,
          },
        ]
      : [];

    return { content: lines.join('\n').trim(), actions: mapAdviceActions(actions, mode) };
  }

  function mapAdviceActions(actions, mode) {
    if (mode !== 'list') return actions || [];
    return (actions || []).map((a) => (
      a.type === 'applyLocks' ? { ...a, type: 'openRecheck' } : a
    ));
  }

  function buildPreSaveCheck(record) {
    if (!record) {
      return { content: '请先选择一条记录。' };
    }
    const details = record.details || [];
    const newRows = details.filter((d) => d.isNewImpurity);
    const excess = details.filter((d) => d.isExcessImpurity === '是');
    const badTypical = newRows.filter((d) => d.typicalRt != null && d.typicalRt !== '');
    const lines = [`【保存前检查】${record.sampleName}`, ''];

    if (badTypical.length) {
      lines.push(`✗ 有 ${badTypical.length} 个新杂峰仍填写了典型 RT，保存将校验失败。`);
    } else {
      lines.push('✓ 新杂峰对应典型保留时间均为空。');
    }
    lines.push(`新杂峰：${newRows.length} 个；超标新杂：${excess.length} 个。`);
    if (record.ruleName) lines.push(`漂移规则：${record.ruleName}`);
    if (record.warningRuleName) lines.push(`预警规则：${record.warningRuleName}`);
    if (newRows.length && excess.length) {
      lines.push('');
      lines.push('提示：存在超标新杂时，建议 QA 复核后再入库。');
    }
    return { content: lines.join('\n') };
  }

  function buildChatContext(record) {
    if (!record) {
      return { assistant: 'recognition', toolProfile: 'chromDriftRecognition', pageTitle: '图谱识别', record: {}, details: [] };
    }
    return {
      assistant: 'recognition',
      toolProfile: 'chromDriftRecognition',
      pageTitle: '图谱识别',
      record: {
        sampleName: record.sampleName,
        batchNo: record.batchNo,
        ledgerType: record.ledgerType,
        applyType: record.applyType,
        materialInfo: record.materialInfo,
        qcpPoint: record.qcpPoint,
        ruleName: record.ruleName,
        warningRuleName: record.warningRuleName,
        hasNewImpurity: record.hasNewImpurity,
        hasExcessImpurity: record.hasExcessImpurity,
        fileName: record.fileName,
      },
      details: (record.details || []).map((d) => ({
        peakNo: d.peakNo,
        rt: d.rt,
        area: d.area,
        componentName: d.componentName,
        isMainPeak: d.isMainPeak,
        rrt: d.rrt,
        typicalRt: d.typicalRt,
        locked: d.locked,
        abnormalNote: d.abnormalNote,
        deviationRange: d.deviationRange,
        isNewImpurity: d.isNewImpurity,
        isExcessImpurity: d.isExcessImpurity,
      })),
    };
  }

  function convertProxyActions(actions) {
    const out = [];
    (actions || []).forEach((a, i) => {
      if (a.type === 'openRecheck' && a.locks?.length) {
        out.push({
          type: 'applyLocks',
          id: `proxy-${Date.now()}-${i}`,
          summary: a.summary || '采纳建议：应用锁定到明细表',
          locks: a.locks,
        });
      }
    });
    return out;
  }

  function isBusinessMetaQuestion(text) {
    return /数据源|数据来源|列表.*来源|字段.*来源|取值|从哪来|localStorage|种子|备注|联动|当前页/.test(text || '');
  }

  function replyMock(userText, record, mode) {
    const t = (userText || '').trim();
    if (!t) return { content: '请输入问题，或点击下方快捷提问。' };

    if (isBusinessMetaQuestion(t) && window.ChromDriftAiKnowledge) {
      return ChromDriftAiKnowledge.replyMock(
        t,
        ChromDriftAiKnowledge.buildGlobalChatContext({ currentPage: 'recognition' }),
      );
    }

    if (/解读|异常|说明|什么意思/.test(t)) {
      if (!(record?.details || []).length) {
        return {
          content: '当前尚无计算明细。请先上传谱图并点击「计算」，再让我解读异常说明；若问列表数据来源或字段取值，请直接说明（例如「列表数据从哪来」）。',
        };
      }
      return buildExceptionReport(record, mode);
    }
    if (/锁定|重算|重新计算|建议/.test(t)) {
      const r = buildLockRecalcAdvice(record, mode);
      return { ...r, actions: mapAdviceActions(r.actions, mode) };
    }
    if (/保存|检查|校验/.test(t)) return buildPreSaveCheck(record);

    if (/M值|M 值|偏差/.test(t)) {
      return {
        content:
          'M = T就近 − T相对。T相对由相对保留时间匹配得到，T就近为台账典型 RT 列中就近值；M 须在漂移规则理论偏差范围内匹配才有效。',
      };
    }
    if (/新杂/.test(t)) {
      return {
        content:
          '标为新杂后，明细「对应典型保留时间」必须置空。滚动扩列时台账动态列头取该峰的图谱保留时间（非典型 RT）。',
      };
    }

    return {
      content: mode === 'calc'
        ? '我可以帮您：① 解读当前明细异常说明 ② 给出锁定与重算建议 ③ 保存前检查。计算完成后直接提问即可。'
        : '我可以帮您：① 解读异常说明 ② 给出锁定与重算建议 ③ 保存前检查。请选中左侧列表记录后提问，或使用下方快捷按钮。',
    };
  }

  const DemoRecognitionAiAssistant = {
    name: 'DemoRecognitionAiAssistant',
    props: {
      record: { type: Object, default: null },
      /** list：列表旁；calc：新增/复核弹窗 · 计算明细旁 */
      mode: { type: String, default: 'list' },
    },
    emits: ['open-recheck', 'apply-locks'],
    template: `
      <aside
        class="recog-ai-panel"
        :class="{ 'recog-ai-panel--calc': mode === 'calc' }"
        aria-label="图谱识别 AI 助理"
      >
        <div class="recog-ai-panel__header">
          <div class="recog-ai-panel__title-row">
            <span class="recog-ai-panel__title">{{ mode === 'calc' ? '✨ AI 计算助理' : '✨ 异常解读助理' }}</span>
            <el-button link type="primary" size="small" @click="reconnectProxy">重连</el-button>
          </div>
          <div class="recog-ai-panel__status" :class="'is-' + aiMode">{{ aiStatusText }}</div>
          <div class="recog-ai-panel__context">{{ contextLabel }}</div>
        </div>
        <div ref="listRef" class="recog-ai-panel__messages">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="recog-ai-msg"
            :class="msg.role"
          >
            <div class="recog-ai-bubble">{{ msg.content }}</div>
            <div v-if="msg.actions?.length" class="recog-ai-action-card">
              <div v-for="act in msg.actions" :key="act.id" class="recog-ai-action-item">
                <div class="recog-ai-action-summary">{{ act.summary }}</div>
                <el-button
                  v-if="act.type === 'openRecheck'"
                  type="primary"
                  size="small"
                  @click="onOpenRecheck(act)"
                >打开复核并应用锁定</el-button>
                <el-button
                  v-else-if="act.type === 'applyLocks'"
                  type="primary"
                  size="small"
                  @click="onApplyLocks(act)"
                >应用锁定到明细表</el-button>
              </div>
            </div>
          </div>
          <div v-if="loading" class="recog-ai-loading">{{ loadingText }}</div>
        </div>
        <div class="recog-ai-panel__quick">
          <el-button
            v-for="q in quickPrompts"
            :key="q"
            size="small"
            @click="sendQuick(q)"
          >{{ q }}</el-button>
        </div>
        <div class="recog-ai-panel__input">
          <el-input
            v-model="input"
            type="textarea"
            :rows="2"
            placeholder="例：解读当前批次异常；给出锁定重算建议"
            @keydown="onKeydown"
          />
          <el-button type="primary" size="small" :loading="loading" @click="send">发送</el-button>
        </div>
      </aside>
    `,
    setup(props, { emit }) {
      const { ElMessage } = ElementPlus;
      const listRef = ref(null);
      const input = ref('');
      const loading = ref(false);
      const messages = ref([]);
      const aiMode = ref('mock');
      const aiConnectHint = ref('');

      const quickPrompts = ['解读异常', '锁定重算建议', '保存前检查'];

      const loadingText = computed(() => (
        aiMode.value === 'proxy' ? '正在调用 DeepSeek…' : '正在分析…'
      ));

      const aiStatusText = computed(() => {
        if (aiMode.value === 'proxy') {
          return `DeepSeek 已连接（本项目代理 :${ChromDriftDeepSeekClient.PROXY_PORT}）`;
        }
        return aiConnectHint.value || `离线 Mock（启动本项目代理 :${ChromDriftDeepSeekClient?.PROXY_PORT || 8788} 后点重连）`;
      });

      const contextLabel = computed(() => {
        const r = props.record;
        if (props.mode === 'calc') {
          if (!r?.sampleName) return '填写头信息并计算后，助手将读取当前明细';
          const n = (r.details || []).length;
          const tag = r.hasNewImpurity === '是' ? ' · 含新杂' : '';
          return n
            ? `${r.sampleName} / 批号 ${r.batchNo} · 已计算 ${n} 行${tag}`
            : `${r.sampleName} / 批号 ${r.batchNo} · 待计算`;
        }
        if (!r) return '未选中记录 · 请点击左侧列表行';
        const tag = r.hasNewImpurity === '是' ? ' · 含新杂' : '';
        return `${r.sampleName} / 批号 ${r.batchNo}${tag}`;
      });

      function scrollBottom() {
        nextTick(() => {
          const el = listRef.value;
          if (el) el.scrollTop = el.scrollHeight;
        });
      }

      function pushMsg(role, content, actions) {
        messages.value.push({
          id: `${Date.now()}-${Math.random()}`,
          role,
          content,
          actions: actions || [],
        });
        scrollBottom();
      }

      function initWelcome() {
        const port = ChromDriftDeepSeekClient?.PROXY_PORT || 8788;
        let intro;
        if (props.mode === 'calc') {
          intro = aiMode.value === 'proxy'
            ? `计算助理已连接（端口 ${port}）。上传谱图并点击「计算」后，可解读异常说明、建议锁定哪些峰，并一键应用到下方明细表。`
            : `计算助理（Mock）。完成计算后可提问；启动代理（端口 ${port}）后点「重连」可切换 DeepSeek。`;
        } else {
          intro = aiMode.value === 'proxy'
            ? `我是图谱识别助理，已连接本项目 DeepSeek 代理（端口 ${port}）。可解读异常、给出锁定/重算建议。`
            : `我是图谱识别助理。请配置 scripts/ai-assistant/.env 并启动代理（端口 ${port}），或运行 ChromDrift_Demo.sh 后点「重连」。\n\n请先在左侧列表点击一条记录，再提问或使用快捷按钮。`;
        }
        messages.value = [{ id: 'welcome', role: 'assistant', content: intro, actions: [] }];
      }

      async function checkAiProxyHealth() {
        if (!window.ChromDriftDeepSeekClient) {
          aiMode.value = 'mock';
          aiConnectHint.value = '未加载 DeepSeek 客户端脚本';
          return;
        }
        const r = await ChromDriftDeepSeekClient.checkHealth();
        aiMode.value = r.mode;
        aiConnectHint.value = r.ok ? '' : (r.hint || '');
      }

      async function reconnectProxy() {
        await checkAiProxyHealth();
        initWelcome();
        ElMessage.success(aiMode.value === 'proxy' ? '已连接 DeepSeek' : (aiConnectHint.value || '仍使用 Mock'));
      }

      function historyBeforeSend() {
        return messages.value
          .filter((m) => m.role === 'user' || m.role === 'assistant')
          .filter((m) => m.id !== 'welcome')
          .slice(-10)
          .map((m) => ({ role: m.role, content: m.content }));
      }

      async function dispatch(userText) {
        const text = (userText || '').trim();
        if (!text || loading.value) return;
        const history = historyBeforeSend();
        pushMsg('user', text);
        input.value = '';
        loading.value = true;
        scrollBottom();

        const mock = replyMock(text, props.record, props.mode);

        if (isBusinessMetaQuestion(text) && window.ChromDriftAiKnowledge) {
          const gCtx = ChromDriftAiKnowledge.buildGlobalChatContext({ currentPage: 'recognition' });
          const metaMock = ChromDriftAiKnowledge.replyMock(text, gCtx);
          try {
            if (aiMode.value === 'proxy' && window.ChromDriftDeepSeekClient) {
              const data = await ChromDriftDeepSeekClient.chat(text, history, gCtx, {
                useTools: false,
                assistant: 'global',
              });
              loading.value = false;
              let reply = (data.reply || '').replace(/\*\*/g, '');
              if (!reply?.trim()) reply = metaMock.content;
              pushMsg('assistant', reply || metaMock.content);
              return;
            }
          } catch (err) {
            loading.value = false;
            aiMode.value = 'mock';
            aiConnectHint.value = err.message;
            pushMsg('assistant', `${metaMock.content}\n\n（DeepSeek：${err.message}）`);
            return;
          }
          loading.value = false;
          pushMsg('assistant', metaMock.content);
          return;
        }

        try {
          if (aiMode.value === 'proxy' && window.ChromDriftDeepSeekClient) {
            const data = await ChromDriftDeepSeekClient.chat(
              text,
              history,
              buildChatContext(props.record),
              { useTools: true, assistant: 'recognition' },
            );
            loading.value = false;
            let actions = convertProxyActions(data.actions, props.record);
            actions = mapAdviceActions(actions, props.mode);
            if (!actions.length && mock.actions?.length) actions = mock.actions;
            let reply = (data.reply || '').replace(/\*\*/g, '');
            if (!reply?.trim()) reply = mock.content;
            pushMsg('assistant', reply || '已完成。', actions);
            return;
          }
        } catch (err) {
          loading.value = false;
          aiMode.value = 'mock';
          aiConnectHint.value = err.message;
          const fallbackActions = mock.actions || [];
          let content = `DeepSeek 调用失败：${err.message}`;
          if (mock.content) content += `\n\n—— 离线建议 ——\n${mock.content}`;
          pushMsg('assistant', content, fallbackActions);
          ElMessage.warning('DeepSeek 不可用，已回退 Mock');
          return;
        }

        await new Promise((r) => setTimeout(r, 350));
        loading.value = false;
        pushMsg('assistant', mock.content, mock.actions);
      }

      function send() {
        dispatch(input.value);
      }

      function sendQuick(q) {
        dispatch(q);
      }

      function onKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      }

      function onApplyLocks(act) {
        if (!act.locks?.length) return;
        emit('apply-locks', { locks: act.locks });
        ElMessage.success('已应用锁定建议，可点击「重新计算」');
      }

      function onOpenRecheck(act) {
        if (!props.record) return;
        emit('open-recheck', { record: props.record, locks: act.locks || [] });
      }

      watch(
        () => props.record?.id,
        (id, prev) => {
          if (props.mode !== 'list' || !id || id === prev) return;
          pushMsg(
            'assistant',
            `已切换上下文：${props.record.sampleName}（${props.record.batchNo}）。需要我解读异常或给出重算建议吗？`,
          );
        },
      );

      watch(
        () => (props.mode === 'calc' ? (props.record?.details || []).length : 0),
        (n, prev) => {
          if (props.mode !== 'calc' || n <= 0 || n === prev) return;
          pushMsg('assistant', `计算完成，共 ${n} 行明细。需要解读异常或锁定建议吗？`);
        },
      );

      checkAiProxyHealth().then(() => initWelcome());

      return {
        mode: computed(() => props.mode),
        listRef,
        input,
        loading,
        loadingText,
        messages,
        quickPrompts,
        contextLabel,
        aiMode,
        aiStatusText,
        reconnectProxy,
        send,
        sendQuick,
        onKeydown,
        onOpenRecheck,
        onApplyLocks,
      };
    },
  };

  window.ChromDriftRecognitionAiAssistant = DemoRecognitionAiAssistant;
  window.ChromDriftRecognitionAiLogic = {
    buildExceptionReport,
    buildLockRecalcAdvice,
    buildPreSaveCheck,
    buildChatContext,
    convertProxyActions,
    replyMock,
  };
})();
