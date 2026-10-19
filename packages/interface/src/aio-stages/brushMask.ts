/** Clean Image brush-mask helper — painted alpha becomes a binary inpaint mask. */
export async function brushDataUrlToMaskBlob(
  dataUrl: string,
  imageWidth: number,
  imageHeight: number,
): Promise<Blob | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imageWidth;
        canvas.height = imageHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, imageWidth, imageHeight);
        const srcData = ctx.getImageData(0, 0, imageWidth, imageHeight).data;

        const maskData = new Uint8ClampedArray(imageWidth * imageHeight * 4);
        for (let i = 0; i < imageWidth * imageHeight; i++) {
          const alpha = srcData[i * 4 + 3];
          const val = alpha !== undefined && alpha > 8 ? 255 : 0;
          maskData[i * 4] = val;
          maskData[i * 4 + 1] = val;
          maskData[i * 4 + 2] = val;
          maskData[i * 4 + 3] = 255;
        }

        const maskImageData = new ImageData(maskData, imageWidth, imageHeight);
        ctx.putImageData(maskImageData, 0, 0);
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = dataUrl;
  });
}
