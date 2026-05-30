import renderString from '@/workflowEngine/templating/renderString';
import {
  executeRegistryAction,
  getActionPromptContract,
} from './ai/actionRegistry';
import { createMessageState } from './ai/messageState';
import { invokeProviderModel } from './ai/providerClient';

function parseActionPayload(text = '') {
  const raw = String(text || '').trim();
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch (error) {
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return null;

    try {
      return JSON.parse(match[0]);
    } catch (secondError) {
      return null;
    }
  }
}

function formatSnapshot(snapshot = {}) {
  return [
    `url: ${snapshot.url || ''}`,
    `title: ${snapshot.title || ''}`,
    '',
    'visible text:',
    snapshot.text || '',
    '',
    'forms:',
    ...(snapshot.forms || []).map(
      (item, index) =>
        `${index + 1}. selector=${item.selector || ''}, label=${
          item.label || ''
        }, type=${item.type || ''}`
    ),
  ].join('\n');
}

function addStepLog(worker, block, stepRecord) {
  try {
    worker.engine.addLogHistory({
      name: block.label,
      blockId: block.id,
      workerId: worker.id,
      type: stepRecord.success ? 'success' : 'error',
      timestamp: Date.now(),
      description:
        `step ${stepRecord.step}: ${stepRecord.action?.type || 'unknown'} ` +
        `(${stepRecord.success ? 'ok' : 'fail'})`,
      activeTabUrl: worker.activeTab?.url,
      prevBlockData: worker.engine.referenceData?.prevBlockData,
      ctxData: {
        aiStep: stepRecord,
      },
    });
  } catch (error) {
    // Keep execution resilient when optional logging fails.
    console.error(error);
  }
}

async function autonomousAi(block, { refData }) {
  const { data } = block;
  const nextBlockId = this.getBlockConnections(block.id);

  if (!data.experimentalEnabled) {
    return {
      nextBlockId,
      data: {
        finalAnswer: null,
        steps: [],
        status: 'feature_disabled',
        error: {
          category: 'feature_flag',
          message:
            'Experimental AI nodes are disabled for this block. Enable it in block settings.',
        },
      },
    };
  }

  try {
    const renderedGoal = await renderString(
      data.goal || '',
      refData,
      this.engine.isPopup
    );
    const renderedSystem = await renderString(
      data.systemPrompt || '',
      refData,
      this.engine.isPopup
    );

    const state = createMessageState({
      systemPrompt:
        renderedSystem.value ||
        [
          'You are an autonomous browser agent.',
          'Choose one safe, minimal next action at a time.',
          'Never output markdown.',
          getActionPromptContract(),
        ].join('\n\n'),
      maxChars: Number(data.maxHistoryChars || 24000),
    });

    state.add(
      'user',
      [
        `Goal: ${renderedGoal.value || ''}`,
        'Respect step and failure limits.',
        getActionPromptContract(),
      ].join('\n')
    );

    const maxSteps = Math.max(1, Number(data.maxSteps || 8));
    const maxFailures = Math.max(0, Number(data.maxFailures || 3));
    const stepRecords = [];
    let failureCount = 0;
    let lastResult = null;
    let finalAnswer = '';
    let status = 'completed';
    let lastErrorPayload = null;

    for (let step = 1; step <= maxSteps; step += 1) {
      let snapshot = null;
      if (data.usePageContext) {
        // eslint-disable-next-line no-await-in-loop
        snapshot = await this._sendMessageToTab({
          label: 'ai-page-snapshot',
          name: 'ai-page-snapshot',
          data: {
            maxTextLength: Number(data.maxPageTextLength || 5000),
            includeForms: true,
          },
        });
      }

      const userMessage = [
        `Step ${step}/${maxSteps}`,
        snapshot ? formatSnapshot(snapshot) : 'No page snapshot requested.',
        lastResult ? `Last action result: ${JSON.stringify(lastResult)}` : '',
        getActionPromptContract(),
      ]
        .filter(Boolean)
        .join('\n\n');
      state.add('user', userMessage);

      // eslint-disable-next-line no-await-in-loop
      const modelResponse = await invokeProviderModel({
        provider: data.provider,
        workflowSettings: this.engine.workflow.settings || {},
        blockData: data,
        messages: state.getMessages(),
        model: data.model,
        temperature: Number(data.temperature || 0.1),
        maxTokens: Number(data.maxTokens || 900),
        timeoutMs: Number(data.timeoutMs || 45000),
        retries: Number(data.retries || 0),
        responseFormat: { type: 'json_object' },
      });

      const parsedAction = parseActionPayload(modelResponse.output);
      if (!parsedAction) {
        const fallbackAction = {
          type: 'finish',
          finalAnswer: modelResponse.output,
          reason: 'Model returned non-JSON response',
        };
        const stepRecord = {
          step,
          success: true,
          action: fallbackAction,
          result: fallbackAction.finalAnswer,
        };
        stepRecords.push(stepRecord);
        addStepLog(this, block, stepRecord);
        finalAnswer = fallbackAction.finalAnswer;
        status = 'completed';
        break;
      }

      let actionResult = null;
      let success = true;
      let done = false;
      let stepError = null;

      try {
        // eslint-disable-next-line no-await-in-loop
        actionResult = await executeRegistryAction(this, parsedAction);
        done = Boolean(actionResult?.done);
      } catch (error) {
        success = false;
        stepError = {
          category: error.category || 'action_error',
          message: error.message,
        };
        failureCount += 1;
      }

      const stepRecord = {
        step,
        success,
        action: parsedAction,
        result: actionResult?.data ?? null,
        error: stepError,
        usage: modelResponse.usage || null,
      };
      stepRecords.push(stepRecord);
      addStepLog(this, block, stepRecord);

      lastResult = stepRecord.result || stepRecord.error;
      state.add(
        'assistant',
        JSON.stringify({
          action: parsedAction,
          result: stepRecord.result,
          error: stepError,
        })
      );

      if (!success && failureCount > maxFailures) {
        status = 'max_failures_reached';
        lastErrorPayload = stepError;
        break;
      }

      if (parsedAction.type === 'finish' || done) {
        finalAnswer = parsedAction.finalAnswer || actionResult?.data || '';
        status = 'completed';
        break;
      }

      if (step === maxSteps) {
        status = 'max_steps_reached';
      }
    }

    const output = {
      finalAnswer,
      steps: stepRecords,
      status,
      error: lastErrorPayload,
    };

    if (data.assignVariable && data.variableName) {
      this.setVariable(data.variableName, output);
    }

    if (data.saveData && data.dataColumn) {
      this.addDataToColumn(data.dataColumn, output);
    }

    return {
      nextBlockId,
      data: output,
    };
  } catch (error) {
    if (data.stopOnError) throw error;

    return {
      nextBlockId,
      data: {
        finalAnswer: null,
        steps: [],
        status: 'failed',
        error: {
          category: error.category || 'runtime',
          message: error.message,
        },
      },
    };
  }
}

export default autonomousAi;
