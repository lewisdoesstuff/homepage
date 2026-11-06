<template>
  <!-- Sized in em so it sits on the title's baseline like the rest of the word.
       The wrapper's width is what shoves "lew" aside, and folds to nothing to recentre it. -->
  <span class="inline-block" :style="{ width: `${width / EM}em` }">
    <svg class="h-[1em] w-[1.85em] overflow-visible" viewBox="0 0 74 40" aria-hidden="true">
      <!-- The same drifting hatched shadow the letters have (see LineShadowText): diagonal
           lines 0.06em apart, offset 0.04em down and right. -->
      <defs>
        <pattern :id="hatchId" patternUnits="userSpaceOnUse" :width="HATCH" :height="HATCH">
          <line
            x1="0"
            y1="0"
            :x2="HATCH"
            :y2="HATCH"
            :style="{ stroke: shadowColor }"
            stroke-width="0.34"
          />
          <animateTransform
            v-if="animate"
            attributeName="patternTransform"
            type="translate"
            from="0 0"
            :to="`${HATCH * 9} ${-HATCH * 16}`"
            dur="15s"
            repeatCount="indefinite"
          />
        </pattern>
      </defs>
      <g :transform="`translate(${SHADOW} ${SHADOW})`">
        <ellipse
          :cx="dot.x"
          :cy="BASELINE - DOT_R"
          :rx="DOT_R * dot.scale * dot.sx"
          :ry="DOT_R * dot.scale * dot.sy"
          :fill="`url(#${hatchId})`"
          :opacity="dot.opacity"
        />
        <ellipse
          v-for="(ring, i) in rings"
          :key="`shadow-${i}`"
          :cx="ring.x"
          :cy="ring.y"
          :rx="RING_R * ring.scale * ring.sx"
          :ry="RING_R * ring.scale * ring.sy"
          fill="none"
          :stroke="`url(#${hatchId})`"
          :stroke-width="STROKE"
          :opacity="ring.opacity"
        />
      </g>
      <ellipse
        :cx="dot.x"
        :cy="BASELINE - DOT_R"
        :rx="DOT_R * dot.scale * dot.sx"
        :ry="DOT_R * dot.scale * dot.sy"
        fill="currentColor"
        :opacity="dot.opacity"
      />
      <ellipse
        v-for="(ring, i) in rings"
        :key="i"
        :cx="ring.x"
        :cy="ring.y"
        :rx="RING_R * ring.scale * ring.sx"
        :ry="RING_R * ring.scale * ring.sy"
        fill="none"
        :stroke="colors[i]"
        :stroke-width="STROKE"
        :opacity="ring.opacity"
        class="transition-[stroke] duration-1000"
      />
    </svg>
  </span>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, useId, watch } from 'vue';

// The domain as part of the name, arriving like a Newton's cradle: the dot drops in, then each
// "o" swings down and strikes the row, and the knock travels left through it into "lew".
// When closed, the rings roll back into the dot and the whole thing folds away.
const props = withDefaults(
  defineProps<{
    colors: string[];
    shadowColor?: string;
    open?: boolean;
    delay?: number;
    animate?: boolean;
  }>(),
  { shadowColor: 'var(--catppuccin-color-mauve)', open: true, delay: 0, animate: true }
);

const emit = defineEmits<{
  /** A knock has travelled through the row and reached the title. */
  impact: [strength: number];
}>();

// One em is 40 units; the rings match the font's lowercase o.
const EM = 40;
const BASELINE = 39;
const STROKE = 4.2;
const RING_R = 7.8;
const DOT_R = 2.9;
const DOT_X = 3;
const ROW_Y = BASELINE - RING_R - STROKE / 2;
const ROW_X = [18, 41, 64];
const SHADOW = 1.6;
const HATCH = 2.4;
const hatchId = `hatch-${useId()}`;
// Width needed after the dot and after each ring lands.
const STAGES = [8, 28, 51, 74];

// Timings, in ms.
const DOT_IN = 260;
const FIRST_SWING = 220;
const SWING_GAP = 520;
const SWING = 380;
const KNOCK = 560;
const RIPPLE = 45;
const SQUASH = 260;
const OPEN_DURATION = FIRST_SWING + SWING_GAP * 2 + SWING + KNOCK + 150;
const FOLD_DURATION = 700;

// Each ring hangs from a pivot above its resting place and is let go from up and to the right.
const SWING_LEN = 34;
const SWING_FROM = (70 * Math.PI) / 180;

type Piece = { x: number; y: number; scale: number; opacity: number; sx: number; sy: number };

const resting = (x: number, y: number): Piece => ({ x, y, scale: 1, opacity: 1, sx: 1, sy: 1 });
const rings = ref<Piece[]>(ROW_X.map((x) => resting(x, ROW_Y)));
const dot = reactive<Piece>(resting(DOT_X, BASELINE - DOT_R));
const width = ref(STAGES[STAGES.length - 1]);

let frame = 0;
let timer = 0;

const clamp = (v: number) => Math.min(1, Math.max(0, v));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
// A heavy shove: fast off the mark, a little overshoot, then settles.
const knock = (t: number) => (t >= 1 ? 1 : 1 - Math.exp(-6 * t) * Math.cos(7 * t));
// Brief squash from a hit `dt` ms ago.
const squash = (dt: number) =>
  dt < 0 || dt > SQUASH ? 0 : 0.22 * Math.sin((Math.PI * dt) / SQUASH) * (1 - dt / SQUASH);

function run(duration: number, step: (ms: number) => void) {
  cancelAnimationFrame(frame);
  const startedAt = performance.now();
  const loop = (now: number) => {
    const ms = Math.min(duration, now - startedAt);
    step(ms);
    frame = ms < duration ? requestAnimationFrame(loop) : 0;
  };
  frame = requestAnimationFrame(loop);
}

function openStep(ms: number, emitted: Set<number>) {
  // The dot drops in first and makes a little room.
  const d = clamp(ms / DOT_IN);
  Object.assign(dot, { x: DOT_X, scale: easeOutBack(d), opacity: clamp(d * 3) });
  let w = STAGES[0] * (1 - Math.pow(1 - d, 3));

  let dotSquash = 0;
  const next = ROW_X.map((restX, k) => {
    const start = FIRST_SWING + k * SWING_GAP;
    const impact = start + SWING;
    const u = clamp((ms - start) / SWING);
    if (ms < start) return { ...resting(restX, ROW_Y), opacity: 0 };

    // Swinging down like a pendulum, picking up speed until it hits.
    const theta = SWING_FROM * Math.cos((u * Math.PI) / 2);
    const piece = {
      ...resting(restX + SWING_LEN * Math.sin(theta), ROW_Y - SWING_LEN * (1 - Math.cos(theta))),
      opacity: clamp(u / 0.25),
    };

    if (ms >= impact) {
      w = STAGES[k] + (STAGES[k + 1] - STAGES[k]) * knock((ms - impact) / KNOCK);
      dotSquash = Math.max(dotSquash, squash(ms - impact - (k + 1) * RIPPLE));
      if (!emitted.has(k) && ms >= impact + (k + 1) * RIPPLE) {
        emitted.add(k);
        emit('impact', k === ROW_X.length - 1 ? 1.4 : 1);
      }
    }
    return piece;
  });

  // Each knock ripples leftwards: the striker, every ring before it, then the dot, then "lew".
  next.forEach((piece, j) => {
    for (let k = j; k < ROW_X.length; k++) {
      const impact = FIRST_SWING + k * SWING_GAP + SWING;
      const a = squash(ms - impact - (k - j) * RIPPLE);
      if (a) Object.assign(piece, { sx: 1 - a, sy: 1 + a * 0.7 });
    }
  });

  rings.value = next;
  Object.assign(dot, { sx: 1 - dotSquash, sy: 1 + dotSquash * 0.7 });
  width.value = w;
}

function arrive() {
  const emitted = new Set<number>();
  run(OPEN_DURATION, (ms) => openStep(ms, emitted));
}

function fold() {
  const from = rings.value.map((r) => ({ ...r }));
  const fromDot = dot.opacity;
  const fromWidth = width.value;
  run(FOLD_DURATION, (ms) => {
    const t = ms / FOLD_DURATION;
    const e = easeInOut(t);
    rings.value = from.map((r, i) => {
      // Stagger so the last ring rolls in last.
      const k = easeInOut(clamp((t - i * 0.12) / (1 - 0.24)));
      return {
        ...r,
        x: r.x + (DOT_X - r.x) * k,
        y: r.y + (BASELINE - DOT_R - r.y) * k,
        scale: r.scale * (1 - k),
        opacity: r.opacity * (1 - k),
        sx: 1,
        sy: 1,
      };
    });
    dot.opacity = fromDot * (1 - clamp((e - 0.7) / 0.3));
    width.value = fromWidth * (1 - e);
  });
}

function hideAll() {
  rings.value = rings.value.map((r) => ({ ...r, opacity: 0 }));
  dot.opacity = 0;
  width.value = 0;
}

watch(
  () => props.open,
  (isOpen) => {
    if (!props.animate) return;
    window.clearTimeout(timer);
    if (isOpen) arrive();
    else fold();
  }
);

onMounted(() => {
  if (!props.animate) return;
  hideAll();
  if (props.open) timer = window.setTimeout(arrive, props.delay * 1000);
});

onBeforeUnmount(() => {
  window.clearTimeout(timer);
  cancelAnimationFrame(frame);
});
</script>
