import type { Editor } from '@tiptap/react';

export const syncEditorFromHtml = (
  editor: Editor | null,
  html: string,
): void => {
  if (!editor) return;

  if (
    editor.getHTML().trim() === html.trim()
  ) {
    return;
  }

  editor.commands.setContent(html, {
    emitUpdate: false,
  });
};

export const buildSafePreviewDocument = (
  html: string,
  localeTag: string,
): string => {
  const baseHref =
    typeof window !== 'undefined'
      ? `${window.location.origin}/`
      : '/';

  const sanitized = html
    .replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      '',
    )
    .replace(
      /<meta\b[^>]*http-equiv=["']Content-Security-Policy["'][^>]*>/gi,
      '',
    )
    .replace(
      /<link\b[^>]*rel=["']modulepreload["'][^>]*>/gi,
      '',
    );

  const trimmed = sanitized.trim();

  if (
    /<!doctype html/i.test(trimmed) ||
    /<html[\s>]/i.test(trimmed)
  ) {
    return trimmed;
  }

  return `<!doctype html>
<html lang="${localeTag}">
  <head>
    <meta charset="UTF-8" />
    <meta
      name="viewport"
      content="width=device-width, initial-scale=1.0"
    />
    <base href="${baseHref}" />
    <style>
      :root { color-scheme: light; }

      * { box-sizing: border-box; }

      body {
        max-width: 920px;
        margin: 0 auto;
        padding: 32px;
        font-family: Inter, system-ui, sans-serif;
        background: #ffffff;
        color: #111827;
        line-height: 1.75;
      }

      img {
        display: block;
        max-width: 100%;
        height: auto;
        margin: 24px auto;
      }

      a { color: #7c3aed; }

      blockquote {
        margin-left: 0;
        padding-left: 18px;
        border-left: 4px solid #ff2e63;
        color: #4b5563;
      }

      pre {
        overflow: auto;
        padding: 16px;
        background: #111827;
        color: #f9fafb;
      }
    </style>
  </head>
  <body>${trimmed}</body>
</html>`;
};
