import BrowserAPIService from '@/service/browser-api/BrowserAPIService';
import { waitTabLoaded } from '@/workflowEngine/helper';

function validString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalizeAction(action = {}) {
  return {
    type: String(action.type || '').trim(),
    reason: String(action.reason || ''),
    ...action,
  };
}

function validateAction(action = {}) {
  const normalized = normalizeAction(action);

  switch (normalized.type) {
    case 'navigate':
      if (!validString(normalized.url)) {
        throw new Error('navigate action requires a valid "url"');
      }
      break;
    case 'click':
      if (!validString(normalized.selector)) {
        throw new Error('click action requires a valid "selector"');
      }
      break;
    case 'type':
      if (!validString(normalized.selector)) {
        throw new Error('type action requires a valid "selector"');
      }
      break;
    case 'extract':
      if (!validString(normalized.selector)) {
        throw new Error('extract action requires a valid "selector"');
      }
      break;
    case 'wait':
      if (normalized.selector && !validString(normalized.selector)) {
        throw new Error('wait action has an invalid "selector"');
      }
      break;
    case 'finish':
      break;
    default:
      throw new Error(
        `Unsupported action type: ${normalized.type || 'unknown'}`
      );
  }

  return normalized;
}

function buildContentActionPayload(action) {
  return {
    label: 'ai-agent-action',
    name: 'ai-agent-action',
    data: {
      action,
    },
  };
}

export function getActionPromptContract() {
  return [
    'Return ONLY valid JSON with shape:',
    '{',
    '  "type": "navigate|click|type|extract|wait|finish",',
    '  "reason": "why this action is selected",',
    '  "url": "https://example.com",',
    '  "selector": "css selector",',
    '  "text": "text for type action",',
    '  "attribute": "optional attribute for extract",',
    '  "multiple": false,',
    '  "timeoutMs": 1000,',
    '  "finalAnswer": "required when type is finish"',
    '}',
  ].join('\n');
}

export function buildActionRegistry(ctx) {
  return {
    async navigate(action) {
      await BrowserAPIService.tabs.update(ctx.activeTab.id, {
        url: action.url,
      });
      await waitTabLoaded({
        tabId: ctx.activeTab.id,
        ms: Math.max(5000, Number(action.timeoutMs || ctx.timeoutMs || 30000)),
      });

      return {
        success: true,
        data: {
          url: action.url,
        },
      };
    },
    async click(action) {
      const data = await ctx._sendMessageToTab(
        buildContentActionPayload(action)
      );
      return { success: true, data };
    },
    async type(action) {
      const data = await ctx._sendMessageToTab(
        buildContentActionPayload(action)
      );
      return { success: true, data };
    },
    async extract(action) {
      const data = await ctx._sendMessageToTab(
        buildContentActionPayload(action)
      );
      return { success: true, data };
    },
    async wait(action) {
      const data = await ctx._sendMessageToTab(
        buildContentActionPayload(action)
      );
      return { success: true, data };
    },
    async finish(action) {
      return {
        success: true,
        done: true,
        data: action.finalAnswer || '',
      };
    },
  };
}

export async function executeRegistryAction(ctx, action) {
  const validated = validateAction(action);
  const registry = buildActionRegistry(ctx);
  const handler = registry[validated.type];

  if (!handler) {
    throw new Error(`No action executor for "${validated.type}"`);
  }

  return handler(validated);
}
