import {
  paletteColor,
  terrainPalette,
  neutralPalette,
  type SurfaceParameters,
  type Vector3,
} from './surface-model.ts';

type SurfaceMesh = { buffer: WebGLBuffer; count: number; material: number };
type SurfaceCamera = {
  right: Vector3;
  up: Vector3;
  forward: Vector3;
  center: Vector3;
  scale: number;
  width: number;
  height: number;
};

interface SurfaceRenderer {
  createMesh(vertices: number[], material?: number): SurfaceMesh;
  drawMesh(mesh: SurfaceMesh, time: number, opacity?: number, translation?: Vector3): void;
  resizeViewport(width: number, height: number): void;
  setCamera(camera: SurfaceCamera): void;
  beginFrame(): void;
}

/** The fixed shader, interleaved vertex layout, uploads and draw-state contract for this figure. */
export function createSurfaceRenderer(
  gpu: WebGLRenderingContext,
  { a, b }: SurfaceParameters,
): SurfaceRenderer {
  const vertexShaderSource = `attribute vec3 position;attribute vec3 normal;attribute vec3 color;attribute float arrival;uniform vec3 right;uniform vec3 up;uniform vec3 forward;uniform vec3 center;uniform vec2 scale;varying vec3 vColor;varying vec3 vNormal;varying vec3 vPosition;varying float vArrival;varying float vTone;uniform vec3 problem;uniform float material;uniform vec3 translation;void main(){vPosition=position+translation;vTone=0.;if(material<.1){float x=position.x/1.3-1.25,y=position.y/.65+2.2;float value=(problem.x-x)*(problem.x-x)+50.*(y-x*x)*(y-x*x);vTone=clamp(log(3200./max(12.,value))/log(3200./12.),0.,1.);}vec3 d=vPosition-center;gl_Position=vec4(dot(d,right)*scale.x,dot(d,up)*scale.y,-dot(d,forward)*.13,1.);vColor=color;vNormal=normal;vArrival=arrival;}`;
  const fragmentShaderSource = `precision highp float;
 varying vec3 vColor;varying vec3 vNormal;varying vec3 vPosition;varying float vArrival;varying float vTone;
 uniform float time;uniform float material;uniform float opacity;
 uniform sampler2D palette;uniform vec3 problem;
 void main(){
  if(vArrival>time)discard;
  vec3 c=vColor;
  if(material<.1){
   float x=vPosition.x/1.3-1.25,y=vPosition.y/.65+2.2;
   float inside=step(problem.y,x)*step(x,0.)*step(problem.z,y);
   float q=clamp(vTone,0.,1.)*15.;float band=floor(q);
   vec2 uv=vec2((band+.5)/16.,mix(.25,.75,inside));
   vec2 next=vec2((min(15.,band+1.)+.5)/16.,uv.y);
   c=mix(texture2D(palette,uv).rgb,texture2D(palette,next).rgb,fract(q));
   // Neutral shading preserves the height palette without adding colored highlights.
   float diffuse=max(0.,dot(normalize(vNormal),normalize(vec3(-.5,.25,1.))));
   c*=.55+.45*diffuse;
  }
  gl_FragColor=vec4(c,opacity);
 }`;

  function compileShader(type: number, source: string) {
    const shader = gpu.createShader(type)!;
    gpu.shaderSource(shader, source);
    gpu.compileShader(shader);
    if (!gpu.getShaderParameter(shader, gpu.COMPILE_STATUS))
      throw new Error(gpu.getShaderInfoLog(shader) || 'Surface shader failed');
    return shader;
  }
  const program = gpu.createProgram()!;
  gpu.attachShader(program, compileShader(gpu.VERTEX_SHADER, vertexShaderSource));
  gpu.attachShader(program, compileShader(gpu.FRAGMENT_SHADER, fragmentShaderSource));
  gpu.linkProgram(program);
  if (!gpu.getProgramParameter(program, gpu.LINK_STATUS))
    throw new Error(gpu.getProgramInfoLog(program) || 'Surface program failed');
  gpu.useProgram(program);
  const uniforms = Object.fromEntries(
    [
      'translation',
      'right',
      'up',
      'forward',
      'center',
      'scale',
      'time',
      'material',
      'opacity',
      'palette',
      'problem',
    ].map((name) => [name, gpu.getUniformLocation(program, name)]),
  );
  const paletteData = new Uint8Array(16 * 2 * 4);
  for (let row = 0; row < 2; row++)
    for (let i = 0; i < 16; i++) {
      const c = paletteColor(row ? terrainPalette : neutralPalette, i / 16),
        offset = (row * 16 + i) * 4;
      for (let j = 0; j < 3; j++) paletteData[offset + j] = Math.round(c[j] * 255);
      paletteData[offset + 3] = 255;
    }
  const paletteTexture = gpu.createTexture();
  gpu.activeTexture(gpu.TEXTURE0);
  gpu.bindTexture(gpu.TEXTURE_2D, paletteTexture);
  gpu.texImage2D(gpu.TEXTURE_2D, 0, gpu.RGBA, 16, 2, 0, gpu.RGBA, gpu.UNSIGNED_BYTE, paletteData);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_MIN_FILTER, gpu.NEAREST);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_MAG_FILTER, gpu.NEAREST);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_WRAP_S, gpu.CLAMP_TO_EDGE);
  gpu.texParameteri(gpu.TEXTURE_2D, gpu.TEXTURE_WRAP_T, gpu.CLAMP_TO_EDGE);
  gpu.uniform1i(uniforms.palette, 0);
  gpu.uniform3f(uniforms.problem, a, -Math.sqrt(b), b / 2);
  const attributes = ['position', 'normal', 'color', 'arrival'].map((name) =>
    gpu.getAttribLocation(program, name),
  );
  function createMesh(data: number[], material = 0): SurfaceMesh {
    const buffer = gpu.createBuffer()!;
    gpu.bindBuffer(gpu.ARRAY_BUFFER, buffer);
    gpu.bufferData(gpu.ARRAY_BUFFER, new Float32Array(data), gpu.STATIC_DRAW);
    return { buffer, count: data.length / 10, material };
  }
  const origin: Vector3 = [0, 0, 0];
  const attributeWidths = [3, 3, 3, 1];
  const attributeOffsets = [0, 12, 24, 36];
  function drawMesh(mesh: SurfaceMesh, time: number, opacity = 1, translation: Vector3 = origin) {
    gpu.bindBuffer(gpu.ARRAY_BUFFER, mesh.buffer);
    attributes.forEach((location, i) => {
      gpu.enableVertexAttribArray(location);
      gpu.vertexAttribPointer(
        location,
        attributeWidths[i],
        gpu.FLOAT,
        false,
        40,
        attributeOffsets[i],
      );
    });
    gpu.uniform3fv(uniforms.translation, translation);
    gpu.uniform1f(uniforms.material, mesh.material);
    gpu.uniform1f(uniforms.time, time);
    gpu.uniform1f(uniforms.opacity, opacity);
    gpu.drawArrays(gpu.TRIANGLES, 0, mesh.count);
  }
  return {
    createMesh,
    drawMesh,
    resizeViewport(width: number, height: number) {
      gpu.viewport(0, 0, width, height);
    },
    setCamera({ right, up, forward, center, scale, width, height }: SurfaceCamera) {
      gpu.uniform3fv(uniforms.right, right);
      gpu.uniform3fv(uniforms.up, up);
      gpu.uniform3fv(uniforms.forward, forward);
      gpu.uniform3fv(uniforms.center, center);
      gpu.uniform2f(uniforms.scale, (2 * scale) / width, (2 * scale) / height);
    },
    beginFrame() {
      gpu.clearColor(0, 0, 0, 0);
      gpu.clear(gpu.COLOR_BUFFER_BIT | gpu.DEPTH_BUFFER_BIT);
      gpu.enable(gpu.DEPTH_TEST);
      gpu.enable(gpu.BLEND);
      gpu.blendFunc(gpu.SRC_ALPHA, gpu.ONE_MINUS_SRC_ALPHA);
    },
  };
}
