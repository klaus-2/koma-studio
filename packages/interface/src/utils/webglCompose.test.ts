import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { EMPTY_AIO_MANUAL_EDIT_STATE } from '@/constants/dashboard.constants';
import { canvasToBlob, loadImageFromSource } from '@/utils/dashboard.utils';
import type {
  AioManualImageEditState,
  AioTextRegion,
  ImageFilters,
  LoadedImage,
} from '@/types/dashboard.types';
import { useAioRegionRenderToBlob } from '@/pages/dashboard/hooks/region-editor.render';
import type { RenderFontStrategy } from '@/pages/dashboard/hooks/region-editor.render';
import { useManualToolsStore } from '@/pages/dashboard/stores/manual-tools-store';
import { useExportStore } from '@/pages/dashboard/stores/export-store';
import type { DirectPageFile } from '@/utils/page-source';
import type { RenderTextLayout } from './renderText.types';
import { computeRenderTextLayout, drawRenderedTextInRegion } from './renderText';
import {
  DEFAULT_WEBGL_COMPOSE_ENABLED,
  isWebGLComposeEnabled,
  setWebGLComposeEnabled,
  tryComposeLayersWebGL,
} from './webglCompose';
import * as webglComposeModule from './webglCompose';

vi.mock('@/i18n', () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('@/utils/dashboard.utils', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/utils/dashboard.utils')>();
  return {
    ...actual,
    canvasToBlob: vi.fn(async (): Promise<Blob> => {
      return new Blob([new Uint8Array([0x89, 0x50])], { type: 'image/png' });
    }),
    loadImageFromSource: vi.fn(async (src: string): Promise<HTMLImageElement> => {
      const image = document.createElement('img');
      image.src = src;
      return image;
    }),
  };
});

vi.mock('./renderText', () => ({
  computeRenderTextLayout: vi.fn(),
  drawRenderedTextInRegion: vi.fn(),
}));

// The module spy wraps the real composer: the failure-matrix suite exercises
// the original logic, the wiring suite overrides its result per test.
const tryComposeSpy = vi.spyOn(webglComposeModule, 'tryComposeLayersWebGL');

type TwoDContextMembers = Pick<CanvasRenderingContext2D, 'drawImage' | 'canvas'>;

interface TwoDStub {
  readonly canvas: HTMLCanvasElement;
  readonly ctx: CanvasRenderingContext2D;
  readonly drawImage: Mock;
}

const twoDStubs: TwoDStub[] = [];

// jsdom fabricates no real canvas contexts; each stub declares the exact
// members the code under test touches and narrows to the DOM interface.
const stubTwoDContext = (canvas: HTMLCanvasElement): CanvasRenderingContext2D => {
  const drawImage: Mock = vi.fn();
  const members: TwoDContextMembers = {
    canvas,
    drawImage,
  };
  const ctx = members as CanvasRenderingContext2D;
  twoDStubs.push({ canvas, ctx, drawImage });
  return ctx;
};

type GLContextMembers = Pick<
  WebGLRenderingContext,
  | 'activeTexture'
  | 'attachShader'
  | 'bindBuffer'
  | 'bindTexture'
  | 'blendFuncSeparate'
  | 'bufferData'
  | 'clear'
  | 'clearColor'
  | 'compileShader'
  | 'createBuffer'
  | 'createProgram'
  | 'createShader'
  | 'createTexture'
  | 'deleteBuffer'
  | 'deleteProgram'
  | 'deleteShader'
  | 'deleteTexture'
  | 'drawArrays'
  | 'enable'
  | 'enableVertexAttribArray'
  | 'getAttribLocation'
  | 'getExtension'
  | 'getProgramParameter'
  | 'getShaderParameter'
  | 'getUniformLocation'
  | 'linkProgram'
  | 'pixelStorei'
  | 'shaderSource'
  | 'texImage2D'
  | 'texParameteri'
  | 'uniform1i'
  | 'useProgram'
  | 'vertexAttribPointer'
  | 'viewport'
>;

interface GLStubBehaviors {
  readonly shaderCompiles: boolean;
  readonly programLinks: boolean;
  readonly loseContext: Mock | null;
}

const stubGLContext = (behaviors?: Partial<GLStubBehaviors>): GLContextMembers => {
  const loseContext = behaviors?.loseContext ?? null;
  const getExtension = vi.fn((name: string): WEBGL_lose_context | null => {
    if (name === 'WEBGL_lose_context' && loseContext) {
      return { loseContext, restoreContext: vi.fn() };
    }
    return null;
  });
  return {
    activeTexture: vi.fn(),
    attachShader: vi.fn(),
    bindBuffer: vi.fn(),
    bindTexture: vi.fn(),
    blendFuncSeparate: vi.fn(),
    bufferData: vi.fn(),
    clear: vi.fn(),
    clearColor: vi.fn(),
    compileShader: vi.fn(),
    createBuffer: vi.fn((): WebGLBuffer => ({})),
    createProgram: vi.fn((): WebGLProgram => ({})),
    createShader: vi.fn((_type: number): WebGLShader => ({})),
    createTexture: vi.fn((): WebGLTexture => ({})),
    deleteBuffer: vi.fn(),
    deleteProgram: vi.fn(),
    deleteShader: vi.fn(),
    deleteTexture: vi.fn(),
    drawArrays: vi.fn(),
    enable: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    getAttribLocation: vi.fn((_program: WebGLProgram, _name: string): number => 0),
    getExtension: getExtension as WebGLRenderingContext['getExtension'],
    getProgramParameter: vi.fn(
      (_program: WebGLProgram, _pname: number): boolean =>
        behaviors?.programLinks ?? true,
    ),
  getShaderParameter: vi.fn(
    (_shader: WebGLShader, _pname: number): boolean =>
      behaviors?.shaderCompiles ?? true,
  ),
  getUniformLocation: vi.fn(
    (_program: WebGLProgram, _name: string): WebGLUniformLocation => ({}),
  ),
  linkProgram: vi.fn(),
  pixelStorei: vi.fn(),
  shaderSource: vi.fn(),
  texImage2D: vi.fn(),
  texParameteri: vi.fn(),
  uniform1i: vi.fn(),
  useProgram: vi.fn(),
    vertexAttribPointer: vi.fn(),
    viewport: vi.fn(),
  };
};

interface ContextRouter {
  readonly on2d: ((canvas: HTMLCanvasElement) => CanvasRenderingContext2D | null) | null;
  readonly onWebGL: (() => GLContextMembers | null) | null;
}

let latestGetContextSpy: { mockRestore(): void } | null = null;

const routeGetContext = (router: ContextRouter): void => {
  const spy = vi.spyOn(HTMLCanvasElement.prototype, 'getContext');
  spy.mockImplementation(function (
    this: HTMLCanvasElement,
    contextId: string,
  ): RenderingContext | null {
    if (contextId === 'webgl') {
      const members = router.onWebGL?.() ?? null;
      return members ? (members as WebGLRenderingContext) : null;
    }
    if (contextId === '2d') return router.on2d?.(this) ?? null;
    return null;
  });
  latestGetContextSpy = spy;
};

const stubEvery2dContext = (): void => {
  routeGetContext({
    on2d: (canvas) => stubTwoDContext(canvas),
    onWebGL: null,
  });
};

const edited = (
  patch: Partial<AioManualImageEditState>,
): AioManualImageEditState => ({
  ...EMPTY_AIO_MANUAL_EDIT_STATE,
  ...patch,
});

const zeroFilters: ImageFilters = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  sharpen: 0,
  levels: { black: 0, white: 255, gamma: 1 },
  grayscale: false,
  inverted: false,
};

const buildPageFile = (imageId: string): DirectPageFile => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const resident = new File([bytes], `${imageId}.png`, { type: 'image/png' });
  return {
    kind: 'direct',
    name: `${imageId}.png`,
    type: 'image/png',
    size: bytes.byteLength,
    lastModified: 0,
    resident,
    toBlob: async () => new Blob([bytes], { type: 'image/png' }),
    dimensions: async () => ({ width: 64, height: 32 }),
    release: () => undefined,
  };
};

const buildLoadedImage = (imageId: string): LoadedImage => ({
  id: imageId,
  file: buildPageFile(imageId),
  url: `blob:${imageId}`,
  width: 64,
  height: 32,
  rotation: 0,
  filters: zeroFilters,
});

const regionFixture: AioTextRegion = {
  id: 'region-1',
  bbox: [4, 4, 60, 28],
  score: 0.9,
  source: 'manual',
  modelKey: 'perf-probe',
  renderText: 'KOMA',
};

const layoutFixture: RenderTextLayout = {
  wrappedText: 'KOMA',
  lines: ['KOMA'],
  fontSize: 12,
  lineHeight: 14,
  textWidth: 24,
  textHeight: 14,
  placements: [],
  shapeKind: 'square',
};

describe('webgl compose flag', () => {
  it('defaults to disabled', () => {
    expect(DEFAULT_WEBGL_COMPOSE_ENABLED).toBe(false);
    expect(isWebGLComposeEnabled()).toBe(false);
  });

  it('overrides at runtime and resets to the default on null', () => {
    setWebGLComposeEnabled(true);
    expect(isWebGLComposeEnabled()).toBe(true);

    setWebGLComposeEnabled(false);
    expect(isWebGLComposeEnabled()).toBe(false);

    setWebGLComposeEnabled(true);
    setWebGLComposeEnabled(null);
    expect(isWebGLComposeEnabled()).toBe(false);
  });
});

const buildLayers = (): {
  base: HTMLCanvasElement;
  text: HTMLCanvasElement;
} => {
  const base = document.createElement('canvas');
  base.width = 8;
  base.height = 8;
  const text = document.createElement('canvas');
  text.width = 8;
  text.height = 8;
  return { base, text };
};

describe('tryComposeLayersWebGL failure matrix', () => {
  it('returns null for non-positive dimensions without probing WebGL', () => {
    const onWebGL = vi.fn(() => null);
    routeGetContext({ on2d: null, onWebGL });
    const { base, text } = buildLayers();
    expect(tryComposeLayersWebGL(base, null, text, 0, 8)).toBeNull();
    expect(tryComposeLayersWebGL(base, null, text, 8, -1)).toBeNull();
    expect(onWebGL).not.toHaveBeenCalled();
  });

  it('returns null when the context probe reports no WebGL (jsdom)', () => {
    routeGetContext({ on2d: null, onWebGL: null });
    const { base, text } = buildLayers();
    expect(tryComposeLayersWebGL(base, null, text, 8, 8)).toBeNull();
    expect(tryComposeSpy).toHaveBeenCalledTimes(1);
  });

  it('returns null when acquiring a context throws', () => {
    routeGetContext({
      on2d: null,
      onWebGL: () => {
        throw new Error('context-init-failed');
      },
    });
    const { base, text } = buildLayers();
    expect(tryComposeLayersWebGL(base, null, text, 8, 8)).toBeNull();
  });

  it('returns null when a shader fails to compile', () => {
    const gl = stubGLContext({ shaderCompiles: false });
    routeGetContext({ on2d: null, onWebGL: () => gl });
    const { base, text } = buildLayers();
    expect(tryComposeLayersWebGL(base, null, text, 8, 8)).toBeNull();
    expect(gl.drawArrays).not.toHaveBeenCalled();
  });

  it('returns null when the program fails to link', () => {
    const gl = stubGLContext({ programLinks: false });
    routeGetContext({ on2d: null, onWebGL: () => gl });
    const { base, text } = buildLayers();
    expect(tryComposeLayersWebGL(base, null, text, 8, 8)).toBeNull();
    expect(gl.drawArrays).not.toHaveBeenCalled();
  });

  it('returns null when the readback 2D context is unavailable', () => {
    const gl = stubGLContext();
    routeGetContext({ on2d: () => null, onWebGL: () => gl });
    const { base, text } = buildLayers();
    expect(tryComposeLayersWebGL(base, null, text, 8, 8)).toBeNull();
    expect(gl.drawArrays).toHaveBeenCalledTimes(2);
  });

  it('returns a fresh 2D canvas and releases the WebGL context when every GL step succeeds', () => {
    const loseContext = vi.fn();
    const gl = stubGLContext({ loseContext });
    routeGetContext({
      on2d: (canvas) => stubTwoDContext(canvas),
      onWebGL: () => gl,
    });
    const { base, text } = buildLayers();
    const composited = tryComposeLayersWebGL(base, null, text, 8, 8);
    expect(composited).not.toBeNull();
    expect(composited).not.toBe(base);
    expect(composited?.width).toBe(8);
    expect(composited?.height).toBe(8);
    expect(gl.drawArrays).toHaveBeenCalledTimes(2);
    expect(gl.deleteTexture).toHaveBeenCalledTimes(2);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });

  it('cleans up allocated GL resources and releases context when mid-upload throws', () => {
    const loseContext = vi.fn();
    const gl = stubGLContext({ loseContext });
    vi.mocked(gl.texImage2D).mockImplementationOnce(() => undefined).mockImplementationOnce(() => {
      throw new Error('tainted-canvas');
    });
    routeGetContext({ on2d: null, onWebGL: () => gl });
    const { base, text } = buildLayers();
    expect(tryComposeLayersWebGL(base, null, text, 8, 8)).toBeNull();
    expect(gl.deleteTexture).toHaveBeenCalledTimes(2);
    expect(gl.deleteBuffer).toHaveBeenCalledTimes(1);
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
    expect(loseContext).toHaveBeenCalledTimes(1);
  });
});

describe('renderAioImageToBlob wiring', () => {
  const imageId = 'img-1';
  const paintLayerDataUrl = 'data:image/png;base64,AAAA';

  const composeSpy = vi.fn(
    async (
      imgData: LoadedImage,
      fallbackBaseSource?: string,
      options?: { includePaintLayer?: boolean },
    ): Promise<HTMLCanvasElement> => {
      void imgData;
      void fallbackBaseSource;
      void options;
      const canvas = document.createElement('canvas');
      canvas.width = 64;
      canvas.height = 32;
      return canvas;
    },
  );

  const fontStrategy: RenderFontStrategy = {
    waitReady: async () => undefined,
    ensureLoaded: async () => true,
  };

  let compositedCanvas: HTMLCanvasElement;
  let loadedPaintImage: HTMLImageElement | null;

  const renderImageToBlob = (
    image: LoadedImage,
    regions: readonly AioTextRegion[],
  ): Promise<Blob> => {
    const { result } = renderHook(() =>
      useAioRegionRenderToBlob({
        composeAioEditableCanvas: composeSpy,
        fontStrategy,
        outFormat: 'image/png',
        outQuality: 1,
      }),
    );
    return result.current.renderAioImageToBlob(image, [...regions]);
  };

  beforeEach(() => {
    twoDStubs.length = 0;
    compositedCanvas = document.createElement('canvas');
    compositedCanvas.width = 64;
    compositedCanvas.height = 32;
    loadedPaintImage = null;
    composeSpy.mockClear();
    vi.mocked(canvasToBlob).mockClear();
    vi.mocked(loadImageFromSource).mockClear();
    vi.mocked(computeRenderTextLayout).mockClear();
    vi.mocked(computeRenderTextLayout).mockReturnValue(layoutFixture);
    vi.mocked(drawRenderedTextInRegion).mockClear();
    tryComposeSpy.mockClear();
    tryComposeSpy.mockImplementation(
      (): HTMLCanvasElement | null => compositedCanvas,
    );
    vi.mocked(loadImageFromSource).mockImplementation(async (src: string) => {
      const image = document.createElement('img');
      image.src = src;
      loadedPaintImage = image;
      return image;
    });
    stubEvery2dContext();
    useExportStore.setState({ downloadItems: [] });
    useManualToolsStore.setState({ aioManualImageEditsByImage: {} });
  });

  it('keeps the 2D path verbatim when the flag is off (default)', async () => {
    const image = buildLoadedImage(imageId);
    const blob = await renderImageToBlob(image, [regionFixture]);

    expect(isWebGLComposeEnabled()).toBe(false);
    expect(composeSpy).toHaveBeenCalledTimes(1);
    expect(composeSpy.mock.calls[0]?.[2]).toBeUndefined();
    expect(tryComposeSpy).not.toHaveBeenCalled();
    expect(vi.mocked(drawRenderedTextInRegion)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(drawRenderedTextInRegion).mock.calls[0]?.[0]).toBe(
      twoDStubs[0]?.ctx,
    );
    expect(vi.mocked(canvasToBlob).mock.calls[0]?.[0]).toBe(twoDStubs[0]?.canvas);
    expect(blob.type).toBe('image/png');
  });

  it('renders text to the off-DOM layer and composites on the GPU when the flag is on', async () => {
    setWebGLComposeEnabled(true);
    useManualToolsStore.setState({
      aioManualImageEditsByImage: {
        [imageId]: edited({ paintLayerDataUrl }),
      },
    });
    const image = buildLoadedImage(imageId);
    const blob = await renderImageToBlob(image, [regionFixture]);

    expect(composeSpy).toHaveBeenCalledTimes(1);
    expect(composeSpy.mock.calls[0]?.[2]).toEqual({ includePaintLayer: false });
    expect(vi.mocked(loadImageFromSource)).toHaveBeenCalledWith(paintLayerDataUrl);
    expect(tryComposeSpy).toHaveBeenCalledTimes(1);
    expect(tryComposeSpy.mock.calls[0]?.[1]).toBe(loadedPaintImage);
    expect(tryComposeSpy.mock.calls[0]?.[2]).toBe(twoDStubs[1]?.canvas);
    expect(tryComposeSpy.mock.calls[0]?.[3]).toBe(64);
    expect(tryComposeSpy.mock.calls[0]?.[4]).toBe(32);
    expect(vi.mocked(drawRenderedTextInRegion)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(drawRenderedTextInRegion).mock.calls[0]?.[0]).toBe(
      twoDStubs[1]?.ctx,
    );
    expect(twoDStubs[1]?.canvas).not.toBe(twoDStubs[0]?.canvas);
    expect(vi.mocked(canvasToBlob).mock.calls[0]?.[0]).toBe(compositedCanvas);
    expect(blob.type).toBe('image/png');
  });

  it('composites paint + text back onto the 2D canvas when the GPU returns null', async () => {
    setWebGLComposeEnabled(true);
    useManualToolsStore.setState({
      aioManualImageEditsByImage: {
        [imageId]: edited({ paintLayerDataUrl }),
      },
    });
    tryComposeSpy.mockImplementation(() => null);
    const image = buildLoadedImage(imageId);
    const blob = await renderImageToBlob(image, [regionFixture]);

    expect(tryComposeSpy).toHaveBeenCalledTimes(1);
    expect(vi.mocked(canvasToBlob).mock.calls[0]?.[0]).toBe(twoDStubs[0]?.canvas);
    expect(twoDStubs[0]?.drawImage).toHaveBeenCalledTimes(2);
    expect(twoDStubs[0]?.drawImage).toHaveBeenNthCalledWith(
      1,
      loadedPaintImage,
      0,
      0,
      64,
      32,
    );
    expect(twoDStubs[0]?.drawImage).toHaveBeenNthCalledWith(
      2,
      twoDStubs[1]?.canvas,
      0,
      0,
      64,
      32,
    );
    expect(vi.mocked(drawRenderedTextInRegion)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(computeRenderTextLayout)).toHaveBeenCalledTimes(1);
    expect(blob.type).toBe('image/png');
  });

  it('composites text (without paint) onto the 2D canvas when no paint layer exists', async () => {
    setWebGLComposeEnabled(true);
    tryComposeSpy.mockImplementation(() => null);
    const image = buildLoadedImage(imageId);
    await renderImageToBlob(image, [regionFixture]);

    expect(vi.mocked(loadImageFromSource)).not.toHaveBeenCalled();
    expect(tryComposeSpy.mock.calls[0]?.[1]).toBeNull();
    expect(twoDStubs[0]?.drawImage).toHaveBeenCalledTimes(1);
    expect(twoDStubs[0]?.drawImage).toHaveBeenNthCalledWith(
      1,
      twoDStubs[1]?.canvas,
      0,
      0,
      64,
      32,
    );
  });
});

afterEach(() => {
  latestGetContextSpy?.mockRestore();
  latestGetContextSpy = null;
  setWebGLComposeEnabled(null);
});
