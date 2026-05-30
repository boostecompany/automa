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
      class="mb-2 w-full"
      @change="updateData({ model: $event })"
    />
    <p class="mb-2 text-xs text-gray-500">
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

    <ui-input
      :model-value="data.maxSteps"
      label="Max step budget"
      type="number"
      class="mb-2 w-full"
      @change="updateData({ maxSteps: Number($event) })"
    />
    <ui-input
      :model-value="data.maxFailures"
      label="Max failure budget"
      type="number"
      class="mb-2 w-full"
      @change="updateData({ maxFailures: Number($event) })"
    />
    <ui-input
      :model-value="data.maxHistoryChars"
      label="Max prompt history chars"
      type="number"
      class="mb-2 w-full"
      @change="updateData({ maxHistoryChars: Number($event) })"
    />

    <ui-textarea
      :model-value="data.systemPrompt"
      label="System prompt"
      rows="3"
      class="mb-2 w-full"
      @change="updateData({ systemPrompt: $event })"
    />
    <ui-textarea
      :model-value="data.goal"
      label="Goal / task"
      rows="5"
      class="mb-2 w-full"
      @change="updateData({ goal: $event })"
    />

    <ui-checkbox
      :model-value="data.usePageContext"
      class="mb-2"
      @change="updateData({ usePageContext: $event })"
    >
      Include current page analysis context
    </ui-checkbox>
    <ui-input
      :model-value="data.maxPageTextLength"
      label="Max page text length"
      type="number"
      class="mb-2 w-full"
      @change="updateData({ maxPageTextLength: Number($event) })"
    />

    <p class="mb-2 rounded bg-yellow-50 p-2 text-xs text-yellow-800">
      Autonomous mode uses a constrained action registry: navigate, click, type,
      extract, wait, finish.
    </p>

    <ui-checkbox
      :model-value="data.assignVariable"
      class="mb-2"
      @change="updateData({ assignVariable: $event })"
    >
      Assign run output to variable
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
      Save run output to table column
    </ui-checkbox>
    <ui-input
      v-if="data.saveData"
      :model-value="data.dataColumn"
      label="Column name"
      class="mb-2 w-full"
      @change="updateData({ dataColumn: $event })"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue';

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

const suggestedModels = computed(
  () => MODEL_SUGGESTIONS[props.data.provider] || MODEL_SUGGESTIONS.openrouter
);

function updateData(value) {
  emit('update:data', { ...props.data, ...value });
}

function onProviderChange(provider) {
  const suggested = MODEL_SUGGESTIONS[provider]?.[0] || props.data.model;
  updateData({ provider, model: suggested });
}
</script>
