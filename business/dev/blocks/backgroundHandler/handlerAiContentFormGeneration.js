import renderString from '@/workflowEngine/templating/renderString';
import { invokeProviderModel } from './ai/providerClient';

function parseJson(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  try {
    return JSON.parse(trimmed);
  } catch (error) {
    return null;
  }
}

function validateRequiredKeys(parsed, schemaJson, strictSchema) {
  if (!strictSchema) return;
  if (!schemaJson) return;

  let schema = null;
  try {
    schema = JSON.parse(schemaJson);
  } catch (error) {
    throw new Error('Schema JSON is invalid');
  }

  const required = Array.isArray(schema?.required) ? schema.required : [];
  if (!required.length) return;
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Schema validation failed: output must be an object');
  }

  const missing = required.filter((key) => !(key in parsed));
  if (missing.length) {
    throw new Error(`Schema validation failed: missing keys ${missing.join(', ')}`);
  }
}

function buildContextSection(pageContext, useFormContext) {
  if (!pageContext) return '';

  const sections = [
    `Page URL: ${pageContext.url || ''}`,
    `Page Title: ${pageContext.title || ''}`,
    '',
    'Page text:',
    pageContext.text || '',
  ];

  if (useFormContext) {
    sections.push('', 'Form fields:');
    (pageContext.forms || []).forEach((field, index) => {
      sections.push(
        `${index + 1}. selector=${field.selector || ''}, ` +
          `label=${field.label || ''}, name=${field.name || ''}, ` +
          `type=${field.type || ''}, placeholder=${field.placeholder || ''}`
      );
    });
  }

  return sections.join('\n');
}

async function aiContentFormGeneration(block, { refData }) {
  const { data } = block;
  const nextBlockId = this.getBlockConnections(block.id);

  if (!data.experimentalEnabled) {
    return {
      nextBlockId,
      data: {
        output: null,
        error: {
          category: 'feature_flag',
          message:
            'Experimental AI nodes are disabled for this block. Enable it in block settings.',
        },
      },
    };
  }

  const replacedValue = {};

  try {
    const renderedPrompt = await renderString(data.prompt || '', refData, this.engine.isPopup);
    const renderedSystem = await renderString(
      data.systemPrompt || '',
      refData,
      this.engine.isPopup
    );
    Object.assign(replacedValue, renderedPrompt.list || {}, renderedSystem.list || {});

    let pageContext = null;
    if (data.usePageContext || data.useFormContext) {
      pageContext = await this._sendMessageToTab({
        label: 'ai-page-snapshot',
        name: 'ai-page-snapshot',
        data: {
          maxTextLength: Number(data.maxPageTextLength || 5000),
          includeForms: Boolean(data.useFormContext),
        },
      });
    }

    const userSections = [
      renderedPrompt.value || '',
      buildContextSection(pageContext, data.useFormContext),
    ].filter(Boolean);

    if (data.schemaMode && data.schemaJson) {
      userSections.push(
        `Return JSON only and follow this schema:\n${data.schemaJson}`
      );
    }

    const messages = [];
    if (renderedSystem.value) {
      messages.push({ role: 'system', content: renderedSystem.value });
    }
    messages.push({ role: 'user', content: userSections.join('\n\n') });

    const modelResponse = await invokeProviderModel({
      provider: data.provider,
      workflowSettings: this.engine.workflow.settings || {},
      blockData: data,
      messages,
      model: data.model,
      temperature: Number(data.temperature || 0.2),
      maxTokens: Number(data.maxTokens || 900),
      timeoutMs: Number(data.timeoutMs || 45000),
      retries: Number(data.retries || 0),
      responseFormat: data.schemaMode ? { type: 'json_object' } : null,
    });

    const parsed = parseJson(modelResponse.output);
    if (data.schemaMode) {
      if (!parsed) throw new Error('Model output is not valid JSON');
      validateRequiredKeys(parsed, data.schemaJson, data.strictSchema);
    }

    const output = data.schemaMode ? parsed : modelResponse.output;
    if (data.assignVariable && data.variableName) {
      this.setVariable(data.variableName, output);
    }
    if (data.saveData && data.dataColumn) {
      this.addDataToColumn(data.dataColumn, output);
    }

    return {
      nextBlockId,
      replacedValue,
      data: {
        output,
        rawOutput: modelResponse.output,
        usage: modelResponse.usage,
        provider: data.provider,
        model: data.model,
        pageContext: pageContext
          ? {
              url: pageContext.url,
              title: pageContext.title,
            }
          : null,
        error: null,
      },
    };
  } catch (error) {
    if (data.stopOnError) throw error;

    return {
      nextBlockId,
      replacedValue,
      data: {
        output: null,
        error: {
          category: error.category || 'runtime',
          message: error.message,
        },
      },
    };
  }
}

export default aiContentFormGeneration;
