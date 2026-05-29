import secrets from 'secrets';

const BASE_URL = secrets.apApiUrl;

/** Default per-request timeout in milliseconds. */
export const DEFAULT_REQUEST_TIMEOUT = 30000;

/**
 * Performs a fetch request against the AI Power API with a shared timeout,
 * authorization header and consistent error handling.
 * @param {string} url - The fully qualified request URL.
 * @param {object} options - Fetch options (method, headers, body, signal...).
 * @param {string} token - The authorization token.
 * @param {object} [config] - Extra config.
 * @param {number} [config.timeout] - Abort the request after this many ms.
 * @param {string} [config.errorLabel] - Label used in error logs.
 * @returns {Promise<object>} The parsed JSON response.
 */
const apiRequest = async (
  url,
  options,
  token,
  { timeout = DEFAULT_REQUEST_TIMEOUT, errorLabel = 'AI Power request' } = {}
) => {
  const controller = new AbortController();
  const timer =
    timeout > 0 ? setTimeout(() => controller.abort(), timeout) : null;

  // Chain an externally provided signal so callers can cancel the request too.
  if (options.signal) {
    if (options.signal.aborted) controller.abort();
    else
      options.signal.addEventListener('abort', () => controller.abort(), {
        once: true,
      });
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        ...options.headers,
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorData = await response.text().catch(() => '');
      console.error(`${errorLabel} failed:`, {
        status: response.status,
        data: errorData,
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error(`${errorLabel} timed out after ${timeout}ms`);
    }
    throw error;
  } finally {
    if (timer) clearTimeout(timer);
  }
};

/**
 * @typedef {object} AIWorkflowInputOutput
 * @property {string} label - The display name of the node.
 * @property {string} name - The parameter name for the runtime API call.
 * @property {'TEXT'|'IMAGE'|'FILE'|'VIDEO'|'AUDIO'} type - The parameter type.
 * @property {string} [accept] - The acceptable file types (comma-separated).
 * @property {number} [maxSize] - The maximum file size in MB.
 */

/**
 * @typedef {object} AIWorkflowDetail
 * @property {string} flowUuid - The UUID of the AI workflow.
 * @property {string} name - The name of the AI workflow.
 * @property {AIWorkflowInputOutput[]} inputs - The array of input nodes.
 * @property {AIWorkflowInputOutput[]} output - The array of output nodes.
 */

/**
 * @typedef {object} APIDetailResponse
 * @property {number} code - Business status code (200 for success).
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} msg - Failure message.
 * @property {AIWorkflowDetail} data - The entity data.
 * @property {string} requestId - The request ID.
 */

/**
 * Fetches the details of an AI Power workflow.
 * @param {string} flowUuid - The UUID of the AI workflow.
 * @param {string} token - The authorization token.
 * @returns {Promise<APIDetailResponse>} The API response containing the workflow details.
 */
export const getAPWorkflowDetail = async (flowUuid, token) => {
  const url = new URL(`${BASE_URL}/oapi/power/v1/flow/detail`);
  url.searchParams.append('flowUuid', flowUuid);

  return apiRequest(
    url.toString(),
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
    token,
    { errorLabel: 'Fetch AI Power detail' }
  );
};

/**
 * @typedef {object} AIWorkflowListItem
 * @property {string} flowUuid - The UUID of the AI workflow.
 * @property {string} name - The name of the AI workflow.
 */

/**
 * @typedef {object} PaginationInfo
 * @property {number} total - Total number of records.
 * @property {number} size - Number of records per page.
 * @property {number} pages - Total number of pages.
 */

/**
 * @typedef {object} APIListResponse
 * @property {number} code - Business status code (200 for success).
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} msg - Failure message.
 * @property {AIWorkflowListItem[]} data - The list of AI workflows.
 * @property {PaginationInfo} page - Pagination information.
 * @property {string} requestId - The request ID.
 */

/**
 * @typedef {object} GetAPFlowListParams
 * @property {number} page - The page number.
 * @property {number} size - The number of items per page.
 * @property {string} [name] - The name to search for (fuzzy search).
 */

/**
 * Fetches a paginated list of AI Power workflows.
 * @param {GetAPFlowListParams} params - The pagination and search parameters.
 * @param {string} token - The authorization token.
 * @returns {Promise<APIListResponse>} The API response containing the list of workflows.
 */
export const getAPFlowList = async (params, token) => {
  const { page, size, name } = params;
  const url = new URL(`${BASE_URL}/oapi/power/v1/flow/page`);
  url.searchParams.append('page', String(page));
  url.searchParams.append('size', String(size));
  if (name) {
    url.searchParams.append('name', name);
  }

  return apiRequest(
    url.toString(),
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
    },
    token,
    { errorLabel: 'Fetch AI Power flow list' }
  );
};

/**
 * @typedef {object} AIWorkflowStatus
 * @property {'pending'|'success'|'failed'} status - The execution status.
 * @property {object} result - The execution result as a JSON object.
 * @property {string} [failReason] - The reason for failure.
 */

/**
 * @typedef {object} APIStatusResponse
 * @property {number} code - Business status code (200 for success).
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} msg - Failure message.
 * @property {AIWorkflowStatus} data - The status data.
 * @property {string} requestId - The request ID.
 */

/**
 * Fetches the execution status of an AI Power workflow.
 * @param {number | string} runRecordId - The run record ID of the AI workflow.
 * @param {string} token - The authorization token.
 * @returns {Promise<APIStatusResponse>} The API response containing the execution status.
 */
export const getAPFlowStatus = async (runRecordId, token, options = {}) => {
  const url = new URL(`${BASE_URL}/oapi/power/v1/rest/flow/execute/result`);
  url.searchParams.append('runRecordId', String(runRecordId));

  return apiRequest(
    url.toString(),
    {
      method: 'GET',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      signal: options.signal,
    },
    token,
    { errorLabel: 'Fetch AI Power flow status' }
  );
};

/**
 * Polls an AI Power workflow run until it succeeds, fails or times out.
 * @param {number|string} runRecordId - The run record ID to poll.
 * @param {string} token - The authorization token.
 * @param {object} [config] - Polling configuration.
 * @param {number} [config.interval] - Delay between polls in ms.
 * @param {number} [config.timeout] - Give up after this many ms.
 * @param {AbortSignal} [config.signal] - Optional cancellation signal.
 * @returns {Promise<AIWorkflowStatus>} The terminal status data.
 */
export const pollAPFlowResult = async (
  runRecordId,
  token,
  { interval = 3000, timeout = 300000, signal } = {}
) => {
  const deadline = Date.now() + timeout;

  for (;;) {
    if (signal?.aborted) throw new Error('AI workflow polling was cancelled');

    const res = await getAPFlowStatus(runRecordId, token, { signal });
    if (!res.success) {
      throw new Error(res.msg || 'Failed to fetch AI workflow status');
    }

    const { status, failReason } = res.data || {};
    if (status === 'success') return res.data;
    if (status === 'failed') {
      throw new Error(failReason || 'AI workflow execution failed');
    }

    if (Date.now() + interval >= deadline) {
      throw new Error(`AI workflow timed out after ${timeout}ms`);
    }
    await new Promise((resolve) => {
      setTimeout(resolve, interval);
    });
  }
};

/**
 * @typedef {object} AIWorkflowExecuteResult
 * @property {number} runRecordId - The ID of the workflow run record.
 * @property {object} result - The output node data as a JSON object.
 */

/**
 * @typedef {object} APIExecuteResponse
 * @property {number} code - Business status code (200 for success).
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} msg - Failure message.
 * @property {AIWorkflowExecuteResult} data - The execution result data.
 * @property {string} requestId - The request ID.
 */

/**
 * @typedef {object} PostRunAPWorkflowParams
 * @property {string} flowUuid - The UUID of the AI workflow.
 * @property {object} input - The input parameters for the AI workflow.
 */

/**
 * Executes an AI Power workflow synchronously.
 * @param {PostRunAPWorkflowParams} params - The parameters for executing the workflow.
 * @param {string} token - The authorization token.
 * @returns {Promise<APIExecuteResponse>} The API response containing the execution result.
 */
export const postRunAPWorkflow = async (
  { flowUuid, input },
  token,
  options = {}
) => {
  const url = `${BASE_URL}/oapi/power/v1/rest/flow/${flowUuid}/execute`;

  return apiRequest(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ input, source: 'automa_extension' }),
      signal: options.signal,
    },
    token,
    {
      errorLabel: 'Execute AI Power workflow',
      timeout: options.timeout ?? DEFAULT_REQUEST_TIMEOUT,
    }
  );
};

/**
 * @typedef {object} FileUploadResult
 * @property {string} fileReadUrl - The URL of the uploaded file.
 */

/**
 * @typedef {object} APIUploadResponse
 * @property {number} code - Business status code (200 for success).
 * @property {boolean} success - Indicates if the request was successful.
 * @property {string} msg - Failure message.
 * @property {FileUploadResult} data - The result of the file upload.
 * @property {string} requestId - The request ID.
 */

/**
 * Uploads a file to the AI Power server.
 * The request is sent as `multipart/form-data`.
 * @param {File} file - The file object to upload.
 * @param {string} token - The authorization token.
 * @returns {Promise<APIUploadResponse>} The API response containing the upload result.
 */
export const postUploadFile = async (file, token, options = {}) => {
  const url = `${BASE_URL}/oapi/power/v1/file/upload`;

  const formData = new FormData();
  formData.append('file', file);

  return apiRequest(
    url,
    { method: 'POST', body: formData, signal: options.signal },
    token,
    {
      errorLabel: 'Upload file',
      // Uploads can be large; allow a longer window than standard requests.
      timeout: options.timeout ?? 120000,
    }
  );
};
