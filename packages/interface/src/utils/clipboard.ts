export const copyTextToClipboardSafe = async (text: string): Promise<void> => {
  const normalized = text.trim();
  if (!normalized) return;
  try {
    await navigator.clipboard.writeText(normalized);
    return;
  } catch {
    const textArea = document.createElement("textarea");
    textArea.value = normalized;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    textArea.style.pointerEvents = "none";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
  }
};
