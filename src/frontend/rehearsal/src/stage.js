// The particle stage: raw WebGL, no libraries. Ported unchanged from demos/neurointent-booth-final.html.
// Five formations; the shader morphs between them per particle:
// 0 voice sphere, 1 one ribbon, 2 words plane ⟂ voice ribbon, 3 same with the voice flattened, 4 rings.
// React drives it through the object createStage() returns (kept in a ref): it writes the targets in
// `scene`, registers the scroll function while the story is on screen, and calls destroy() on unmount.

export const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
export const lerp = (a, b, t) => a + (b - a) * t
export const smooth = (t) => t * t * (3 - 2 * t)

function gauss() { return (Math.random() + Math.random() + Math.random() + Math.random() - 2) / 2 }
const wave = (u) => 0.55 * Math.sin(u * 9.0) + 0.3 * Math.sin(u * 23.0 + 1.0) + 0.18 * Math.sin(u * 41.0 + 2.0)
const env = (u) => Math.pow(Math.max(0, 1 - u * u), 0.7)

// Words wall: a paragraph drawn as evenly spaced dots, rows of "words" with a ragged right edge.
// Lies in the xy plane, running from the corner spine (x = -0.35) out to x = -5.
function paragraphNodes() {
    const nodes = []
    const rows = 7, step = 0.042, lineGap = 0.26, x0 = -0.3, width = 3.6
    let seed = 7
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 }
    for (let r = 0; r < rows; r++) {
        const len = r === rows - 1 ? width * 0.55 : width * (0.82 + rnd() * 0.18)
        let x = 0
        while (x < len) {
            const word = (4 + Math.floor(rnd() * 10)) * step
            for (let wx = 0; wx < word && x + wx < len; wx += step) nodes.push([x0 - (x + wx), (rows - 1) / 2 * lineGap - r * lineGap])
            x += word + step * 3
        }
    }
    return nodes
}
// Voice wall: five fine strands of one waveform, in the zy plane, from the spine (z = -0.35) out to z = -5.
const STRANDS = 5
function strandPoint(u, k, flat) {
    const t = u * 2 - 1
    const spread = (k - (STRANDS - 1) / 2) * 0.17
    // identical strands stacked like a ribbon cable, so they never cross
    const amp = 0.7 * (1 - flat * 0.94)
    const y = spread + env(t) * wave(t) * amp
    return [-0.3 - u * 3.6, y]
}

function buildFormations(N) {
    const P = [0, 1, 2, 3, 4].map(() => new Float32Array(N * 3))
    const info = new Float32Array(N * 2)
    const WORDS = paragraphNodes()
    const golden = Math.PI * (3 - Math.sqrt(5))
    for (let i = 0; i < N; i++) {
        const g = i % 2 // 0 = words, 1 = voice
        const r = Math.random()
        info[i * 2] = g; info[i * 2 + 1] = r
        const set = (k, x, y, z) => { P[k][i * 3] = x; P[k][i * 3 + 1] = y; P[k][i * 3 + 2] = z }
        // 0: sphere with standing bands
        const yy = 1 - (i / (N - 1)) * 2, rad = Math.sqrt(1 - yy * yy), th = golden * i
        const R = 2.25 * (1 + 0.07 * Math.sin(th * 3.0) * Math.sin(yy * 9.0)) + gauss() * 0.04
        set(0, Math.cos(th) * rad * R, yy * R, Math.sin(th) * rad * R)
        // 1: one ribbon along x
        const u1 = Math.random() * 2 - 1
        set(1, u1 * 4.4, env(u1) * wave(u1) * 1.15 + gauss() * 0.07, gauss() * 0.16)
        // 2 + 3: words wall (xy) and voice wall (zy) meet at a right-angled corner
        if (g === 0) {
            const nd = WORDS[(i >> 1) % WORDS.length]
            const jx = gauss() * 0.004, jy = gauss() * 0.004
            set(2, nd[0] + jx, nd[1] + jy, 0); set(3, nd[0] + jx, nd[1] + jy, 0)
            // 4: inner ring (the words stay steady)
            const a = Math.random() * Math.PI * 2, rr = 1.45 + gauss() * 0.03
            set(4, Math.cos(a) * rr, Math.sin(a) * rr, gauss() * 0.05)
        } else {
            const k = (i >> 1) % STRANDS, u = Math.random()
            const [z2, y2] = strandPoint(u, k, 0), [z3, y3] = strandPoint(u, k, 1)
            set(2, 0, y2 + gauss() * 0.005, z2)
            set(3, 0, y3 + gauss() * 0.004, z3)
            const a = Math.random() * Math.PI * 2, rr = 2.45 + gauss() * 0.09
            set(4, Math.cos(a) * rr, Math.sin(a) * rr, gauss() * 0.12)
        }
    }
    return { P, info }
}

const VS = `
precision highp float;
attribute vec3 p0; attribute vec3 p1; attribute vec3 p2; attribute vec3 p3; attribute vec3 p4;
attribute vec2 aInfo;
uniform mat4 uProj; uniform mat4 uView;
uniform float uBurst; uniform float uMorph; uniform float uTime; uniform float uLevel; uniform float uPixel; uniform float uSplit;
uniform float uAspect; uniform float uDim; uniform vec2 uShift; uniform vec2 uMouse;
varying vec3 vColor; varying float vAlpha;
const vec3 EMBER = vec3(0.310, 0.498, 0.478);   // muted teal (#4F7F7A)
const vec3 BONE = vec3(0.106, 0.090, 0.133);
vec3 seg(vec3 a, vec3 b, float f, float r) {
  float t = clamp(f * 1.6 - r * 0.6, 0.0, 1.0);
  t = t * t * (3.0 - 2.0 * t);
  return mix(a, b, t);
}
void main() {
  float g = aInfo.x; float r = aInfo.y;
  float m = clamp(uMorph, 0.0, 4.0);
  vec3 p;
  if (m < 1.0) p = seg(p0, p1, m, r);
  else if (m < 2.0) p = seg(p1, p2, m - 1.0, r);
  else if (m < 3.0) p = seg(p2, p3, m - 2.0, r);
  else p = seg(p3, p4, m - 3.0, r);
  float sphereW = 1.0 - smoothstep(0.0, 0.8, m);
  p *= 1.0 + sphereW * 0.06 * sin(p.y * 3.0 + uTime * 1.3 + p.x * 1.5);
  float ribbonW = smoothstep(0.3, 1.0, m) * (1.0 - smoothstep(1.0, 1.7, m));
  p.y += ribbonW * 0.12 * sin(p.x * 2.4 - uTime * 2.2);
  // burst: points fly outward on a spiral, then fall back into place as uBurst decays
  if (uBurst > 0.001) {
    float ang = r * 6.2831 + uBurst * 3.0;
    vec3 dir = normalize(p + vec3(cos(ang), sin(ang), cos(ang * 1.7)) * 0.6 + vec3(1e-4));
    p += dir * uBurst * (2.5 + r * 6.0);
  }
  float ringW = smoothstep(3.3, 4.0, m);
  if (g > 0.5) {
    float a = atan(p.y, p.x);
    float k = 1.0 + ringW * uLevel * (0.08 + 0.2 * (0.5 + 0.5 * sin(a * 7.0 + uTime * 6.0 + r * 2.0)));
    p.xy *= k;
  }
  float wallW = smoothstep(1.5, 2.0, m) * (1.0 - smoothstep(3.1, 3.6, m));
  p += 0.028 * (1.0 - 0.85 * wallW) * vec3(sin(uTime * 0.8 + r * 40.0), cos(uTime * 0.7 + r * 31.0), sin(uTime * 0.6 + r * 23.0));
  if (g > 0.5) p.y += wallW * 0.04 * sin(p.z * 2.2 + uTime * 1.6) * (1.0 - smoothstep(2.0, 3.0, m));
  vec4 mv = uView * vec4(p, 1.0);
  vec4 clip = uProj * mv;
  vec2 ndc = clip.xy / clip.w + uShift;
  vec2 d = ndc - uMouse; d.x *= uAspect;
  float push = smoothstep(0.3, 0.0, length(d)) * (1.0 - 0.85 * wallW);
  mv.xy += normalize(d + vec2(1e-5)) * push * 0.32;
  gl_Position = uProj * mv;
  gl_Position.xy += uShift * gl_Position.w;
  gl_PointSize = mix(1.3 + r * 2.4, 1.6 + r * 0.8, wallW) * uPixel * 6.5 / -mv.z;
  vec3 base = mix(EMBER, g > 0.5 ? EMBER : BONE, uSplit);
  vColor = base;
  vAlpha = clamp((0.36 + 0.5 * r) * uDim + push * 0.3, 0.0, 1.0);
}`
const FS = `
precision mediump float;
varying vec3 vColor; varying float vAlpha;
void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = length(c);
  if (d > 0.5) discard;
  float a = smoothstep(0.5, 0.0, d);
  float o = a * vAlpha;
  gl_FragColor = vec4(vColor * o, o);
}`

function mat4Perspective(fovy, aspect, near, far) {
    const f = 1 / Math.tan(fovy / 2), nf = 1 / (near - far)
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0])
}
function mat4LookAt(e, c, up) {
    let zx = e[0] - c[0], zy = e[1] - c[1], zz = e[2] - c[2]
    let l = Math.hypot(zx, zy, zz); zx /= l; zy /= l; zz /= l
    let xx = up[1] * zz - up[2] * zy, xy = up[2] * zx - up[0] * zz, xz = up[0] * zy - up[1] * zx
    l = Math.hypot(xx, xy, xz); xx /= l; xy /= l; xz /= l
    const yx = zy * xz - zz * xy, yy = zz * xx - zx * xz, yz = zx * xy - zy * xx
    return new Float32Array([xx, yx, zx, 0, xy, yy, zy, 0, xz, yz, zz, 0,
        -(xx * e[0] + xy * e[1] + xz * e[2]), -(yx * e[0] + yy * e[1] + yz * e[2]), -(zx * e[0] + zy * e[1] + zz * e[2]), 1])
}

// Camera key per formation: front, slight lift, three-quarter (shows the right angle), closer, front.
const CAM = [[0, 0, 8.2], [0, 0.5, 7.4], [4.2, 2.3, 4.2], [3.4, 1.2, 5.0], [0, 0, 9.8]]
const LOOK = [[0, 0, 0], [0, 0, 0], [-1.8, 0, -1.8], [-1.8, 0, -1.8], [0, 0, 0]]

// Where the scene sits and how bright it is on each app screen.
export const SCREEN_SCENE = {
    rec: { morph: 4, shift: 0, shiftY: -0.08, dim: 1 },
    proc: { morph: 1, shift: 0, shiftY: 0, dim: 0.28 },
    report: { morph: 4, shift: 0, shiftY: 0, dim: 0 },
}

export function createStage(canvas) {
    const reduce = reduceMotion()
    const scene = { burst: 0, morph: 0, morphTarget: 0, shift: 0.28, shiftTarget: 0.28, shiftY: 0, shiftYTarget: 0, dim: 1, dimTarget: 1, level: 0, levelTarget: 0, mx: 0, my: 0, mxs: 0, mys: 0 }
    // While the story is on screen it supplies the morph target from the scroll position.
    let storyTarget = null
    const cleanups = []
    const on = (target, type, fn, opts) => { target.addEventListener(type, fn, opts); cleanups.push(() => target.removeEventListener(type, fn, opts)) }
    const root = document.documentElement

    let gl = null
    try { gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' }) } catch { gl = null }
    if (!gl) root.classList.add('no-gl')

    let render = () => {}
    if (gl) {
        const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s }
        try {
            const prog = gl.createProgram()
            gl.attachShader(prog, sh(gl.VERTEX_SHADER, VS))
            gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FS))
            gl.linkProgram(prog)
            if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog))
            gl.useProgram(prog)
            const N = innerWidth < 760 ? 12000 : 22000
            const { P, info } = buildFormations(N)
            const buffers = []
            const attr = (name, data, size) => {
                const loc = gl.getAttribLocation(prog, name)
                const b = gl.createBuffer(); buffers.push(b)
                gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
                gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, size, gl.FLOAT, false, 0, 0)
            }
            P.forEach((arr, k) => attr('p' + k, arr, 3))
            attr('aInfo', info, 2)
            cleanups.push(() => { buffers.forEach(b => gl.deleteBuffer(b)); gl.deleteProgram(prog) })
            const U = {}
            ;['uBurst', 'uProj', 'uView', 'uMorph', 'uTime', 'uLevel', 'uPixel', 'uSplit', 'uAspect', 'uDim', 'uShift', 'uMouse'].forEach(n => { U[n] = gl.getUniformLocation(prog, n) })
            gl.disable(gl.DEPTH_TEST)
            gl.enable(gl.BLEND)
            gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
            let dpr = 1
            const resize = () => {
                dpr = Math.min(1.5, devicePixelRatio || 1)
                canvas.width = Math.round(innerWidth * dpr); canvas.height = Math.round(innerHeight * dpr)
                gl.viewport(0, 0, canvas.width, canvas.height)
            }
            on(window, 'resize', resize); resize()
            render = (t) => {
                const m = scene.morph
                const k = Math.min(3, Math.floor(m)), f = smooth(clamp(m - k))
                const a = CAM[k], b = CAM[Math.min(4, k + 1)]
                const eye = [lerp(a[0], b[0], f) + scene.mxs * 0.5, lerp(a[1], b[1], f) + scene.mys * 0.35, lerp(a[2], b[2], f)]
                const aspect = canvas.width / canvas.height
                const fov = aspect < 0.8 ? 1.05 : 0.78
                gl.clearColor(0.953, 0.945, 0.925, 1); gl.clear(gl.COLOR_BUFFER_BIT)
                gl.uniformMatrix4fv(U.uProj, false, mat4Perspective(fov, aspect, 0.1, 50))
                const la = LOOK[k], lb = LOOK[Math.min(4, k + 1)]
                gl.uniformMatrix4fv(U.uView, false, mat4LookAt(eye, [lerp(la[0], lb[0], f), 0, lerp(la[2], lb[2], f)], [0, 1, 0]))
                gl.uniform1f(U.uMorph, m)
                gl.uniform1f(U.uTime, reduce ? 0 : t / 1000)
                gl.uniform1f(U.uLevel, scene.level)
                gl.uniform1f(U.uBurst, scene.burst)
                gl.uniform1f(U.uPixel, dpr * (aspect < 0.8 ? 0.85 : 1))
                gl.uniform1f(U.uSplit, smooth(clamp(m - 1.05)))
                gl.uniform1f(U.uAspect, aspect)
                gl.uniform1f(U.uDim, scene.dim)
                gl.uniform2f(U.uShift, scene.shift, scene.shiftY)
                gl.uniform2f(U.uMouse, scene.mxs, scene.mys)
                gl.drawArrays(gl.POINTS, 0, N)
            }
        } catch (e) {
            console.warn('WebGL stage disabled:', e.message)
            root.classList.add('no-gl')
            canvas.style.display = 'none'
        }
    }

    on(window, 'pointermove', (e) => {
        scene.mx = (e.clientX / innerWidth) * 2 - 1
        scene.my = -((e.clientY / innerHeight) * 2 - 1)
    }, { passive: true })
    on(window, 'pointerleave', () => { scene.mx = 0; scene.my = 0 })

    let raf = 0
    function frame(t) {
        if (storyTarget) scene.morphTarget = storyTarget()
        const k = reduce ? 1 : 0.075
        scene.morph += (scene.morphTarget - scene.morph) * k
        if (Math.abs(scene.morphTarget - scene.morph) < 0.0005) scene.morph = scene.morphTarget
        scene.shift += (scene.shiftTarget - scene.shift) * (reduce ? 1 : 0.05)
        scene.shiftY += (scene.shiftYTarget - scene.shiftY) * (reduce ? 1 : 0.05)
        scene.dim += (scene.dimTarget - scene.dim) * (reduce ? 1 : 0.06)
        scene.level += (scene.levelTarget - scene.level) * 0.25
        scene.mxs += (scene.mx - scene.mxs) * 0.06
        scene.mys += (scene.my - scene.mys) * 0.06
        // skip drawing when the stage is invisible (the report dims it to zero)
        if (scene.dim > 0.004 || scene.dimTarget > 0) render(t)
        scene.burst *= reduce ? 0 : 0.955
        raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)

    return {
        scene,
        reduce,
        setStoryTarget(fn) { storyTarget = fn },
        // Move the scene to an app screen's position.
        toScreen(name) {
            const s = SCREEN_SCENE[name]
            if (!s) return
            storyTarget = null
            scene.morphTarget = s.morph; scene.shiftTarget = s.shift; scene.shiftYTarget = s.shiftY; scene.dimTarget = s.dim
        },
        // Jump straight to the target, without scrubbing through the formations in between.
        snap() { if (storyTarget) scene.morphTarget = storyTarget(); scene.morph = scene.morphTarget },
        burst() { scene.burst = 1 },
        destroy() {
            cancelAnimationFrame(raf)
            cleanups.forEach(fn => fn())
            root.classList.remove('no-gl')
        },
    }
}
