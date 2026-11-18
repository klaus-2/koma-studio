/**
 * Scoped GPU layer composer for the AIO export render path (GATE-2).
 *
 * Blends base + paint + text layers as three WebGL1 textures with one
 * source-over pass and reads the result back into a 2D canvas. The composer
 * is measurement-gated: every failure path returns `null` and the caller
 * composites the layers with 2D `drawImage` instead, so an export can never
 * fail or lose a layer because of GPU unavailability.
 *
 * The interactive editor path never touches this module.
 */

export const DEFAULT_WEBGL_COMPOSE_ENABLED = false;

// `null` clears the override and restores DEFAULT_WEBGL_COMPOSE_ENABLED; the
// A/B harness toggles A vs B in one run without source edits.
let webglComposeOverride: boolean | null = null;

export const isWebGLComposeEnabled = (): boolean =>
  webglComposeOverride ?? DEFAULT_WEBGL_COMPOSE_ENABLED;

export const setWebGLComposeEnabled = (enabled: boolean | null): void => {
  webglComposeOverride = enabled;
};

const COMPOSE_VERTEX_SHADER_SOURCE = `
attribute vec2 aPosition;
varying vec2 vLayerUv;
void main() {
  vLayerUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`;

const COMPOSE_FRAGMENT_SHADER_SOURCE = `
precision mediump float;
varying vec2 vLayerUv;
uniform sampler2D uLayer;
void main() {
  gl_FragColor = texture2D(uLayer, vLayerUv);
}
`;

const COMPOSE_QUAD_VERTICES = new Float32Array([
  -1, -1,
  1, -1,
  -1, 1,
  -1, 1,
  1, -1,
  1, 1,
]);

const warnWebGLFallback = (
  stage: string,
  detail?: Record<string, string | number | boolean | null>,
): null => {
  console.warn('[webgl-compose] falling back to 2D', { stage, ...detail });
  return null;
};

const createComposeShader = (
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null => {
  const shader = gl.createShader(type);
  if (!shader) {
    return warnWebGLFallback('create-shader', { type });
  }
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const infoLog = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    return warnWebGLFallback('compile-shader', { type, infoLog });
  }
  return shader;
};

const createLayerTexture = (
  gl: WebGLRenderingContext,
  layer: TexImageSource,
  label: 'base' | 'paint' | 'text',
): WebGLTexture | null => {
  const texture = gl.createTexture();
  if (!texture) {
    return warnWebGLFallback('create-texture', { layer: label });
  }
  try {
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, layer);
    return texture;
  } catch (error) {
    const glError = gl.getError();
    gl.deleteTexture(texture);
    return warnWebGLFallback('upload-texture', {
      layer: label,
      glError,
      error: error instanceof Error ? error.message : String(error),
    });
  }
};

const drawLayerTexture = (
  gl: WebGLRenderingContext,
  texture: WebGLTexture,
): void => {
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
};

export const tryComposeLayersWebGL = (
  base: TexImageSource,
  paint: TexImageSource | null,
  text: TexImageSource,
  width: number,
  height: number,
): HTMLCanvasElement | null => {
  if (width <= 0 || height <= 0) return null;
  let gl: WebGLRenderingContext | null = null;
  let vertexShader: WebGLShader | null = null;
  let fragmentShader: WebGLShader | null = null;
  let program: WebGLProgram | null = null;
  let quadBuffer: WebGLBuffer | null = null;
  let baseTexture: WebGLTexture | null = null;
  let paintTexture: WebGLTexture | null = null;
  let textTexture: WebGLTexture | null = null;
  try {
    const glCanvas = document.createElement('canvas');
    glCanvas.width = width;
    glCanvas.height = height;
    gl = glCanvas.getContext('webgl', {
      alpha: true,
      premultipliedAlpha: true,
      preserveDrawingBuffer: true,
      antialias: false,
      depth: false,
      stencil: false,
    });
    if (!gl) {
      return warnWebGLFallback('context-unavailable');
    }

    vertexShader = createComposeShader(
      gl,
      gl.VERTEX_SHADER,
      COMPOSE_VERTEX_SHADER_SOURCE,
    );
    fragmentShader = createComposeShader(
      gl,
      gl.FRAGMENT_SHADER,
      COMPOSE_FRAGMENT_SHADER_SOURCE,
    );
    if (!vertexShader || !fragmentShader) return null;

    program = gl.createProgram();
    if (!program) {
      return warnWebGLFallback('create-program');
    }
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      return warnWebGLFallback('link-program', {
        infoLog: gl.getProgramInfoLog(program),
      });
    }
    gl.useProgram(program);

    quadBuffer = gl.createBuffer();
    if (!quadBuffer) {
      return warnWebGLFallback('create-buffer');
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, COMPOSE_QUAD_VERTICES, gl.STATIC_DRAW);
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    if (aPosition < 0) {
      return warnWebGLFallback('attrib-location', { attrib: 'aPosition' });
    }
    gl.enableVertexAttribArray(aPosition);
    gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
    const uLayer = gl.getUniformLocation(program, 'uLayer');
    if (!uLayer) {
      return warnWebGLFallback('uniform-location', { uniform: 'uLayer' });
    }
    gl.uniform1i(uLayer, 0);

    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.enable(gl.BLEND);
    // Source-over on unpremultiplied texels: the buffer ends premultiplied,
    // matching the 2D canvas backstore the readback draws into.
    gl.blendFuncSeparate(
      gl.SRC_ALPHA,
      gl.ONE_MINUS_SRC_ALPHA,
      gl.ONE,
      gl.ONE_MINUS_SRC_ALPHA,
    );

    baseTexture = createLayerTexture(gl, base, 'base');
    if (!baseTexture) return null;
    drawLayerTexture(gl, baseTexture);
    if (paint) {
      paintTexture = createLayerTexture(gl, paint, 'paint');
      if (!paintTexture) return null;
      drawLayerTexture(gl, paintTexture);
    }
    textTexture = createLayerTexture(gl, text, 'text');
    if (!textTexture) return null;
    drawLayerTexture(gl, textTexture);
    const glError = gl.getError();
    if (glError !== gl.NO_ERROR) {
      return warnWebGLFallback('draw-error', { glError });
    }

    const outCanvas = document.createElement('canvas');
    outCanvas.width = width;
    outCanvas.height = height;
    const outCtx = outCanvas.getContext('2d');
    if (!outCtx) {
      return warnWebGLFallback('readback-2d-context');
    }
    outCtx.drawImage(glCanvas, 0, 0, width, height);
    return outCanvas;
  } catch (error) {
    // Contract: any GPU failure falls back to the caller's 2D composite.
    return warnWebGLFallback('exception', {
      error: error instanceof Error ? error.message : String(error),
    });
  } finally {
    if (gl) {
      try {
        if (textTexture) gl.deleteTexture(textTexture);
        if (paintTexture) gl.deleteTexture(paintTexture);
        if (baseTexture) gl.deleteTexture(baseTexture);
        if (quadBuffer) gl.deleteBuffer(quadBuffer);
        if (program) gl.deleteProgram(program);
        if (vertexShader) gl.deleteShader(vertexShader);
        if (fragmentShader) gl.deleteShader(fragmentShader);
        gl.getExtension('WEBGL_lose_context')?.loseContext();
      } catch {
        // Best-effort GPU teardown after readback or failure.
      }
    }
  }
};
