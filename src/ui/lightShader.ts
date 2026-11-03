/**
 * The moving version of the heat-light artwork: the same maths as artwork.ts, as a WebGL shader.
 * Used for the one big light on a screen (song/playlist header, Home's arc), never for lists.
 *
 * Kept cheap on purpose: drawn at about a third of the element's size (it's soft, the browser scales
 * it up), capped at 30 frames a second, paused when off screen or when the app is in the background.
 * `pulse` (0…1) lets the light breathe with the music later (play-along sets it on each beat).
 */
import { artParams, RAMP, type ArtStyle } from "./artwork";

const VERT = `attribute vec2 a;void main(){gl_Position=vec4(a,0.,1.);}`;

const rampGlsl = (() => {
  const c = (i: number) => {
    const [, [r, g, b]] = RAMP[i]!;
    return `vec3(${(r / 255).toFixed(4)},${(g / 255).toFixed(4)},${(b / 255).toFixed(4)})`;
  };
  let s = `vec3 ramp(float t){t=clamp(t,0.,1.);`;
  for (let i = 1; i < RAMP.length; i++) {
    const p0 = RAMP[i - 1]![0].toFixed(3);
    const p1 = RAMP[i]![0].toFixed(3);
    s += `if(t<=${p1}){float k=smoothstep(${p0},${p1},t);return mix(${c(i - 1)},${c(i)},k);}`;
  }
  return s + `return ${c(RAMP.length - 1)};}`;
})();

const FRAG = `precision highp float;
uniform vec2 res;uniform float t;uniform float warmth;uniform float pulse;uniform float style;
uniform vec4 A;uniform vec4 B;uniform vec4 C;uniform float arcR;
vec2 hash22(vec2 p){vec3 p3=fract(vec3(p.x*.1031,p.y*.103,p.x*.0973));p3+=dot(p3,p3.yzx+33.33);return fract((p3.xx+p3.yz)*p3.zy)*2.-1.;}
float noise(vec2 p){vec2 i=floor(p),f=p-i;vec2 u=f*f*f*(f*(f*6.-15.)+10.);
float n00=dot(hash22(i),f),n10=dot(hash22(i+vec2(1,0)),f-vec2(1,0)),n01=dot(hash22(i+vec2(0,1)),f-vec2(0,1)),n11=dot(hash22(i+vec2(1,1)),f-vec2(1,1));
return mix(mix(n00,n10,u.x),mix(n01,n11,u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5,f=1.;for(int o=0;o<3;o++){s+=a*noise(p*f);f*=2.03;a*=.42;}return s;}
${rampGlsl}
void main(){
vec2 uv=vec2(gl_FragCoord.x/res.x,1.-gl_FragCoord.y/res.y);float aspect=res.x/res.y;float v;
if(style<.5){
 float ca=cos(A.w),sa=sin(A.w);
 vec2 p=vec2((uv.x-.5)*aspect*ca-(uv.y-.5)*sa,(uv.x-.5)*aspect*sa+(uv.y-.5)*ca)*A.z+A.xy+vec2(t*.035,t*.02);
 float qx=fbm(p+vec2(0.,t*.03)),qy=fbm(p+vec2(5.2-t*.025,1.3));
 float f=fbm(p+1.8*vec2(qx,qy)+vec2(1.7,9.2));
 float d1=(f-B.z)/(C.x*.07),d2=(f-B.w)/(C.x*.045);
 float core=exp(-d1*d1)+.7*exp(-d2*d2);
 float halo=exp(-(d1*d1)/7.)+.5*exp(-(d2*d2)/8.);
 float dh=length(vec2((uv.x-B.x)*aspect,uv.y-B.y));
 float pool=exp(-dh*dh*5.)*smoothstep(B.z,B.z+C.x*.3,f)*(1.+.25*pulse);
 v=.02+.3*halo+.6*core+.55*pool;
}else{
 float n=fbm(uv*2.2+A.xy+vec2(t*.04,0.));
 float d=length(vec2((uv.x-C.y)*aspect,uv.y-C.z))-arcR+n*.06;
 float rim=exp(-pow(d/(.035*(1.+.3*pulse)),2.));
 float inside=d<0.?smoothstep(0.,-.55,d):0.;
 float haze=exp(-max(0.,d)/.28);
 v=.12+.24*haze+.5*rim+(d<0.?.62-.4*inside+.12*n:0.);
}
gl_FragColor=vec4(ramp(v*warmth+(1.-warmth)*.12),1.);
}`;

export interface LiveHandle {
  setPulse(v: number): void;
  destroy(): void;
}

export function startLiveArt(canvas: HTMLCanvasElement, seed: string, opts: { warmth: number; style?: ArtStyle }): LiveHandle | null {
  const gl = canvas.getContext("webgl", { antialias: false, alpha: false, powerPreference: "low-power", preserveDrawingBuffer: false });
  if (!gl) return null;
  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  let prog: WebGLProgram;
  try {
    prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return null;
  } catch {
    return null;
  }
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "a");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = U("res"), uT = U("t"), uW = U("warmth"), uP = U("pulse"), uS = U("style"), uA = U("A"), uB = U("B"), uC = U("C"), uR = U("arcR");

  let pulse = 0;
  let target = 0;
  let raf = 0;
  let last = 0;
  let visible = true;
  let tAcc = 0;

  const size = () => {
    const r = canvas.getBoundingClientRect();
    // a third of the CSS size, at most 360 wide: soft light doesn't need more
    const w = Math.max(32, Math.min(360, Math.round(r.width / 3)));
    const h = Math.max(32, Math.round((w * r.height) / Math.max(1, r.width)));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
      const p = artParams(seed, w / h, opts.style);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uS, p.style === "flow" ? 0 : 1);
      gl.uniform4f(uA, p.ox, p.oy, p.scale, p.angle);
      gl.uniform4f(uB, p.hotX, p.hotY, p.level, p.level2);
      gl.uniform4f(uC, p.spread, p.arcCx, p.arcCy, 0);
      gl.uniform1f(uR, p.arcR);
    }
  };

  const draw = (now: number) => {
    raf = 0;
    if (!visible || document.hidden) return;
    raf = requestAnimationFrame(draw);
    if (now - last < 33) return; // ~30 fps
    tAcc += Math.min(100, now - (last || now)) / 1000;
    last = now;
    pulse += (target - pulse) * 0.18;
    target *= 0.9;
    size();
    gl.uniform1f(uT, tAcc * 0.4); // slow drift: ambient, never busy
    gl.uniform1f(uW, opts.warmth);
    gl.uniform1f(uP, pulse);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  const kick = () => {
    if (!raf && visible && !document.hidden) {
      last = 0;
      raf = requestAnimationFrame(draw);
    }
  };

  const io = new IntersectionObserver(([e]) => {
    visible = !!e?.isIntersecting;
    kick();
  });
  io.observe(canvas);
  const onVis = () => kick();
  document.addEventListener("visibilitychange", onVis);
  kick();

  return {
    setPulse(v) {
      target = Math.max(target, v);
    },
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      document.removeEventListener("visibilitychange", onVis);
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
