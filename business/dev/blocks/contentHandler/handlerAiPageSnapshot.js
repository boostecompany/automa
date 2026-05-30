function normalizeWhitespace(value = '') {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim();
}

function getSelector(element) {
  if (!element) return '';
  if (element.id) return `#${CSS.escape(element.id)}`;
  if (element.name) {
    return `${element.tagName.toLowerCase()}[name="${CSS.escape(
      element.name
    )}"]`;
  }

  const parts = [];
  let current = element;
  let depth = 0;
  while (current && depth < 4 && current.nodeType === Node.ELEMENT_NODE) {
    const node = current;
    const tag = node.tagName.toLowerCase();
    const parent = node.parentElement;
    if (!parent) {
      parts.unshift(tag);
      break;
    }

    const siblings = Array.from(parent.children).filter(
      (item) => item.tagName === node.tagName
    );
    const index = siblings.indexOf(node);
    const nth = siblings.length > 1 ? `:nth-of-type(${index + 1})` : '';
    parts.unshift(`${tag}${nth}`);
    current = parent;
    depth += 1;
  }

  return parts.join(' > ');
}

function getElementLabel(element) {
  if (!element) return '';
  if (element.labels?.length) {
    return normalizeWhitespace(element.labels[0].innerText || '');
  }

  const labelByFor = element.id
    ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)
    : null;
  if (labelByFor) return normalizeWhitespace(labelByFor.innerText || '');

  const closestLabel = element.closest('label');
  return closestLabel ? normalizeWhitespace(closestLabel.innerText || '') : '';
}

function mapFormFields() {
  const fields = Array.from(
    document.querySelectorAll('input, textarea, select, button[type="submit"]')
  );

  return fields.slice(0, 80).map((field) => ({
    selector: getSelector(field),
    label: getElementLabel(field),
    name: field.getAttribute('name') || '',
    id: field.getAttribute('id') || '',
    type: field.getAttribute('type') || field.tagName.toLowerCase(),
    placeholder: field.getAttribute('placeholder') || '',
    value: field.value || '',
  }));
}

function aiPageSnapshot(block) {
  const maxTextLength = Math.max(
    100,
    Number(block?.data?.maxTextLength || 5000)
  );
  const includeForms = Boolean(block?.data?.includeForms);
  const bodyText = normalizeWhitespace(document.body?.innerText || '').slice(
    0,
    maxTextLength
  );

  return {
    url: window.location.href,
    title: document.title || '',
    text: bodyText,
    forms: includeForms ? mapFormFields() : [],
    timestamp: Date.now(),
  };
}

export default aiPageSnapshot;
