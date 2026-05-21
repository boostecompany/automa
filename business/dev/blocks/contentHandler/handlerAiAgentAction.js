function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withSelector(block, handleSelector, onSelected) {
  return new Promise((resolve, reject) => {
    handleSelector(
      {
        ...block,
        data: {
          findBy: 'cssSelector',
          waitForSelector: true,
          waitSelectorTimeout: Number(block?.data?.action?.timeoutMs || 5000),
          ...block.data,
          selector: block?.data?.action?.selector,
          multiple: Boolean(block?.data?.action?.multiple),
        },
      },
      {
        onSelected,
        onError: reject,
        onSuccess: resolve,
      }
    );
  });
}

async function runExtract(block, handleSelector) {
  const values = [];
  await withSelector(block, handleSelector, async (element) => {
    const action = block.data.action;
    if (action.attribute) {
      values.push(element.getAttribute(action.attribute) || '');
      return;
    }

    values.push((action.includeHtml ? element.outerHTML : element.innerText) || '');
  });

  if (block.data.action.multiple) return values;
  return values[0] ?? '';
}

async function runClick(block, handleSelector) {
  await withSelector(block, handleSelector, async (element) => {
    element.click();
  });

  return true;
}

async function runType(block, handleSelector) {
  await withSelector(block, handleSelector, async (element) => {
    const { action } = block.data;
    if (action.clearValue) {
      element.value = '';
    }

    const text = String(action.text ?? '');
    element.focus?.();
    element.value = text;
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur?.();
  });

  return true;
}

async function runWait(block, handleSelector) {
  const timeoutMs = Number(block?.data?.action?.timeoutMs || 500);
  const selector = block?.data?.action?.selector;

  if (!selector) {
    await sleep(timeoutMs);
    return true;
  }

  await withSelector(block, handleSelector, async () => {});
  return true;
}

async function aiAgentAction(block, { handleSelector }) {
  const action = block?.data?.action || {};
  switch (action.type) {
    case 'click':
      return runClick(block, handleSelector);
    case 'type':
      return runType(block, handleSelector);
    case 'extract':
      return runExtract(block, handleSelector);
    case 'wait':
      return runWait(block, handleSelector);
    default:
      throw new Error(`Unsupported content action: ${action.type || 'unknown'}`);
  }
}

export default aiAgentAction;
