import { postRunAPWorkflow, pollAPFlowResult } from '@/utils/getAIPoweredInfo';
import renderString from '../templating/renderString';

const isEmptyResult = (result) =>
  result === null ||
  result === undefined ||
  (typeof result === 'object' && Object.keys(result).length === 0);

async function aiWorkflow(block, { refData }) {
  const {
    flowUuid,
    inputs,
    assignVariable,
    variableName,
    saveData,
    dataColumn,
    waitForResult = false,
    timeout = 0,
    pollInterval = 3,
  } = block.data;

  const aipowerToken = this.engine.workflow.settings?.aipowerToken;

  if (!aipowerToken) {
    throw new Error('AI Power token is not set');
  }
  if (!flowUuid) {
    throw new Error('No AI workflow is selected');
  }

  const replacedValueList = {};
  const inputForAPI = {};

  for (const item of inputs) {
    if (typeof item.value === 'object' && item.value !== null) {
      // File/media inputs are objects like { url, filename }. Allow the `url`
      // to reference variables/blocks from earlier in the workflow so an image
      // produced upstream can be fed into the AI workflow.
      if (typeof item.value.url === 'string' && item.value.url.includes('{{')) {
        const rendered = await renderString(
          item.value.url,
          refData,
          this.engine.isPopup
        );
        inputForAPI[item.name] = { ...item.value, url: rendered.value };
        Object.assign(replacedValueList, rendered.list);
      } else {
        inputForAPI[item.name] = item.value;
      }
    } else {
      // For strings, we render them using the templating engine.
      const renderedValue = await renderString(
        item.value,
        refData,
        this.engine.isPopup
      );
      inputForAPI[item.name] = renderedValue.value;
      Object.assign(replacedValueList, renderedValue.list);
    }
  }

  const timeoutMs = Math.max(0, Number(timeout) || 0) * 1000;
  const pollIntervalMs = Math.max(1, Number(pollInterval) || 3) * 1000;

  try {
    const runResponse = await postRunAPWorkflow(
      { flowUuid, input: inputForAPI },
      aipowerToken,
      // In polling mode the execute call returns quickly, so keep a bounded
      // kick-off timeout. Otherwise honor the user timeout (0 = no limit).
      { timeout: waitForResult ? undefined : timeoutMs }
    );
    const { success, msg } = runResponse;

    if (!success) {
      throw new Error(msg || 'AI workflow execution failed');
    }

    let result = runResponse.data?.result;
    const runRecordId = runResponse.data?.runRecordId;

    // Long-running workflows (e.g. image/video generation) may not return a
    // result from the initial call; poll until the run reaches a terminal state.
    if (waitForResult && runRecordId && isEmptyResult(result)) {
      const status = await pollAPFlowResult(runRecordId, aipowerToken, {
        interval: pollIntervalMs,
        timeout: timeoutMs || 300000,
      });
      result = status.result;
    }

    if (assignVariable) {
      this.setVariable(variableName, result);
    }

    if (saveData) {
      this.addDataToColumn(dataColumn, result);
    }

    const nextBlockId = this.getBlockConnections(block.id);

    return {
      data: result,
      nextBlockId,
      replacedValue: replacedValueList,
    };
  } catch (error) {
    console.error('AI workflow execution failed:', error);
    throw new Error(error.message);
  }
}

export default aiWorkflow;
