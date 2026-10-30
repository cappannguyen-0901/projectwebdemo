export const AI_CONFIG = Object.freeze({
  proxyUrl: import.meta.env?.VITE_AI_PROXY_URL || 'https://cappan-proxy.cappannguyen.workers.dev/openai/v1/chat/completions',
  model: import.meta.env?.VITE_AI_MODEL || 'openai/gpt-oss-20b',
  timeoutMs: 12000
});
