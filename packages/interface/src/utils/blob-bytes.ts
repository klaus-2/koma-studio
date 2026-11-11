export const readBlobBytes = async (blob: Blob): Promise<Uint8Array> => {
  if (typeof blob.arrayBuffer === 'function') {
    const buffer = await blob.arrayBuffer();
    return new Uint8Array(buffer);
  }

  return new Promise<Uint8Array>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (): void => {
      if (reader.result instanceof ArrayBuffer) {
        resolve(new Uint8Array(reader.result));
        return;
      }
      reject(new Error('Failed to read the blob bytes.'));
    };
    reader.onerror = (): void => {
      reject(reader.error ?? new Error('Failed to read the blob bytes.'));
    };
    reader.readAsArrayBuffer(blob);
  });
};
