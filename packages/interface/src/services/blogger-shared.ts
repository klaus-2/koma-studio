const URL_PLACEHOLDER = "{{url}}";

const escapeHtmlAttribute = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

export const parseBloggerLabels = (value: string): string[] => {
  const seen = new Set<string>();

  return value
    .split(/[\n,]/g)
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
    .filter((item) => {
      const normalized = item.toLocaleLowerCase("en-US");
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });
};

export const applyBloggerOptimizerTemplate = (
  template: string,
  canonicalUrl: string,
): string | null => {
  const normalizedTemplate = template.trim();
  const normalizedUrl = canonicalUrl.trim();

  if (!normalizedTemplate || !normalizedUrl || !normalizedTemplate.includes(URL_PLACEHOLDER)) {
    return null;
  }

  return normalizedTemplate.split(URL_PLACEHOLDER).join(normalizedUrl);
};

export const buildBloggerImageTag = (url: string, altText: string): string => {
  const normalizedUrl = url.trim();
  const normalizedAlt = escapeHtmlAttribute(altText.trim());

  if (!normalizedAlt) {
    return `<img src="${normalizedUrl}" />`;
  }

  return `<img src="${normalizedUrl}" alt="${normalizedAlt}" />`;
};
