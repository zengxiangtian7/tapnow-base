
import type { ModelConfig } from "./types";

// 检测是否在开发环境中
const isDev = typeof window !== 'undefined' && 
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

// 使用 CORS 代理包装 URL（仅开发环境）
const wrapWithCorsProxy = (targetUrl: string): string => {
    if (!isDev) return targetUrl;
    // 如果已经是相对路径或者是本地地址，不需要代理
    if (targetUrl.startsWith('/') || 
        targetUrl.includes('localhost') || 
        targetUrl.includes('127.0.0.1')) {
        return targetUrl;
    }
    return `/cors-proxy?url=${encodeURIComponent(targetUrl)}`;
};

export const constructUrl = (baseUrl: string, endpointPath: string) => {
    let base = baseUrl ? baseUrl.replace(/\/$/, '') : '';
    let path = endpointPath.replace(/^\//, '');

    if (base.endsWith('/v1') && path.startsWith('v1/')) {
        path = path.substring(3);
    }
    if (!base) return `/${path}`;
    return `${base}/${path}`;
};

export const fetchThirdParty = async (url: string, method: string, body: any, config: ModelConfig, options: { timeout?: number, retries?: number, isFormData?: boolean } = {}) => {
  const { timeout = 60000, retries = 0, isFormData = false } = options;
  
  // 保存原始 URL 用于日志
  const originalUrl = url;
  
  // 自动升级协议：HTTPS 页面下强制将 HTTP 请求升级为 HTTPS
  if (typeof window !== 'undefined' && window.location.protocol === 'https:' && url.startsWith('http://')) {
      console.warn('[Network] Mixed Content Security: Auto-upgrading HTTP URL to HTTPS');
      url = url.replace(/^http:\/\//i, 'https://');
  }
  
  // 开发环境下使用 CORS 代理
  url = wrapWithCorsProxy(url);
  
  if (isDev && url !== originalUrl) {
      console.log('[Network] Using CORS proxy for:', originalUrl);
  }

  console.log('[Network] Fetching URL:', url);
  console.log('[Network] Method:', method);
  console.log('[Network] Has body:', !!body);
  
  if (!config.key) {
      throw new Error("API Key missing. Please configure it in settings.");
  }

  // Masked key logging for debugging
  const maskedKey = config.key.length > 8 
      ? `${config.key.substring(0, 4)}...${config.key.substring(config.key.length - 4)} (Length: ${config.key.length})`
      : '***';
  console.log(`[Network] Using API Key: ${maskedKey}`);

  const headers: any = {};
  // 兼容 Gemini 原生格式 (x-goog-api-key) 和 OpenAI (Authorization)
  // 如果是原生 Gemini 路径，通常使用 query param key=API_KEY 或 header x-goog-api-key
  // 但对于中转商，Authorization: Bearer 通常也是支持的。
  // 为了稳妥，如果检测到是原生路径，我们尝试同时加上 x-goog-api-key
  if (url.includes('generateContent')) {
       // 如果是原生 Gemini，使用 query param key=API_KEY
       const separator = url.includes('?') ? '&' : '?';
       // 注意：这里需要修改 url 变量，但它是 const 参数，我们需要一个新的变量
       // 由于 fetchThirdParty 的参数设计，我们不能直接改 url，只能在 fetch 时处理
       // 但考虑到兼容性，很多中转商其实并不支持 x-goog-api-key，而是只认 url query 中的 key
       
       // 为了支持修改 url，我们需要在下面 fetch 之前处理，或者现在就 hack 一下
       // 最好的方式是如果检测到是 generateContent，就把 key 拼接到 url 上
       if (!url.includes('key=')) {
            url = `${url}${separator}key=${config.key}`;
       }
       
       // 同时保留 header 以防万一，但 Authorization 有些中转商可能会校验冲突，
       // 如果是原生格式，最好只用 key param 或 x-goog-api-key。
       // 根据 Google 文档，原生是用 key param。
       // 根据 NewAPI 文档截图，它是 POST /.../generateContent，并且 Authorization: Bearer <token>
       // 所以我们保留 Authorization。
       
       headers['x-goog-api-key'] = config.key;
       headers['Authorization'] = `Bearer ${config.key}`;
  } else if (url.includes('api.poe.com')) {
       // Poe API 可能需要使用 query parameter 传递 API key
       const separator = url.includes('?') ? '&' : '?';
       if (!url.includes('poe_api_key=') && !url.includes('key=')) {
            url = `${url}${separator}poe_api_key=${config.key}`;
       }
       headers['Authorization'] = `Bearer ${config.key}`;
  } else {
       headers['Authorization'] = `Bearer ${config.key}`;
  }
  
  console.log('[Network] Headers:', headers);
  console.log('[Network] Final URL:', url);
  
  if (!isFormData && method.toUpperCase() !== 'GET') {
      headers['Content-Type'] = 'application/json';
  }
  
  let lastError: any = new Error("Request failed");

  for (let attempt = 0; attempt <= retries; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions: any = {
        method,
        headers,
        signal: controller.signal,
        credentials: 'omit',
      };
      
      if (body) {
          fetchOptions.body = isFormData ? body : JSON.stringify(body);
      }

      try {
          const response = await fetch(url, fetchOptions);
          clearTimeout(timeoutId);

          if (!response.ok) {
            const errText = await response.text();
            let errMsg = errText;
            try {
                const jsonErr = JSON.parse(errText);
                if (jsonErr.error && jsonErr.error.message) {
                    errMsg = jsonErr.error.message;
                } else if (jsonErr.message) {
                    errMsg = jsonErr.message;
                } else if (jsonErr.fail_reason) {
                    errMsg = jsonErr.fail_reason;
                }
            } catch (e) {}
            const error: any = new Error(`API Error ${response.status}: ${errMsg}`);
            if (response.status >= 400 && response.status < 500 && response.status !== 429 && response.status !== 408) {
                error.isNonRetryable = true;
            }
            throw error;
          }

          const text = await response.text();
          try {
              if (!text) return {}; 
              return JSON.parse(text);
          } catch (e) {
              const preview = text.slice(0, 200);
              if (preview.trim().startsWith('<')) {
                  throw new Error(`Server returned HTML instead of JSON. Check your Base URL and Endpoint. Preview: ${preview}...`);
              }
              throw new Error(`Received invalid JSON response from server. Content: ${preview}...`);
          }
      } catch (error: any) {
          clearTimeout(timeoutId);
          lastError = error;
          if (error.name === 'AbortError') lastError = new Error(`Request timed out after ${timeout/1000}s`);
          
          // 增强错误提示：Mixed Content / CORS
          if (error.message === 'Failed to fetch' || error.name === 'TypeError') {
               const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
               const isTargetHttp = url.startsWith('http://');
               if (isHttps && isTargetHttp) {
                   lastError = new Error(`浏览器安全限制：无法在 HTTPS 网站中请求 HTTP 接口 (${url})。请使用 HTTPS API 地址。`);
               } else {
                   lastError = new Error(`网络请求失败 (CORS 或网络问题)。请检查 API 地址是否允许跨域访问，或尝试使用 HTTPS。`);
               }
          }

          if (attempt === retries || error.isNonRetryable) throw lastError;
          await new Promise(res => setTimeout(res, 1000 * (attempt + 1)));
      }
  }
  throw lastError;
};

export const extractUrlFromContent = (content: string): string => {
    if (!content) return '';
    const mdMatch = content.match(/!\[.*?\]\((.*?)\)/);
    if (mdMatch && mdMatch[1]) return mdMatch[1];
    const dataUrlMatch = content.match(/data:image\/[a-zA-Z]+;base64,[^"'\s)]+/);
    if (dataUrlMatch) return dataUrlMatch[0];
    const httpMatch = content.match(/https?:\/\/[^\s)"]+/);
    if (httpMatch) return httpMatch[0];
    return content.trim();
};
