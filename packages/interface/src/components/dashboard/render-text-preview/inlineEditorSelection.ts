// Pure DOM helpers for the contentEditable inline text editor.

// A trailing newline needs a following <br> to own a caret on the empty
// last line; an unnecessary sentinel is removed once text follows it.
export const syncTrailingLineBreak = (node: HTMLElement): void => {
  const last = node.lastChild;
  if ((node.textContent ?? '').endsWith('\n')) {
    if (last?.nodeName !== 'BR') {
      node.appendChild(document.createElement('br'));
    }
    return;
  }
  if (last?.nodeName === 'BR') {
    last.remove();
  }
};

const normalizeInlineEditorSelectionBounds = (
  start: number,
  end: number,
): { start: number; end: number } => {
  const safeStart = Math.max(0, Math.floor(start));
  const safeEnd = Math.max(0, Math.floor(end));
  return safeStart <= safeEnd
    ? { start: safeStart, end: safeEnd }
    : { start: safeEnd, end: safeStart };
};

const resolveContentEditableSelectionPoint = (
  root: HTMLElement,
  targetOffset: number,
): { node: Node; offset: number } => {
  const safeOffset = Math.max(0, Math.floor(targetOffset));
  const walker = document.createTreeWalker(
    root,
    NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        if (node === root) return NodeFilter.FILTER_SKIP;
        if (node.nodeType === Node.TEXT_NODE) return NodeFilter.FILTER_ACCEPT;
        if (
          node.nodeType === Node.ELEMENT_NODE
          && (node as Element).tagName === 'BR'
        ) {
          return NodeFilter.FILTER_ACCEPT;
        }
        return NodeFilter.FILTER_SKIP;
      },
    },
  );

  let remaining = safeOffset;
  let current: Node | null = walker.nextNode();
  while (current) {
    if (current.nodeType === Node.TEXT_NODE) {
      const textLength = current.textContent?.length ?? 0;
      if (remaining <= textLength) {
        return { node: current, offset: remaining };
      }
      remaining -= textLength;
    } else {
      const parent = current.parentNode;
      if (!parent) {
        return { node: root, offset: root.childNodes.length };
      }
      const childIndex = Array.prototype.indexOf.call(parent.childNodes, current);
      if (remaining <= 1) {
        return { node: parent, offset: childIndex + 1 };
      }
      remaining -= 1;
    }
    current = walker.nextNode();
  }

  const lastChild = root.lastChild;
  if (lastChild?.nodeType === Node.TEXT_NODE) {
    return {
      node: lastChild,
      offset: lastChild.textContent?.length ?? 0,
    };
  }

  return { node: root, offset: root.childNodes.length };
};

export const restoreContentEditableSelection = (
  root: HTMLElement,
  start: number,
  end: number,
): void => {
  const selection = window.getSelection();
  if (!selection) return;

  const bounds = normalizeInlineEditorSelectionBounds(start, end);
  const startPoint = resolveContentEditableSelectionPoint(root, bounds.start);
  const endPoint = resolveContentEditableSelectionPoint(root, bounds.end);
  const range = document.createRange();

  range.setStart(startPoint.node, startPoint.offset);
  range.setEnd(endPoint.node, endPoint.offset);
  selection.removeAllRanges();
  selection.addRange(range);
};
