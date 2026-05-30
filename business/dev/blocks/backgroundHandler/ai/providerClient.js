const PROVIDER_CAPABILITIES = {
  openrouter: {
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  openai: {
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
  gemini: {
    supportsJsonMode: true,
    supportsSystemPrompt: true,
  },
};

const DEFAULT_BASE_URLS = {
  openrouter: 'https://openrouter.ai/api/v1/chat/completions',
  openai: 'https://api.openai.com/v1/chat/completions',
};

const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';

function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function withTimeout(timeoutMs = 45000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  return {
    signal: controller.signal,
    clear: () => clearTimeout(timeout),
  };
}

function normalizeContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((item) => (typeof item === 'string' ? item : item?.text || ''))
      .join('\n');
  }

  return '';
}

function maskSecrets(value = '') {
  return String(value)
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[REDACTED_API_KEY]')
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
}

function parseProviderError(status, bodyText = '') {
  const text = String(bodyText || '');

  if (status === 401 || status === 403) {
    return { type: 'auth', retryable: false, message: 'Authentication failed' };
  }
  if (status === 429) {
    return {
      type: 'rate_limit',
      retryable: true,
      message: 'Rate limit reached',
    };
  }
  if (status >= 500) {
    return {
      type: 'provider_unavailable',
      retryable: true,
      message: 'Provider is unavailable',
    };
  }

  return {
    type: 'provider_error',
    retryable: false,
    message: text || `Provider request failed (${status})`,
  };
}

function toGeminiContents(messages = []) {
  return messages.map((message) => ({
    role: message.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }));
}

function getToken(workflowSettings, provider, blockData = {}) {
  const providerSettings = workflowSettings?.aiProviderCredentials || {};

  switch (provider) {
    case 'openrouter':
      return (
        blockData.openrouterApiKey ||
        providerSettings.openrouterApiKey ||
        workflowSettings.openrouterApiKey ||
        ''
      );
    case 'openai':
      return (
        blockData.openaiApiKey ||
        providerSettings.openaiApiKey ||
        workflowSettings.openaiApiKey ||
        ''
      );
    case 'gemini':
      return (
        blockData.geminiApiKey ||
        providerSettings.geminiApiKey ||
        workflowSettings.geminiApiKey ||
        ''
      );
    default:
      return '';
  }
}

function toChatCompletionBody({
  messages,
  model,
  temperature,
  maxTokens,
  responseFormat,
}) {
  const body = {
    model,
    messages,
    temperature,
    max_tokens: maxTokens,
  };

  if (responseFormat) body.response_format = responseFormat;

  return body;
}

function getOpenAICompatibleUrl(provider, workflowSettings = {}) {
  if (provider === 'openrouter') {
    return workflowSettings?.aiProviderCredentials?.openrouterBaseUrl
      ? `${workflowSettings.aiProviderCredentials.openrouterBaseUrl.replace(
          /\/$/,
          ''
        )}/chat/completions`
      : DEFAULT_BASE_URLS.openrouter;
  }

  return workflowSettings?.aiProviderCredentials?.openaiBaseUrl
    ? `${workflowSettings.aiProviderCredentials.openaiBaseUrl.replace(
        /\/$/,
        ''
      )}/chat/completions`
    : DEFAULT_BASE_URLS.openai;
}

async function callOpenAICompatible({
  provider,
  apiKey,
  workflowSettings,
  payload,
  timeoutMs,
}) {
  const url = getOpenAICompatibleUrl(provider, workflowSettings);
  const timer = withTimeout(timeoutMs);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(payload),
      signal: timer.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      const parsed = parseProviderError(response.status, text);
      const error = new Error(parsed.message);
      error.category = parsed.type;
      error.retryable = parsed.retryable;
      error.providerStatus = response.status;
      throw error;
    }

    const data = JSON.parse(text || '{}');
    const output = normalizeContent(data?.choices?.[0]?.message?.content);

    return {
      output: maskSecrets(output),
      usage: data?.usage || null,
    };
  } finally {
    timer.clear();
  }
}

async function callGemini({
  apiKey,
  model,
  messages,
  temperature,
  maxTokens,
  responseFormat,
  timeoutMs,
}) {
  const url =
    `${GEMINI_BASE_URL}/${encodeURIComponent(model)}` +
    `:generateContent?key=${encodeURIComponent(apiKey)}`;
  const timer = withTimeout(timeoutMs);
  const body = {
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature,
      maxOutputTokens: maxTokens,
    },
  };

  if (responseFormat?.type === 'json_object') {
    body.generationConfig.responseMimeType = 'application/json';
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: timer.signal,
    });

    const text = await response.text();
    if (!response.ok) {
      const parsed = parseProviderError(response.status, text);
      const error = new Error(parsed.message);
      error.category = parsed.type;
      error.retryable = parsed.retryable;
      error.providerStatus = response.status;
      throw error;
    }

    const data = JSON.parse(text || '{}');
    const parts = data?.candidates?.[0]?.content?.parts || [];
    const output = parts.map((part) => part?.text || '').join('\n');

    return {
      output: maskSecrets(output),
      usage: data?.usageMetadata || null,
    };
  } finally {
    timer.clear();
  }
}

export async function invokeProviderModel({
  provider,
  workflowSettings,
  blockData,
  messages,
  model,
  temperature = 0.2,
  maxTokens = 900,
  timeoutMs = 45000,
  retries = 1,
  responseFormat = null,
}) {
  const apiKey = getToken(workflowSettings, provider, blockData);
  if (!apiKey) {
    const error = new Error(`${provider} API key is not configured`);
    error.category = 'auth';
    throw error;
  }

  const capability = PROVIDER_CAPABILITIES[provider];
  if (!capability) {
    const error = new Error(`Unsupported provider: ${provider}`);
    error.category = 'validation';
    throw error;
  }

  const payload = toChatCompletionBody({
    messages,
    model,
    temperature,
    maxTokens,
    responseFormat: capability.supportsJsonMode ? responseFormat : null,
  });

  let lastError = null;
  const maxAttempt = Math.max(0, Number(retries || 0)) + 1;

  for (let attempt = 1; attempt <= maxAttempt; attempt += 1) {
    try {
      if (provider === 'gemini') {
        const result = await callGemini({
          apiKey,
          model,
          messages,
          temperature,
          maxTokens,
          responseFormat,
          timeoutMs,
        });

        return { ...result, provider, capability };
      }

      const result = await callOpenAICompatible({
        provider,
        apiKey,
        workflowSettings,
        payload,
        timeoutMs,
      });

      return { ...result, provider, capability };
    } catch (error) {
      lastError = error;
      const retryable = error?.retryable || error?.name === 'AbortError';
      const canRetry = retryable && attempt < maxAttempt;
      if (!canRetry) break;

      // Exponential backoff with a small bounded delay.
      const backoffMs = Math.min(3000, 400 * 2 ** (attempt - 1));
      // eslint-disable-next-line no-await-in-loop
      await delay(backoffMs);
    }
  }

  if (lastError?.name === 'AbortError') {
    const timeoutError = new Error('Provider request timed out');
    timeoutError.category = 'timeout';
    throw timeoutError;
  }

  throw lastError || new Error('Unknown provider request error');
}

export function getProviderCapabilities(provider) {
  return (
    PROVIDER_CAPABILITIES[provider] || {
      supportsJsonMode: false,
      supportsSystemPrompt: false,
    }
  );
}
