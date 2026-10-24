const COMPILE_TIMEOUT_MS = 10000;

/** Poll completion without forcing the driver to finish compilation on the main thread. */
export async function createSurfaceProgram(
  gpu: WebGLRenderingContext,
  vertex: string,
  fragment: string,
): Promise<WebGLProgram> {
  const program = gpu.createProgram();
  if (!program) throw new Error('Cannot create surface program');
  const shaders: WebGLShader[] = [];
  try {
    for (const [type, source] of [
      [gpu.VERTEX_SHADER, vertex],
      [gpu.FRAGMENT_SHADER, fragment],
    ] as const) {
      const shader = gpu.createShader(type);
      if (!shader) throw new Error('Cannot create surface shader');
      shaders.push(shader);
      gpu.shaderSource(shader, source);
      gpu.compileShader(shader);
      gpu.attachShader(program, shader);
    }
    gpu.linkProgram(program);
    const parallel = gpu.getExtension('KHR_parallel_shader_compile');
    if (parallel) {
      const startedAt = performance.now();
      while (!gpu.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)) {
        if (gpu.isContextLost()) throw new Error('Surface context lost during compilation');
        if (performance.now() - startedAt >= COMPILE_TIMEOUT_MS)
          throw new Error('Surface compilation timed out');
        await new Promise<void>((resolve) => setTimeout(resolve, 16));
      }
    }
    // Without the extension this is the synchronous compatibility path.
    if (!gpu.getProgramParameter(program, gpu.LINK_STATUS)) {
      const details = shaders
        .filter((shader) => !gpu.getShaderParameter(shader, gpu.COMPILE_STATUS))
        .map((shader) => gpu.getShaderInfoLog(shader))
        .filter(Boolean)
        .join('\n');
      throw new Error(details || gpu.getProgramInfoLog(program) || 'Surface program failed');
    }
    return program;
  } catch (error) {
    gpu.deleteProgram(program);
    throw error;
  } finally {
    for (const shader of shaders) gpu.deleteShader(shader);
  }
}
