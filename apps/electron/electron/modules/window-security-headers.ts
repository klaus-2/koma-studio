const shouldAttachLocalSessionHeader = (
  requestUrl: string,
  localApiUrl: string,
): boolean => {
  try {
    return new URL(requestUrl).origin === new URL(localApiUrl).origin;
  } catch {
    // ignore malformed URL — never attach the header when in doubt
    return false;
  }
};

export { shouldAttachLocalSessionHeader };
