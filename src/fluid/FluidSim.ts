/**
 * 커서 유체 시뮬레이션 — stable fluids (Jos Stam) 의 웹 경량 구현.
 * 참고: PavelDoGreat/WebGL-Fluid-Simulation (MIT). 웹 최적화 선택:
 *  - 속도장 96px / 염료 512px 저해상도 오프스크린 → 화면 크기와 무관한 고정 비용
 *  - half-float 텍스처, WebGL2 필수 (미지원이면 조용히 비활성)
 *  - 압력 야코비 18회, 소용돌이 보강(vorticity confinement)으로 적은 반복에도 살아있는 회전
 *  - 유휴 3.5초 후 rAF 정지, 포인터가 움직이면 재개 (탭 숨김 시에도 정지)
 * React를 모른다 — FluidCursor 컴포넌트에서만 사용.
 */

// 레퍼런스 패널 값 반영: sim 128 / density diffusion 1.8 / velocity diffusion 2 /
// pressure 1 / vorticity 0 / splat radius 0.41 / shading + bloom on
const SIM_RES = 128;
const DYE_RES = 512;
const PRESSURE_ITERATIONS = 18;
const VELOCITY_DISSIPATION = 2.0; // 1/s
const DYE_DISSIPATION = 1.8; // 1/s
const PRESSURE_DECAY = 1.0;
const CURL_STRENGTH = 0; // 0이면 curl/vorticity 패스 자체를 건너뛴다
const SPLAT_RADIUS = 0.0041;
const SPLAT_FORCE = 5200;
const BLOOM_INTENSITY = 0; // 0 = 블룸 생략 (연기 대신 액체 룩)
const BLOOM_THRESHOLD = 0.62;
const BLOOM_KNEE = 0.7;
// 액체 경계 — 좁은 밴드의 알파 threshold가 가스(연기)를 물방울로 바꾼다
const EDGE_LOW = 0.16;
const EDGE_HIGH = 0.4;

const BASE_VERT = `
precision highp float;
attribute vec2 aPosition;
varying vec2 vUv;
void main () {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const SPLAT_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTarget;
uniform float uAspect;
uniform vec3 uColor;
uniform vec2 uPoint;
uniform float uRadius;
void main () {
  vec2 p = vUv - uPoint;
  p.x *= uAspect;
  vec3 splat = exp(-dot(p, p) / uRadius) * uColor;
  vec3 base = texture2D(uTarget, vUv).xyz;
  gl_FragColor = vec4(base + splat, 1.0);
}`;

const ADVECTION_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uSource;
uniform vec2 uTexelSize;
uniform float uDt;
uniform float uDissipation;
void main () {
  vec2 coord = vUv - uDt * texture2D(uVelocity, vUv).xy * uTexelSize;
  vec3 result = texture2D(uSource, coord).xyz;
  float decay = 1.0 + uDissipation * uDt;
  gl_FragColor = vec4(result / decay, 1.0);
}`;

const DIVERGENCE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
void main () {
  float L = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).y;
  float T = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).y;
  vec2 C = texture2D(uVelocity, vUv).xy;
  if (vUv.x - uTexelSize.x < 0.0) { L = -C.x; }
  if (vUv.x + uTexelSize.x > 1.0) { R = -C.x; }
  if (vUv.y - uTexelSize.y < 0.0) { B = -C.y; }
  if (vUv.y + uTexelSize.y > 1.0) { T = -C.y; }
  gl_FragColor = vec4(0.5 * (R - L + T - B), 0.0, 0.0, 1.0);
}`;

const CURL_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
void main () {
  float L = texture2D(uVelocity, vUv - vec2(uTexelSize.x, 0.0)).y;
  float R = texture2D(uVelocity, vUv + vec2(uTexelSize.x, 0.0)).y;
  float B = texture2D(uVelocity, vUv - vec2(0.0, uTexelSize.y)).x;
  float T = texture2D(uVelocity, vUv + vec2(0.0, uTexelSize.y)).x;
  gl_FragColor = vec4(R - L - T + B, 0.0, 0.0, 1.0);
}`;

const VORTICITY_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uVelocity;
uniform sampler2D uCurl;
uniform vec2 uTexelSize;
uniform float uCurlStrength;
uniform float uDt;
void main () {
  float L = texture2D(uCurl, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture2D(uCurl, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture2D(uCurl, vUv - vec2(0.0, uTexelSize.y)).x;
  float T = texture2D(uCurl, vUv + vec2(0.0, uTexelSize.y)).x;
  float C = texture2D(uCurl, vUv).x;
  vec2 force = 0.5 * vec2(abs(T) - abs(B), abs(R) - abs(L));
  force /= length(force) + 0.0001;
  force *= uCurlStrength * C;
  force.y *= -1.0;
  vec2 velocity = texture2D(uVelocity, vUv).xy + force * uDt;
  velocity = clamp(velocity, vec2(-1000.0), vec2(1000.0));
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}`;

const CLEAR_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform float uValue;
void main () {
  gl_FragColor = uValue * texture2D(uTexture, vUv);
}`;

const PRESSURE_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uDivergence;
uniform vec2 uTexelSize;
void main () {
  float L = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float T = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  float divergence = texture2D(uDivergence, vUv).x;
  gl_FragColor = vec4((L + R + B + T - divergence) * 0.25, 0.0, 0.0, 1.0);
}`;

const GRADIENT_SUBTRACT_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uPressure;
uniform sampler2D uVelocity;
uniform vec2 uTexelSize;
void main () {
  float L = texture2D(uPressure, vUv - vec2(uTexelSize.x, 0.0)).x;
  float R = texture2D(uPressure, vUv + vec2(uTexelSize.x, 0.0)).x;
  float B = texture2D(uPressure, vUv - vec2(0.0, uTexelSize.y)).x;
  float T = texture2D(uPressure, vUv + vec2(0.0, uTexelSize.y)).x;
  vec2 velocity = texture2D(uVelocity, vUv).xy - vec2(R - L, T - B);
  gl_FragColor = vec4(velocity, 0.0, 1.0);
}`;

const BLOOM_PREFILTER_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec3 uCurve;
uniform float uThreshold;
void main () {
  vec3 c = texture2D(uTexture, vUv).rgb;
  float br = max(c.r, max(c.g, c.b));
  float rq = clamp(br - uCurve.x, 0.0, uCurve.y);
  rq = uCurve.z * rq * rq;
  c *= max(rq, br - uThreshold) / max(br, 0.0001);
  gl_FragColor = vec4(c, 0.0);
}`;

const BLOOM_BLUR_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform vec2 uTexelSize;
void main () {
  vec4 sum = vec4(0.0);
  sum += texture2D(uTexture, vUv - uTexelSize);
  sum += texture2D(uTexture, vUv + uTexelSize);
  sum += texture2D(uTexture, vUv + vec2(uTexelSize.x, -uTexelSize.y));
  sum += texture2D(uTexture, vUv - vec2(uTexelSize.x, -uTexelSize.y));
  gl_FragColor = sum * 0.25;
}`;

const DISPLAY_FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D uTexture;
uniform sampler2D uBloom;
uniform vec2 uTexelSize;
uniform float uBloomIntensity;
uniform vec2 uEdge; /* (low, high) — 좁을수록 경계가 또렷한 액체 */
void main () {
  vec3 c = texture2D(uTexture, vUv).rgb;
  float lum = max(c.r, max(c.g, c.b));
  /* 액체 경계: threshold 알파 + 색 정규화(내부는 균일한 물감 농도) */
  float alpha = smoothstep(uEdge.x, uEdge.y, lum);
  vec3 body = c / max(lum, 0.0001);
  /* shading — 밀도 기울기 확산광 (가볍게, 표면감만) */
  vec3 lc = texture2D(uTexture, vUv - vec2(uTexelSize.x, 0.0)).rgb;
  vec3 rc = texture2D(uTexture, vUv + vec2(uTexelSize.x, 0.0)).rgb;
  vec3 bc = texture2D(uTexture, vUv - vec2(0.0, uTexelSize.y)).rgb;
  vec3 tc = texture2D(uTexture, vUv + vec2(0.0, uTexelSize.y)).rgb;
  float dx = length(rc) - length(lc);
  float dy = length(tc) - length(bc);
  vec3 n = normalize(vec3(dx, dy, 0.45));
  float diffuse = clamp(dot(n, vec3(0.0, 0.0, 1.0)) + 0.82, 0.82, 1.0);
  body *= diffuse;
  body += texture2D(uBloom, vUv).rgb * uBloomIntensity;
  gl_FragColor = vec4(body * alpha, alpha); /* premultiplied */
}`;

interface FBO {
  fbo: WebGLFramebuffer;
  texture: WebGLTexture;
  texelX: number;
  texelY: number;
  attach(gl: WebGL2RenderingContext, unit: number): number;
}

interface DoubleFBO {
  read: FBO;
  write: FBO;
  texelX: number;
  texelY: number;
  swap(): void;
}

type Uniforms = Record<string, WebGLUniformLocation | null>;

interface Program {
  program: WebGLProgram;
  uniforms: Uniforms;
}

export interface SplatInput {
  x: number; // 0~1
  y: number; // 0~1 (아래=0)
  dx: number;
  dy: number;
  color: [number, number, number];
}

export class FluidSim {
  private gl: WebGL2RenderingContext;
  private canvas: HTMLCanvasElement;
  private programs: Record<string, Program> = {};
  private velocity!: DoubleFBO;
  private dye!: DoubleFBO;
  private pressure!: DoubleFBO;
  private divergence!: FBO;
  private curl!: FBO;
  private bloomLevels: FBO[] = [];
  private linearFiltering: boolean;
  private ownedTextures: WebGLTexture[] = [];
  private ownedFramebuffers: WebGLFramebuffer[] = [];
  private edgeLow = EDGE_LOW;
  private edgeHigh = EDGE_HIGH;
  readonly supported: boolean;

  constructor(canvas: HTMLCanvasElement, opts: { edgeLow?: number; edgeHigh?: number } = {}) {
    this.canvas = canvas;
    this.edgeLow = opts.edgeLow ?? EDGE_LOW;
    this.edgeHigh = opts.edgeHigh ?? EDGE_HIGH;
    const gl = canvas.getContext('webgl2', {
      alpha: true,
      depth: false,
      stencil: false,
      antialias: false,
      premultipliedAlpha: true,
    });
    this.supported = !!gl && !!gl.getExtension('EXT_color_buffer_float');
    this.gl = gl as WebGL2RenderingContext;
    this.linearFiltering = this.supported && !!gl!.getExtension('OES_texture_float_linear');
    if (!this.supported) return;

    const compile = (type: number, source: string) => {
      const shader = this.gl.createShader(type)!;
      this.gl.shaderSource(shader, source);
      this.gl.compileShader(shader);
      return shader;
    };
    const vert = compile(this.gl.VERTEX_SHADER, BASE_VERT);
    const makeProgram = (name: string, fragSource: string) => {
      const program = this.gl.createProgram()!;
      this.gl.attachShader(program, vert);
      this.gl.attachShader(program, compile(this.gl.FRAGMENT_SHADER, fragSource));
      this.gl.bindAttribLocation(program, 0, 'aPosition'); // 쿼드 버퍼가 location 0을 가정한다
      this.gl.linkProgram(program);
      const uniforms: Uniforms = {};
      const count = this.gl.getProgramParameter(program, this.gl.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < count; i += 1) {
        const info = this.gl.getActiveUniform(program, i)!;
        uniforms[info.name] = this.gl.getUniformLocation(program, info.name);
      }
      this.programs[name] = { program, uniforms };
    };
    makeProgram('splat', SPLAT_FRAG);
    makeProgram('advection', ADVECTION_FRAG);
    makeProgram('divergence', DIVERGENCE_FRAG);
    makeProgram('curl', CURL_FRAG);
    makeProgram('vorticity', VORTICITY_FRAG);
    makeProgram('clear', CLEAR_FRAG);
    makeProgram('pressure', PRESSURE_FRAG);
    makeProgram('gradientSubtract', GRADIENT_SUBTRACT_FRAG);
    makeProgram('bloomPrefilter', BLOOM_PREFILTER_FRAG);
    makeProgram('bloomBlur', BLOOM_BLUR_FRAG);
    makeProgram('display', DISPLAY_FRAG);

    // 풀스크린 쿼드
    const buffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, buffer);
    this.gl.bufferData(this.gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), this.gl.STATIC_DRAW);
    this.gl.enableVertexAttribArray(0);
    this.gl.vertexAttribPointer(0, 2, this.gl.FLOAT, false, 0, 0);
    this.gl.disable(this.gl.BLEND);

    this.allocate();
  }

  private createFBO(width: number, height: number, internalFormat: number, format: number, filter: number): FBO {
    const gl = this.gl;
    const texture = gl.createTexture()!;
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, internalFormat, width, height, 0, format, gl.HALF_FLOAT, null);
    const fbo = gl.createFramebuffer()!;
    this.ownedTextures.push(texture);
    this.ownedFramebuffers.push(fbo);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
    gl.viewport(0, 0, width, height);
    gl.clearColor(0, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return {
      fbo,
      texture,
      texelX: 1 / width,
      texelY: 1 / height,
      attach(glc: WebGL2RenderingContext, unit: number) {
        glc.activeTexture(glc.TEXTURE0 + unit);
        glc.bindTexture(glc.TEXTURE_2D, texture);
        return unit;
      },
    };
  }

  private createDoubleFBO(width: number, height: number, internalFormat: number, format: number, filter: number): DoubleFBO {
    let read = this.createFBO(width, height, internalFormat, format, filter);
    let write = this.createFBO(width, height, internalFormat, format, filter);
    return {
      get read() { return read; },
      get write() { return write; },
      texelX: 1 / width,
      texelY: 1 / height,
      swap() { const t = read; read = write; write = t; },
    } as DoubleFBO;
  }

  private allocate() {
    const gl = this.gl;
    // 리사이즈 재할당 시 이전 타깃 정리 (GPU 메모리 누수 방지)
    this.ownedFramebuffers.forEach((fbo) => gl.deleteFramebuffer(fbo));
    this.ownedTextures.forEach((texture) => gl.deleteTexture(texture));
    this.ownedFramebuffers = [];
    this.ownedTextures = [];

    const filter = this.linearFiltering ? gl.LINEAR : gl.NEAREST;
    const aspect = Math.max(1e-6, this.canvas.width / Math.max(1, this.canvas.height));
    const simW = aspect >= 1 ? Math.round(SIM_RES * aspect) : SIM_RES;
    const simH = aspect >= 1 ? SIM_RES : Math.round(SIM_RES / aspect);
    const dyeW = aspect >= 1 ? Math.round(DYE_RES * aspect) : DYE_RES;
    const dyeH = aspect >= 1 ? DYE_RES : Math.round(DYE_RES / aspect);
    this.velocity = this.createDoubleFBO(simW, simH, gl.RG16F, gl.RG, filter);
    this.dye = this.createDoubleFBO(dyeW, dyeH, gl.RGBA16F, gl.RGBA, filter);
    this.pressure = this.createDoubleFBO(simW, simH, gl.R16F, gl.RED, gl.NEAREST);
    this.divergence = this.createFBO(simW, simH, gl.R16F, gl.RED, gl.NEAREST);
    this.curl = this.createFBO(simW, simH, gl.R16F, gl.RED, gl.NEAREST);
    // 블룸 피라미드 (1/2, 1/4, 1/8) — 선형 필터링이 없으면 블룸 생략
    this.bloomLevels = this.linearFiltering
      ? [2, 4, 8].map((d) => this.createFBO(Math.max(2, Math.round(dyeW / d)), Math.max(2, Math.round(dyeH / d)), gl.RGBA16F, gl.RGBA, filter))
      : [];
  }

  resize() {
    if (!this.supported) return;
    this.allocate();
  }

  private blit(target: FBO | null) {
    const gl = this.gl;
    if (target) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, target.fbo);
      gl.viewport(0, 0, Math.round(1 / target.texelX), Math.round(1 / target.texelY));
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  splat(input: SplatInput) {
    if (!this.supported) return;
    const gl = this.gl;
    const { splat } = this.programs;
    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    gl.useProgram(splat.program);
    gl.uniform1f(splat.uniforms.uAspect, aspect);
    gl.uniform2f(splat.uniforms.uPoint, input.x, input.y);
    gl.uniform1f(splat.uniforms.uRadius, SPLAT_RADIUS);

    // 무속도 스플랫(염료 충전용)은 속도 패스를 건너뛴다 — 허브 코어 충전 비용 절반
    if (input.dx !== 0 || input.dy !== 0) {
      gl.uniform1i(splat.uniforms.uTarget, this.velocity.read.attach(gl, 0));
      gl.uniform3f(splat.uniforms.uColor, input.dx * SPLAT_FORCE, input.dy * SPLAT_FORCE, 0);
      this.blit(this.velocity.write);
      this.velocity.swap();
    }

    gl.uniform1i(splat.uniforms.uTarget, this.dye.read.attach(gl, 0));
    gl.uniform3f(splat.uniforms.uColor, input.color[0], input.color[1], input.color[2]);
    this.blit(this.dye.write);
    this.dye.swap();
  }

  step(dt: number) {
    if (!this.supported) return;
    const gl = this.gl;
    const p = this.programs;
    const velTexel: [number, number] = [this.velocity.texelX, this.velocity.texelY];

    if (CURL_STRENGTH > 0) {
      gl.useProgram(p.curl.program);
      gl.uniform2f(p.curl.uniforms.uTexelSize, velTexel[0], velTexel[1]);
      gl.uniform1i(p.curl.uniforms.uVelocity, this.velocity.read.attach(gl, 0));
      this.blit(this.curl);

      gl.useProgram(p.vorticity.program);
      gl.uniform2f(p.vorticity.uniforms.uTexelSize, velTexel[0], velTexel[1]);
      gl.uniform1i(p.vorticity.uniforms.uVelocity, this.velocity.read.attach(gl, 0));
      gl.uniform1i(p.vorticity.uniforms.uCurl, this.curl.attach(gl, 1));
      gl.uniform1f(p.vorticity.uniforms.uCurlStrength, CURL_STRENGTH);
      gl.uniform1f(p.vorticity.uniforms.uDt, dt);
      this.blit(this.velocity.write);
      this.velocity.swap();
    }

    gl.useProgram(p.divergence.program);
    gl.uniform2f(p.divergence.uniforms.uTexelSize, velTexel[0], velTexel[1]);
    gl.uniform1i(p.divergence.uniforms.uVelocity, this.velocity.read.attach(gl, 0));
    this.blit(this.divergence);

    gl.useProgram(p.clear.program);
    gl.uniform1i(p.clear.uniforms.uTexture, this.pressure.read.attach(gl, 0));
    gl.uniform1f(p.clear.uniforms.uValue, PRESSURE_DECAY);
    this.blit(this.pressure.write);
    this.pressure.swap();

    gl.useProgram(p.pressure.program);
    gl.uniform2f(p.pressure.uniforms.uTexelSize, velTexel[0], velTexel[1]);
    gl.uniform1i(p.pressure.uniforms.uDivergence, this.divergence.attach(gl, 0));
    for (let i = 0; i < PRESSURE_ITERATIONS; i += 1) {
      gl.uniform1i(p.pressure.uniforms.uPressure, this.pressure.read.attach(gl, 1));
      this.blit(this.pressure.write);
      this.pressure.swap();
    }

    gl.useProgram(p.gradientSubtract.program);
    gl.uniform2f(p.gradientSubtract.uniforms.uTexelSize, velTexel[0], velTexel[1]);
    gl.uniform1i(p.gradientSubtract.uniforms.uPressure, this.pressure.read.attach(gl, 0));
    gl.uniform1i(p.gradientSubtract.uniforms.uVelocity, this.velocity.read.attach(gl, 1));
    this.blit(this.velocity.write);
    this.velocity.swap();

    gl.useProgram(p.advection.program);
    gl.uniform2f(p.advection.uniforms.uTexelSize, velTexel[0], velTexel[1]);
    gl.uniform1i(p.advection.uniforms.uVelocity, this.velocity.read.attach(gl, 0));
    gl.uniform1i(p.advection.uniforms.uSource, this.velocity.read.attach(gl, 0));
    gl.uniform1f(p.advection.uniforms.uDt, dt);
    gl.uniform1f(p.advection.uniforms.uDissipation, VELOCITY_DISSIPATION);
    this.blit(this.velocity.write);
    this.velocity.swap();

    gl.uniform1i(p.advection.uniforms.uVelocity, this.velocity.read.attach(gl, 0));
    gl.uniform1i(p.advection.uniforms.uSource, this.dye.read.attach(gl, 1));
    gl.uniform1f(p.advection.uniforms.uDissipation, DYE_DISSIPATION);
    this.blit(this.dye.write);
    this.dye.swap();
  }

  private applyBloom() {
    const gl = this.gl;
    const p = this.programs;
    const levels = this.bloomLevels;
    if (levels.length === 0) return null;

    // 밝은 영역만 추출 (soft knee)
    gl.useProgram(p.bloomPrefilter.program);
    const knee = BLOOM_THRESHOLD * BLOOM_KNEE + 0.0001;
    gl.uniform3f(p.bloomPrefilter.uniforms.uCurve, BLOOM_THRESHOLD - knee, knee * 2, 0.25 / knee);
    gl.uniform1f(p.bloomPrefilter.uniforms.uThreshold, BLOOM_THRESHOLD);
    gl.uniform1i(p.bloomPrefilter.uniforms.uTexture, this.dye.read.attach(gl, 0));
    this.blit(levels[0]);

    // 다운샘플 블러
    gl.useProgram(p.bloomBlur.program);
    for (let i = 0; i < levels.length - 1; i += 1) {
      gl.uniform2f(p.bloomBlur.uniforms.uTexelSize, levels[i].texelX, levels[i].texelY);
      gl.uniform1i(p.bloomBlur.uniforms.uTexture, levels[i].attach(gl, 0));
      this.blit(levels[i + 1]);
    }

    // 업샘플 가산 합성
    gl.blendFunc(gl.ONE, gl.ONE);
    gl.enable(gl.BLEND);
    for (let i = levels.length - 1; i > 0; i -= 1) {
      gl.uniform2f(p.bloomBlur.uniforms.uTexelSize, levels[i].texelX, levels[i].texelY);
      gl.uniform1i(p.bloomBlur.uniforms.uTexture, levels[i].attach(gl, 0));
      this.blit(levels[i - 1]);
    }
    gl.disable(gl.BLEND);
    return levels[0];
  }

  render() {
    if (!this.supported) return;
    const gl = this.gl;
    const bloom = BLOOM_INTENSITY > 0 ? this.applyBloom() : null;
    const { display } = this.programs;
    gl.useProgram(display.program);
    gl.uniform1i(display.uniforms.uTexture, this.dye.read.attach(gl, 0));
    gl.uniform2f(display.uniforms.uTexelSize, this.dye.texelX, this.dye.texelY);
    gl.uniform2f(display.uniforms.uEdge, this.edgeLow, this.edgeHigh);
    gl.uniform1i(display.uniforms.uBloom, (bloom ?? this.dye.read).attach(gl, 1));
    gl.uniform1f(display.uniforms.uBloomIntensity, bloom ? BLOOM_INTENSITY : 0);
    this.blit(null);
  }

  dispose() {
    // loseContext()는 쓰지 않는다 — StrictMode 재마운트가 같은 캔버스의 컨텍스트를
    // 다시 받기 때문에(잃은 컨텍스트 반환) 유체가 조용히 죽고, 헤드리스에선 GPU 채널까지 무너진다.
    if (!this.supported) return;
    const gl = this.gl;
    this.ownedFramebuffers.forEach((fbo) => gl.deleteFramebuffer(fbo));
    this.ownedTextures.forEach((texture) => gl.deleteTexture(texture));
    this.ownedFramebuffers = [];
    this.ownedTextures = [];
    Object.values(this.programs).forEach(({ program }) => gl.deleteProgram(program));
    this.programs = {};
  }
}
