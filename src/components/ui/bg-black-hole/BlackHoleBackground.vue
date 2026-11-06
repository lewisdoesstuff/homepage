<template>
  <div
    data-slot="black-hole-background"
    :class="[
      'relative size-full overflow-hidden',
      `before:absolute before:left-1/2 before:top-1/2 before:block before:size-[200%] before:content-[''] before:[background:radial-gradient(circle_at_50%_55%,transparent_10%,var(--catppuccin-color-base)_50%)] before:[transform:translate3d(-50%,-50%,0)]`,
      `after:absolute after:left-1/2 after:top-1/2 after:z-[5] after:block after:size-full after:mix-blend-overlay after:content-[''] after:[background:radial-gradient(circle_at_50%_75%,var(--bh-glow)_20%,transparent_75%)] after:[transform:translate3d(-50%,-50%,0)] after:transition-[background] after:duration-1000`,
      props.class,
    ]"
    :style="{ '--bh-glow': props.glowColor }"
  >
    <slot></slot>
    <canvas
      ref="canvasRef"
      class="absolute inset-0 block size-full starting:blur-3xl blur-none transition duration-1000 ease-out motion-reduce:transition-none"
    />
    <motion.div
      :class="[
        'absolute z-[3] h-[200%] max-w-64 w-[20%] rounded-b-full opacity-75 mix-blend-plus-darker blur-3xl [background-position:0%_100%] [background-size:100%_200%] dark:mix-blend-plus-lighter',
      ]"
      :style="plumeStyle"
      :animate="props.animate ? { backgroundPosition: '0% 300%' } : undefined"
      :transition="{ duration: 5, ease: 'linear', repeat: Infinity }"
    />
    <div
      class="absolute left-0 top-0 z-[7] size-full opacity-50 mix-blend-overlay dark:[background:repeating-linear-gradient(transparent,transparent_1px,white_1px,white_2px)]"
    />
  </div>
</template>

<script lang="ts" setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { motion } from 'motion-v';

interface Disc {
  p: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Point {
  x: number;
  y: number;
}

interface Particle {
  x: number;
  sx: number;
  dx: number;
  y: number;
  vy: number;
  p: number;
  r: number;
  c: string;
}

interface Clip {
  disc?: Disc;
  i?: number;
  path?: Path2D;
}

interface State {
  discs: Disc[];
  lines: Point[][];
  particles: Particle[];
  clip: Clip;
  startDisc: Disc;
  endDisc: Disc;
  rect: { width: number; height: number; left: number; top: number };
  render: { width: number; height: number; dpi: number };
  particleArea: {
    sw?: number;
    ew?: number;
    h?: number;
    sx?: number;
    ex?: number;
  };
  // Index of the first segment of each line that is drawn clipped to the hole.
  lineClipFrom: number[];
}

// A point on screen that bends the scene towards itself.
interface Gravity {
  x: number;
  y: number;
  tx: number;
  ty: number;
  s: number;
  target: number;
  // 0 at the centre of the screen, 1 further out: the pull fades as it nears the middle.
  reach: number;
  surge: number;
}
interface Props {
  strokeColor?: string;
  numberOfLines?: number;
  numberOfDiscs?: number;
  particleRGBColor?: [number, number, number];
  /** Seven colours for the plume, top to bottom. */
  plumeColors?: string[];
  glowColor?: string;
  /** Let the pointer bend the scene. */
  gravity?: boolean;
  /** When false, a single still frame is drawn. */
  animate?: boolean;
  /** 0–1: speeds everything up and pulls the scene into the hole. */
  surge?: number;
  class?: string;
}

const props = withDefaults(defineProps<Props>(), {
  strokeColor: '#737373',
  numberOfLines: 50,
  numberOfDiscs: 50,
  particleRGBColor: () => [255, 255, 255],
  plumeColors: () => [
    'var(--catppuccin-color-rosewater)',
    'var(--catppuccin-color-red)',
    'var(--catppuccin-color-teal)',
    'var(--catppuccin-color-green)',
    'var(--catppuccin-color-blue)',
    'var(--catppuccin-color-flamingo)',
    'var(--catppuccin-color-sapphire)',
  ],
  glowColor: '#a900ff',
  gravity: true,
  animate: true,
  surge: 0,
});

// The canvas is drawn at full alpha, then masked down to this (brighter around the pointer).
const BASE_ALPHA = 0.2;
const LENS_ALPHA = 0.6;
const PULL = 0.28;
const PLUME_STOPS = ['', '16.5%', '33%', '49.5%', '66%', '85.5%', '100%'];

const canvasRef = ref<HTMLCanvasElement | null>(null);
const animationFrameIdRef = ref<number>(0);
const stateRef = ref<State>({
  discs: [],
  lines: [],
  particles: [],
  clip: {},
  startDisc: { p: 0, x: 0, y: 0, w: 0, h: 0 },
  endDisc: { p: 0, x: 0, y: 0, w: 0, h: 0 },
  rect: { width: 0, height: 0, left: 0, top: 0 },
  render: { width: 0, height: 0, dpi: 1 },
  particleArea: {},
  lineClipFrom: [],
});
const pull: Gravity = { x: 0, y: 0, tx: 0, ty: 0, s: 0, target: 0, reach: 0, surge: 0 };

function strength() {
  return Math.max(pull.s * pull.reach, pull.surge);
}

const MAX_ASPECT = 16;

const plumeStyle = computed(() => {
  const { width, height } = stateRef.value.rect;
  if (!stateRef.value.clip.disc) return {};
  const { y: y1 } = stateRef.value.clip.disc;

  const depthFactor = Math.min(1, (width / height - 1) / (MAX_ASPECT - 1));

  const extraShiftPct = Math.min(8, depthFactor * 100 + 10);

  const stops = props.plumeColors.map((c, i) => `${c} ${PLUME_STOPS[i] ?? ''}`).join(',');

  return {
    left: '50%',
    bottom: `${height - y1}px`,
    transform: `translateX(-50%) translateY(${extraShiftPct}%)`,
    backgroundImage: `linear-gradient(20deg,${stops})`,
  };
});

function linear(p: number) {
  return p;
}

function easeInExpo(p: number) {
  return p === 0 ? 0 : Math.pow(2, 10 * (p - 1));
}

function tweenValue(start: number, end: number, p: number, ease: 'inExpo' | null = null) {
  const delta = end - start;
  const easeFn = ease === 'inExpo' ? easeInExpo : linear;
  return start + delta * easeFn(p);
}

function tweenDisc(disc: Disc) {
  const { startDisc, endDisc } = stateRef.value;
  disc.x = tweenValue(startDisc.x, endDisc.x, disc.p);
  disc.y = tweenValue(startDisc.y, endDisc.y, disc.p, 'inExpo');
  disc.w = tweenValue(startDisc.w, endDisc.w, disc.p);
  disc.h = tweenValue(startDisc.h, endDisc.h, disc.p);
}

function setSize() {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const rect = canvas.getBoundingClientRect();
  stateRef.value.rect = { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
  stateRef.value.render = {
    width: rect.width,
    height: rect.height,
    dpi: window.devicePixelRatio || 1,
  };
  canvas.width = stateRef.value.render.width * stateRef.value.render.dpi;
  canvas.height = stateRef.value.render.height * stateRef.value.render.dpi;
}

function setDiscs() {
  const { width, height } = stateRef.value.rect;
  if (width <= 0 || height <= 0) return;

  const base = Math.max(width, height);

  stateRef.value.discs = [];
  stateRef.value.startDisc = {
    p: 0,
    x: width * 0.5,
    y: height * 0.45,
    w: base * 0.75,
    h: base * 0.7,
  };
  stateRef.value.endDisc = {
    p: 0,
    x: width * 0.5,
    y: height * 0.95,
    w: 0,
    h: 0,
  };

  let prevBottom = height;
  stateRef.value.clip = {};

  for (let i = 0; i < props.numberOfDiscs; i++) {
    const p = i / props.numberOfDiscs;
    const disc = { p, x: 0, y: 0, w: 0, h: 0 };
    tweenDisc(disc);
    const bottom = disc.y + disc.h;
    if (bottom <= prevBottom) {
      stateRef.value.clip = { disc: { ...disc }, i };
    }
    prevBottom = bottom;
    stateRef.value.discs.push(disc);
  }

  if (stateRef.value.clip.disc) {
    const clipPath = new Path2D();
    const disc = stateRef.value.clip.disc;
    clipPath.ellipse(disc.x, disc.y, disc.w, disc.h, 0, 0, Math.PI * 2);
    clipPath.rect(disc.x - disc.w, 0, disc.w * 2, disc.y);
    stateRef.value.clip.path = clipPath;
  }
}

function setLines() {
  const { width, height } = stateRef.value.rect;
  // Ensure we have valid dimensions
  if (width <= 0 || height <= 0) return;

  stateRef.value.lines = [];
  const linesAngle = (Math.PI * 2) / props.numberOfLines;
  for (let i = 0; i < props.numberOfLines; i++) {
    stateRef.value.lines.push([]);
  }

  stateRef.value.discs.forEach((disc: Disc) => {
    for (let i = 0; i < props.numberOfLines; i++) {
      const angle = i * linesAngle;
      const p = {
        x: disc.x + Math.cos(angle) * disc.w,
        y: disc.y + Math.sin(angle) * disc.h,
      };
      stateRef.value.lines[i].push(p);
    }
  });

  // Work out where each line enters the hole once; drawing then happens every frame so it can bend.
  const ctx = document.createElement('canvas').getContext('2d');
  const clipPath = stateRef.value.clip.path;
  stateRef.value.lineClipFrom = stateRef.value.lines.map((line: Point[]) => {
    if (!ctx || !clipPath) return Infinity;
    for (let j = 1; j < line.length; j++) {
      const { x, y } = line[j];
      if (ctx.isPointInPath(clipPath, x, y) || ctx.isPointInStroke(clipPath, x, y)) return j + 1;
    }
    return Infinity;
  });
}

function lens(x: number, y: number): [number, number] {
  const s = strength();
  if (s < 0.001) return [x, y];
  const { width, height } = stateRef.value.rect;
  const r = Math.min(260, Math.max(120, Math.min(width, height) * 0.18)) * (1 + pull.surge * 3);
  const dx = pull.x - x;
  const dy = pull.y - y;
  const f = (s * PULL * r * r) / (dx * dx + dy * dy + r * r);
  return [x + dx * f, y + dy * f];
}

function traceEllipse(ctx: CanvasRenderingContext2D | Path2D, d: Disc) {
  if (strength() < 0.001) {
    ctx.ellipse(d.x, d.y, d.w, d.h, 0, 0, Math.PI * 2);
    return;
  }
  const steps = 72;
  for (let k = 0; k <= steps; k++) {
    const a = (k / steps) * Math.PI * 2;
    const [x, y] = lens(d.x + Math.cos(a) * d.w, d.y + Math.sin(a) * d.h);
    if (k === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
}

// The hole's outline, bent along with everything else so lines aren't cut off at its old edge.
let frameClip: Path2D | undefined;

function lensedClip(): Path2D | undefined {
  const { path, disc } = stateRef.value.clip;
  if (!path || !disc || strength() < 0.001) return path;
  const clip = new Path2D();
  traceEllipse(clip, disc);
  clip.closePath();
  // The column above the hole; its top sits well off-screen so bending never drags it into view.
  const x0 = disc.x - disc.w;
  const x1 = disc.x + disc.w;
  const top = -stateRef.value.rect.height;
  const corners: Point[] = [
    { x: x0, y: top },
    { x: x1, y: top },
    { x: x1, y: disc.y },
    { x: x0, y: disc.y },
  ];
  const steps = 32;
  corners.forEach((a, c) => {
    const b = corners[(c + 1) % corners.length];
    for (let k = 0; k < steps; k++) {
      const [x, y] = lens(a.x + ((b.x - a.x) * k) / steps, a.y + ((b.y - a.y) * k) / steps);
      if (c === 0 && k === 0) clip.moveTo(x, y);
      else clip.lineTo(x, y);
    }
  });
  clip.closePath();
  return clip;
}

function initParticle(start: boolean = false): Particle {
  const sx =
    (stateRef.value.particleArea.sx || 0) + (stateRef.value.particleArea.sw || 0) * Math.random();
  const ex =
    (stateRef.value.particleArea.ex || 0) + (stateRef.value.particleArea.ew || 0) * Math.random();
  const dx = ex - sx;
  const y = start
    ? (stateRef.value.particleArea.h || 0) * Math.random()
    : stateRef.value.particleArea.h || 0;
  const r = 0.5 + Math.random() * 4;
  const vy = 0.5 + Math.random();
  return {
    x: sx,
    sx,
    dx,
    y,
    vy,
    p: 0,
    r,
    c: `rgba(${props.particleRGBColor[0]}, ${props.particleRGBColor[1]}, ${
      props.particleRGBColor[2]
    }, ${Math.random()})`,
  };
}

function setParticles() {
  const { width, height } = stateRef.value.rect;
  stateRef.value.particles = [];
  const disc = stateRef.value.clip.disc;
  if (!disc) return;
  stateRef.value.particleArea = {
    sw: disc.w * 0.5,
    ew: disc.w * 2,
    h: height * 0.85,
  };
  stateRef.value.particleArea.sx = (width - (stateRef.value.particleArea.sw || 0)) / 2;
  stateRef.value.particleArea.ex = (width - (stateRef.value.particleArea.ew || 0)) / 2;
  const totalParticles = 100;
  for (let i = 0; i < totalParticles; i++) {
    stateRef.value.particles.push(initParticle(true));
  }
}

function drawDiscs(ctx: CanvasRenderingContext2D) {
  ctx.strokeStyle = props.strokeColor;
  ctx.lineWidth = 2;
  const outerDisc = stateRef.value.startDisc;

  ctx.beginPath();
  traceEllipse(ctx, outerDisc);
  ctx.stroke();
  ctx.closePath();
  stateRef.value.discs.forEach((disc: Disc, i: number) => {
    if (i % 5 !== 0) return;

    if (disc.w < (stateRef.value.clip.disc?.w || 0) - 5) {
      ctx.save();
      ctx.clip(frameClip!);
    }
    ctx.beginPath();
    traceEllipse(ctx, disc);
    ctx.stroke();
    ctx.closePath();
    if (disc.w < (stateRef.value.clip.disc?.w || 0) - 5) {
      ctx.restore();
    }
  });
}

function drawLines(ctx: CanvasRenderingContext2D) {
  const { lines, lineClipFrom } = stateRef.value;
  const trace = (clipped: boolean) => {
    ctx.beginPath();
    lines.forEach((line: Point[], i: number) => {
      const from = clipped ? lineClipFrom[i] - 1 : 0;
      const to = clipped ? line.length - 1 : Math.min(line.length - 1, lineClipFrom[i] - 1);
      for (let j = Math.max(0, from); j <= to; j++) {
        const [x, y] = lens(line[j].x, line[j].y);
        if (j === Math.max(0, from)) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
    });
    ctx.stroke();
  };
  ctx.strokeStyle = props.strokeColor;
  ctx.lineWidth = 2;
  trace(false);
  if (!frameClip) return;
  ctx.save();
  ctx.clip(frameClip);
  trace(true);
  ctx.restore();
}

function drawParticles(ctx: CanvasRenderingContext2D) {
  if (!frameClip) return;
  ctx.save();
  ctx.clip(frameClip);
  stateRef.value.particles.forEach((particle: Particle) => {
    ctx.fillStyle = particle.c;
    const [x, y] = lens(particle.x, particle.y);
    ctx.beginPath();
    ctx.rect(x, y, particle.r, particle.r);
    ctx.closePath();
    ctx.fill();
  });
  ctx.restore();
}

function moveDiscs() {
  stateRef.value.discs.forEach((disc: Disc) => {
    disc.p = (disc.p + 0.001 * (1 + pull.surge * 6)) % 1;
    tweenDisc(disc);
  });
}

function moveParticles() {
  stateRef.value.particles.forEach((particle: Particle, idx: number) => {
    particle.p = 1 - particle.y / (stateRef.value.particleArea.h || 1);
    particle.x = particle.sx + particle.dx * particle.p;
    particle.y -= particle.vy * (1 + pull.surge * 4);
    if (particle.y < 0) {
      stateRef.value.particles[idx] = initParticle();
    }
  });
}

function moveGravity() {
  pull.target = props.gravity ? pull.target : 0;
  pull.s += (pull.target - pull.s) * 0.06;
  pull.surge += (props.surge - pull.surge) * 0.05;
  // During a surge the pull drifts from the pointer to the throat of the hole.
  const hole = stateRef.value.clip.disc;
  const hx = hole ? hole.x : stateRef.value.rect.width / 2;
  const hy = hole ? hole.y : stateRef.value.rect.height / 2;
  const tx = pull.tx + (hx - pull.tx) * pull.surge;
  const ty = pull.ty + (hy - pull.ty) * pull.surge;
  pull.x += (tx - pull.x) * 0.15;
  pull.y += (ty - pull.y) * 0.15;
  const { width, height } = stateRef.value.rect;
  const min = Math.min(width, height);
  const t = Math.min(
    1,
    Math.max(0, (Math.hypot(pull.x - width / 2, pull.y - height / 2) - min * 0.06) / (min * 0.4))
  );
  pull.reach = t * t * (3 - 2 * t);
}

function applyMask(ctx: CanvasRenderingContext2D) {
  const { width, height } = stateRef.value.rect;
  const base = BASE_ALPHA + pull.surge * 0.25;
  ctx.globalCompositeOperation = 'destination-in';
  if (pull.s > 0.001) {
    const r = Math.min(width, height) * 0.35;
    const grad = ctx.createRadialGradient(pull.x, pull.y, 0, pull.x, pull.y, r);
    grad.addColorStop(0, `rgba(0,0,0,${base + (LENS_ALPHA - base) * pull.s})`);
    grad.addColorStop(1, `rgba(0,0,0,${base})`);
    ctx.fillStyle = grad;
  } else {
    ctx.fillStyle = `rgba(0,0,0,${base})`;
  }
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'source-over';
}

function draw(move: boolean) {
  const canvas = canvasRef.value;
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.scale(stateRef.value.render.dpi, stateRef.value.render.dpi);
  if (move) {
    moveGravity();
    moveDiscs();
    moveParticles();
  }
  frameClip = lensedClip();
  drawDiscs(ctx);
  drawLines(ctx);
  drawParticles(ctx);
  applyMask(ctx);
  ctx.restore();
}

function tick() {
  draw(true);
  animationFrameIdRef.value = requestAnimationFrame(tick);
}

function start() {
  cancelAnimationFrame(animationFrameIdRef.value);
  if (props.animate) {
    tick();
  } else {
    pull.s = pull.surge = 0;
    draw(false);
  }
}

function init() {
  setSize();
  setDiscs();
  setLines();
  setParticles();
}

function handleResize() {
  init();
  if (!props.animate) draw(false);
}

function handlePointerMove(e: PointerEvent) {
  const { left, top } = stateRef.value.rect;
  pull.tx = e.clientX - left;
  pull.ty = e.clientY - top;
  // Arriving from nowhere: appear under the pointer instead of sliding in from the last spot.
  if (pull.s < 0.01) {
    pull.x = pull.tx;
    pull.y = pull.ty;
  }
  pull.target = 1;
}

function handlePointerGone(e: PointerEvent | MouseEvent) {
  if (e.type === 'mouseout' && (e as MouseEvent).relatedTarget) return;
  if (e.type === 'pointerup' && (e as PointerEvent).pointerType === 'mouse') return;
  pull.target = 0;
}

watch(() => props.animate, start);

onMounted(() => {
  nextTick(() => {
    init();
    start();
    window.addEventListener('resize', handleResize);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerdown', handlePointerMove);
    window.addEventListener('pointerup', handlePointerGone);
    window.addEventListener('pointercancel', handlePointerGone);
    document.addEventListener('mouseout', handlePointerGone);
  });
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize);
  window.removeEventListener('pointermove', handlePointerMove);
  window.removeEventListener('pointerdown', handlePointerMove);
  window.removeEventListener('pointerup', handlePointerGone);
  window.removeEventListener('pointercancel', handlePointerGone);
  document.removeEventListener('mouseout', handlePointerGone);
  cancelAnimationFrame(animationFrameIdRef.value);
});
</script>
