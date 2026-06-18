/**
 * 全局 AI 助理（右上角）· DeepSeek + 项目逻辑备注问答
 */
(function () {
  const DemoGlobalAiAssistant = {
    name: 'DemoGlobalAiAssistant',
    props: {
      currentPage: { type: String, default: 'drift-rule' },
      ledgerTab: { type: String, default: '' },
    },
    emits: ['close'],
    template: `
      <div class="demo-ai-panel demo-global-ai" role="dialog" aria-label="全局 AI 助理">
        <div class="demo-ai-panel__header">
          <div class="demo-global-ai__title-row">
            <span>✨ AI 助理</span>
            <div class="demo-global-ai__title-actions">
              <el-button link type="primary" size="small" @click="reconnectProxy">重连</el-button>
              <el-button link type="primary" size="small" @click="$emit('close')">关闭</el-button>
            </div>
          </div>
          <div class="demo-global-ai__status" :class="'is-' + aiMode">{{ aiStatusText }}</div>
          <div class="demo-global-ai__context">{{ contextLabel }}</div>
        </div>
        <div ref="listRef" class="demo-global-ai__messages">
          <div
            v-for="msg in messages"
            :key="msg.id"
            class="demo-global-ai__msg"
            :class="msg.role"
          >
            <div class="demo-global-ai__bubble">{{ msg.content }}</div>
          </div>
          <div v-if="loading" class="demo-global-ai__loading">{{ loadingText }}</div>
        </div>
        <div class="demo-global-ai__quick">
          <el-button
            v-for="q in quickPrompts"
            :key="q"
            size="small"
            @click="sendQuick(q)"
          >{{ q }}</el-button>
        </div>
        <div class="demo-global-ai__input">
          <el-input
            v-model="input"
            type="textarea"
            :rows="2"
            placeholder="例：图谱识别列表数据来源？规则名称字段怎么取值？"
            @keydown="onKeydown"
          />
          <el-button type="primary" size="small" :loading="loading" @click="send">发送</el-button>
        </div>
      </div>
    `,
    setup(props) {
      const { ref, computed, watch, nextTick } = Vue;
      const { ElMessage } = ElementPlus;
      const listRef = ref(null);
      const input = ref('');
      const loading = ref(false);
      const messages = ref([]);
      const aiMode = ref('mock');
      const aiConnectHint = ref('');

      const quickPrompts = ['当前页数据源', '字段取值来源', '模块如何联动'];

      const loadingText = computed(() => (
        aiMode.value === 'proxy' ? '正在调用 DeepSeek…' : '正在检索备注…'
      ));

      const chatContext = computed(() => (
        ChromDriftAiKnowledge.buildGlobalChatContext({
          currentPage: props.currentPage,
          ledgerTab: props.ledgerTab,
        })
      ));

      const contextLabel = computed(() => {
        const c = chatContext.value;
        const tab = c.ledgerTab ? ` · ${c.ledgerTab}` : '';
        return `${c.currentPageLabel}${tab}`;
      });

      const aiStatusText = computed(() => {
        if (aiMode.value === 'proxy') {
          return `DeepSeek 已连接（:${ChromDriftDeepSeekClient.PROXY_PORT}）· 基于 Demo 逻辑备注`;
        }
        return aiConnectHint.value || `离线 Mock · 启动代理 :${ChromDriftDeepSeekClient?.PROXY_PORT || 8788} 后点重连`;
      });

      function scrollBottom() {
        nextTick(() => {
          const el = listRef.value;
          if (el) el.scrollTop = el.scrollHeight;
        });
      }

      function pushMsg(role, content) {
        messages.value.push({
          id: `${Date.now()}-${Math.random()}`,
          role,
          content,
        });
        scrollBottom();
      }

      function initWelcome() {
        const port = ChromDriftDeepSeekClient?.PROXY_PORT || 8788;
        const intro = aiMode.value === 'proxy'
          ? `我是色谱漂移全局助理，已连接 DeepSeek（端口 ${port}）。可解答字段取值来源、列表数据来源、按钮交互与模块联动；回答依据 Demo 内嵌逻辑备注与字段规格。`
          : `我是色谱漂移全局助理（Mock）。可提问各模块字段含义与数据来源；配置代理（端口 ${port}）后点「重连」切换 DeepSeek。`;
        messages.value = [{ id: 'welcome', role: 'assistant', content: intro }];
      }

      async function checkAiProxyHealth() {
        if (!window.ChromDriftDeepSeekClient) {
          aiMode.value = 'mock';
          aiConnectHint.value = '未加载 DeepSeek 客户端';
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
        const ctx = chatContext.value;
        pushMsg('user', text);
        input.value = '';
        loading.value = true;
        scrollBottom();

        const mock = ChromDriftAiKnowledge.replyMock(text, ctx);

        try {
          if (aiMode.value === 'proxy' && window.ChromDriftDeepSeekClient) {
            const data = await ChromDriftDeepSeekClient.chat(text, history, ctx, {
              useTools: false,
              assistant: 'global',
            });
            loading.value = false;
            let reply = (data.reply || '').replace(/\*\*/g, '');
            if (!reply?.trim()) reply = mock.content;
            pushMsg('assistant', reply);
            return;
          }
        } catch (err) {
          loading.value = false;
          aiMode.value = 'mock';
          aiConnectHint.value = err.message;
          let content = `DeepSeek 调用失败：${err.message}`;
          if (mock.content) content += `\n\n—— 离线备注 ——\n${mock.content}`;
          pushMsg('assistant', content);
          ElMessage.warning('DeepSeek 不可用，已回退 Mock');
          return;
        }

        await new Promise((r) => setTimeout(r, 280));
        loading.value = false;
        pushMsg('assistant', mock.content);
      }

      function send() { dispatch(input.value); }
      function sendQuick(q) { dispatch(q); }
      function onKeydown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          send();
        }
      }

      watch(
        () => props.currentPage,
        (page, prev) => {
          if (!page || page === prev) return;
          pushMsg('assistant', `已切换至「${ChromDriftAiKnowledge.PAGE_LABELS[page] || page}」。可问本页字段取值或列表数据来源。`);
        },
      );

      checkAiProxyHealth().then(() => initWelcome());

      return {
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
      };
    },
  };

  window.ChromDriftGlobalAiAssistant = DemoGlobalAiAssistant;
})();
