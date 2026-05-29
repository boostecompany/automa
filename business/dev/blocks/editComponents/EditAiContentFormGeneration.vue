<template>
  <div class="mb-2 mt-4">
    <ui-textarea
      :model-value="data.description"
      placeholder="Block description"
      class="mb-2 w-full"
      @change="updateData({ description: $event })"
    />

    <ui-checkbox
      :model-value="data.experimentalEnabled"
      class="mb-2"
      @change="updateData({ experimentalEnabled: $event })"
    >
      Enable experimental AI node
    </ui-checkbox>

    <ui-checkbox
      :model-value="data.stopOnError"
      class="mb-2"
      @change="updateData({ stopOnError: $event })"
    >
      Stop workflow on AI error
    </ui-checkbox>

    <ui-select
      :model-value="data.provider"
      label="Provider"
      class="mb-2 w-full"
      @change="onProviderChange"
    >
      <option value="openrouter">OpenRouter</option>
      <option value="openai">ChatGPT (OpenAI)</option>
      <option value="gemini">Gemini</option>
    </ui-select>

    <ui-input
      :model-value="data.model"
      label="Model"
      placeholder="Model name"
      class="mb-2 w-full"
      @change="updateData({ model: $event })"
    />
    <p class="mb-3 text-xs text-gray-500">
      Suggested models: {{ suggestedModels.join(', ') }}
    </p>

    <ui-input
      :model-value="data.temperature"
      label="Temperature"
      type="number"
      class="mb-2 w-full"
      @change="updateData({ temperature: Number($event) })"
    />
    <ui-input
      :model-value="data.maxTokens"
      label="Max tokens"
      type="number"
      class="mb-2 w-full"
      @change="updateData({ maxTokens: Number($event) })"
    />
    <ui-input
      :model-value="data.timeoutMs"
      label="Timeout (ms)"
      type="number"
      class="mb-2 w-full"
      @change="updateData({ timeoutMs: Number($event) })"
    />
    <ui-input
      :model-value="data.retries"
      label="Retries"
      type="number"
      class="mb-2 w-full"
      @change="updateData({ retries: Number($event) })"
    />

    <ui-textarea
      :model-value="data.systemPrompt"
      label="System prompt"
      rows="3"
      class="mb-2 w-full"
      @change="updateData({ systemPrompt: $event })"
    />
    <ui-textarea
      :model-value="data.prompt"
      label="User prompt"
      rows="5"
      class="mb-2 w-full"
      @change="updateData({ prompt: $event })"
    />

    <ui-checkbox
      :model-value="data.usePageContext"
      class="mb-2"
      @change="updateData({ usePageContext: $event })"
    >
      Include page text context
    </ui-checkbox>
    <ui-checkbox
      :model-value="data.useFormContext"
      class="mb-2"
      @change="updateData({ useFormContext: $event })"
    >
      Include form field context
    </ui-checkbox>
    <ui-input
      :model-value="data.maxPageTextLength"
      label="Max page text length"
      type="number"
      class="mb-2 w-full"
      @change="updateData({ maxPageTextLength: Number($event) })"
    />

    <ui-checkbox
      :model-value="data.schemaMode"
      class="mb-2"
      @change="updateData({ schemaMode: $event })"
    >
      Structured JSON mode
    </ui-checkbox>
    <ui-checkbox
      v-if="data.schemaMode"
      :model-value="data.strictSchema"
      class="mb-2"
      @change="updateData({ strictSchema: $event })"
    >
      Strict required keys validation
    </ui-checkbox>
    <ui-textarea
      v-if="data.schemaMode"
      :model-value="data.schemaJson"
      label="JSON schema (object with required keys)"
      rows="4"
      class="mb-2 w-full"
      @change="updateData({ schemaJson: $event })"
    />

    <ui-checkbox
      :model-value="data.assignVariable"
      class="mb-2"
      @change="updateData({ assignVariable: $event })"
    >
      Assign output to variable
    </ui-checkbox>
    <ui-input
      v-if="data.assignVariable"
      :model-value="data.variableName"
      label="Variable name"
      class="mb-2 w-full"
      @change="updateData({ variableName: $event })"
    />

    <ui-checkbox
      :model-value="data.saveData"
      class="mb-2"
      @change="updateData({ saveData: $event })"
    >
      Save output to table column
    </ui-checkbox>
    <ui-input
      v-if="data.saveData"
      :model-value="data.dataColumn"
      label="Column name"
      class="mb-2 w-full"
      @change="updateData({ dataColumn: $event })"
    />

    <hr />
    <p class="mb-2 text-sm font-semibold">Provider credentials (workflow settings)</p>
    <ui-input
      :model-value="providerCredentials.openrouterApiKey"
      label="OpenRouter API key"
      placeholder="sk-or-..."
      class="mb-2 w-full"
      @change="updateCredential('openrouterApiKey', $event)"
    />
    <ui-input
      :model-value="providerCredentials.openaiApiKey"
      label="OpenAI API key"
      placeholder="sk-..."
      class="mb-2 w-full"
      @change="updateCredential('openaiApiKey', $event)"
    />
    <ui-input
      :model-value="providerCredentials.geminiApiKey"
      label="Gemini API key"
      placeholder="AIza..."
      class="mb-2 w-full"
      @change="updateCredential('geminiApiKey', $event)"
    />
    <ui-input
      :model-value="providerCredentials.openrouterBaseUrl"
      label="OpenRouter base URL override (optional)"
      class="mb-2 w-full"
      @change="updateCredential('openrouterBaseUrl', $event)"
    />
    <ui-input
      :model-value="providerCredentials.openaiBaseUrl"
      label="OpenAI base URL override (optional)"
      class="mb-2 w-full"
      @change="updateCredential('openaiBaseUrl', $event)"
    />

    <p class="text-xs text-gray-500">
      Active credential status: {{ credentialStatus }}
    </p>
  </div>
</template>

<script setup>
import { useWorkflowStore } from '@/stores/workflow';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const MODEL_SUGGESTIONS = {
  openrouter: ['openai/gpt-4o-mini', 'anthropic/claude-3.5-sonnet'],
  openai: ['gpt-4o-mini', 'gpt-4.1-mini'],
  gemini: ['gemini-2.0-flash', 'gemini-1.5-pro'],
};

const props = defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
});
const emit = defineEmits(['update:data']);

const workflowStore = useWorkflowStore();
const { id: workflowId } = useRoute().params;

const currentWorkflow = computed(() => workflowStore.getById(workflowId) || {});
const providerCredentials = computed(
  () => currentWorkflow.value?.settings?.aiProviderCredentials || {}
);

const suggestedModels = computed(
  () => MODEL_SUGGESTIONS[props.data.provider] || MODEL_SUGGESTIONS.openrouter
);

const credentialStatus = computed(() => {
  const provider = props.data.provider;
  if (provider === 'openrouter' && providerCredentials.value.openrouterApiKey) {
    return 'OpenRouter key configured';
  }
  if (provider === 'openai' && providerCredentials.value.openaiApiKey) {
    return 'OpenAI key configured';
  }
  if (provider === 'gemini' && providerCredentials.value.geminiApiKey) {
    return 'Gemini key configured';
  }

  return 'Missing key for selected provider';
});

function updateData(value) {
  emit('update:data', { ...props.data, ...value });
}

function onProviderChange(provider) {
  const suggested = MODEL_SUGGESTIONS[provider]?.[0] || props.data.model;
  updateData({ provider, model: suggested });
}

function updateCredential(key, value) {
  const workflow = currentWorkflow.value;
  const prevSettings = workflow.settings || {};
  const nextCredentials = {
    ...(prevSettings.aiProviderCredentials || {}),
    [key]: value,
  };

  workflowStore.update({
    id: workflowId,
    data: {
      ...workflow,
      settings: {
        ...prevSettings,
        aiProviderCredentials: nextCredentials,
      },
    },
  });
}
</script>
