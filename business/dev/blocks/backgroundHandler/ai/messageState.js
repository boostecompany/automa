function safeText(value) {
  return String(value || '')
    .replace(/sk-[A-Za-z0-9_-]{10,}/g, '[REDACTED_API_KEY]')
    .replace(/AIza[A-Za-z0-9_-]{20,}/g, '[REDACTED_API_KEY]')
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, 'Bearer [REDACTED]');
}

function estimateSize(messages = []) {
  return messages.reduce(
    (total, message) => total + String(message?.content || '').length + 16,
    0
  );
}

export function createMessageState({ systemPrompt = '', maxChars = 24000 } = {}) {
  const messages = [];
  if (systemPrompt) {
    messages.push({ role: 'system', content: safeText(systemPrompt) });
  }

  return {
    add(role, content) {
      messages.push({ role, content: safeText(content) });
    },
    getMessages() {
      if (estimateSize(messages) <= maxChars) return [...messages];

      const systemMessage = messages[0]?.role === 'system' ? messages[0] : null;
      const body = systemMessage ? messages.slice(1) : [...messages];
      const trimmed = [];
      let size = estimateSize(systemMessage ? [systemMessage] : []);

      for (let i = body.length - 1; i >= 0; i -= 1) {
        const candidate = body[i];
        const nextSize = size + String(candidate.content || '').length + 16;
        if (nextSize > maxChars) break;

        trimmed.unshift(candidate);
        size = nextSize;
      }

      return systemMessage ? [systemMessage, ...trimmed] : trimmed;
    },
  };
}
