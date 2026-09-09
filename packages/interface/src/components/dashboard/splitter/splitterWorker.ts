import { analyzeSplitterRequest } from './splitterUtils';
import type { SplitterAnalyzeRequest, SplitterAnalysisResult } from './types';

interface AnalyzeMessage {
  type: 'analyze';
  request: SplitterAnalyzeRequest;
}

interface AnalyzeSuccessMessage {
  type: 'analyze:success';
  imageId: string;
  analysis: SplitterAnalysisResult;
}

interface AnalyzeErrorMessage {
  type: 'analyze:error';
  imageId: string;
  message: string;
}

const buildImageData = async (request: SplitterAnalyzeRequest): Promise<ImageData> => {
  const bitmap = await createImageBitmap(request.file);
  const canvas = new OffscreenCanvas(request.width, request.height);
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('Failed to start the Splitter OffscreenCanvas.');
  context.drawImage(bitmap, 0, 0, request.width, request.height);
  bitmap.close();
  return context.getImageData(0, 0, request.width, request.height);
};

self.onmessage = async (event: MessageEvent<AnalyzeMessage>) => {
  if (event.data.type !== 'analyze') return;
  const { request } = event.data;
  try {
    const imageData = await buildImageData(request);
    const analysis = await analyzeSplitterRequest(request, imageData, 'worker');
    const payload: AnalyzeSuccessMessage = {
      type: 'analyze:success',
      imageId: request.imageId,
      analysis,
    };
    self.postMessage(payload);
  } catch (error) {
    const payload: AnalyzeErrorMessage = {
      type: 'analyze:error',
      imageId: request.imageId,
      message: error instanceof Error ? error.message : 'Unknown failure in the Splitter worker.',
    };
    self.postMessage(payload);
  }
};
