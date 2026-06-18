/**
 * 色谱漂移 Demo · DeepSeek 客户端（独立代理，默认 8788）
 */
(function () {
  const PROXY_PORT = 8788;

  const AI_CONFIG = {
    proxyPort: PROXY_PORT,
    proxyHealthUrl: `http://127.0.0.1:${PROXY_PORT}/health`,
    proxyChatUrl: `http://127.0.0.1:${PROXY_PORT}/chat`,
    preferProxy: true,
    envPath: '03-Demo原型/scripts/ai-assistant/.env',
  };

  async function checkHealth() {
    if (!AI_CONFIG.preferProxy) {
      return { ok: false, mode: 'mock', hint: '已关闭代理优先' };
    }
    try {
      const res = await fetch(AI_CONFIG.proxyHealthUrl, { method: 'GET' });
      if (!res.ok) {
        return { ok: false, mode: 'mock', hint: `代理响应异常 (${res.status})` };
      }
      const data = await res.json();
      if (!data.hasApiKey) {
        return {
          ok: false,
          mode: 'mock',
          hint: `未配置 Key：请在 ${AI_CONFIG.envPath} 创建 .env 后重启代理（端口 ${PROXY_PORT}）`,
        };
      }
      return { ok: true, mode: 'proxy', data };
    } catch {
      return {
        ok: false,
        mode: 'mock',
        hint: `无法连接 127.0.0.1:${PROXY_PORT}。请运行 ChromDrift_Demo.sh 或在本项目 scripts/ai-assistant 启动代理`,
      };
    }
  }

  async function chat(userText, history, context) {
    const res = await fetch(AI_CONFIG.proxyChatUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: userText,
        history: history || [],
        context: context || {},
        stream: false,
        useTools: true,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = data.error?.message || data.error || res.statusText || '请求失败';
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }
    return data;
  }

  window.ChromDriftDeepSeekClient = {
    AI_CONFIG,
    PROXY_PORT,
    checkHealth,
    chat,
  };
})();
