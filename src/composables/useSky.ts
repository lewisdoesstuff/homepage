import { computed, onBeforeUnmount, ref } from 'vue';

// Catppuccin Mocha
const C = {
  rosewater: '#f5e0dc',
  flamingo: '#f2cdcd',
  pink: '#f5c2e7',
  mauve: '#cba6f7',
  red: '#f38ba8',
  maroon: '#eba0ac',
  peach: '#fab387',
  yellow: '#f9e2af',
  green: '#a6e3a1',
  teal: '#94e2d5',
  sky: '#89dceb',
  sapphire: '#74c7ec',
  blue: '#89b4fa',
  lavender: '#b4befe',
};

type Title = { fill: string; hover: string; shadow: string; hoverShadow: string };
type Sky = { plume: string[]; glow: string };

// Anchors around the clock; anything in between is blended.
const PHASES: { hour: number; sky: Sky }[] = [
  {
    hour: 3, // deep night
    sky: {
      plume: [C.lavender, C.blue, C.sapphire, C.mauve, C.blue, C.lavender, C.sapphire],
      glow: '#3d1cff',
    },
  },
  {
    hour: 7, // dawn
    sky: {
      plume: [C.rosewater, C.pink, C.peach, C.yellow, C.flamingo, C.lavender, C.rosewater],
      glow: '#ff4fa3',
    },
  },
  {
    hour: 13, // day
    sky: {
      plume: [C.rosewater, C.sky, C.teal, C.green, C.sapphire, C.yellow, C.sky],
      glow: '#00a2ff',
    },
  },
  {
    hour: 19, // dusk
    sky: {
      plume: [C.yellow, C.peach, C.maroon, C.red, C.flamingo, C.mauve, C.peach],
      glow: '#ff5a00',
    },
  },
  {
    hour: 22, // evening, the original look
    sky: {
      plume: [C.rosewater, C.red, C.teal, C.green, C.blue, C.flamingo, C.sapphire],
      glow: '#a900ff',
    },
  },
];

function mix(a: string, b: string, t: number) {
  const pa = [1, 3, 5].map((i) => parseInt(a.slice(i, i + 2), 16));
  const pb = [1, 3, 5].map((i) => parseInt(b.slice(i, i + 2), 16));
  return (
    '#' +
    pa
      .map((v, i) =>
        Math.round(v + (pb[i] - v) * t)
          .toString(16)
          .padStart(2, '0')
      )
      .join('')
  );
}

// --- Colour maths: sRGB hex <-> OKLCH, and WCAG luminance ---

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
const toLinear = (v: number) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
const toGamma = (v: number) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);

export function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map(toLinear);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function toOklch(hex: string): [number, number, number] {
  const [r, g, b] = rgb(hex).map(toLinear);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return [L, Math.hypot(A, B), ((Math.atan2(B, A) * 180) / Math.PI + 360) % 360];
}

function fromOklch(L: number, C: number, h: number): string {
  // Back off chroma until the colour fits in sRGB.
  for (let c = C; c >= 0; c -= 0.005) {
    const A = c * Math.cos((h * Math.PI) / 180);
    const B = c * Math.sin((h * Math.PI) / 180);
    const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
    const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
    const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
    const lin = [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
    ];
    if (lin.every((v) => v >= -0.0001 && v <= 1.0001)) {
      return (
        '#' +
        lin
          .map((v) =>
            Math.round(Math.min(1, Math.max(0, toGamma(v))) * 255)
              .toString(16)
              .padStart(2, '0')
          )
          .join('')
      );
    }
  }
  return '#000000';
}

/** Blend in OKLCH, round the shorter way of the colour wheel, so colours stay vivid in between. */
function mixHue(a: string, b: string, t: number) {
  const [La, Ca, ha] = toOklch(a);
  const [Lb, Cb, hb] = toOklch(b);
  const dh = ((hb - ha + 540) % 360) - 180;
  return fromOklch(La + (Lb - La) * t, Ca + (Cb - Ca) * t, ha + dh * t);
}

/** Roughly what sits behind the title: the plume, tinted by the glow over it. */
export function backdropOf(sky: Sky) {
  const mean = [0, 1, 2].map((k) => {
    const lin = sky.plume.map((c) => toLinear(rgb(c)[k]));
    return lin.reduce((a, b) => a + b, 0) / lin.length;
  });
  const plume =
    '#' +
    mean
      .map((v) =>
        Math.round(toGamma(v) * 255)
          .toString(16)
          .padStart(2, '0')
      )
      .join('');
  return mix(plume, sky.glow, BACKDROP_GLOW);
}
const BACKDROP_GLOW = 0.35;

// Accents in order round the colour wheel, so a hue always falls between two neighbours.
const WHEEL = (Object.keys(C) as (keyof typeof C)[])
  .map((name) => ({ name, hue: toOklch(C[name])[2] }))
  .sort((a, b) => a.hue - b.hue);

/** The Mocha accent at `hue`: a blend of the two either side of it on the wheel. */
function accentAt(hue: number) {
  const h = ((hue % 360) + 360) % 360;
  const i = WHEEL.findIndex((w) => w.hue > h);
  const next = WHEEL[i === -1 ? 0 : i];
  const prev = WHEEL[((i === -1 ? 0 : i) - 1 + WHEEL.length) % WHEEL.length];
  const span = (next.hue - prev.hue + 360) % 360 || 360;
  return mix(C[prev.name], C[next.name], ((h - prev.hue + 360) % 360) / span);
}

// How dark the shadow's version of the colour is (OKLCH lightness).
const SHADOW_L = 0.42;

/** The same colour, darkened for the hatched shadow behind it. */
function shadowOf(color: string) {
  const [, c, h] = toOklch(color);
  return fromOklch(SHADOW_L, c, h);
}

/**
 * Title colours: the Catppuccin accent opposite the sky's hue, as-is, so it stands out by colour
 * rather than by darkness. The contrast comes from the hatched shadow, in a darkened version of
 * the same colour. Hover takes a neighbouring accent.
 */
export function titleFor(sky: Sky): Title {
  const [, , hue] = toOklch(backdropOf(sky));
  const fill = accentAt(hue + 180);
  const hover = accentAt(hue + 180 + 40);
  return { fill, hover, shadow: shadowOf(fill), hoverShadow: shadowOf(hover) };
}

// Titles are worked out at each anchor and blended between, so they drift rather than jump
// (the sky passes near grey between some anchors, where its hue means little).
const PHASE_TITLES = PHASES.map((p) => titleFor(p.sky));
// The rings sit at fixed turns round the wheel from the title's colour, so they never match it,
// its hover colour (+40°) or each other, and stay clear of the sky's own hue (+180°).
const RING_OFFSETS = [95, 250, 305];

export function skyAt(hour: number): Sky & { title: Title; rings: string[] } {
  const h = ((hour % 24) + 24) % 24;
  const found = PHASES.findIndex((p) => p.hour > h);
  const next = found === -1 ? 0 : found;
  const b = PHASES[next];
  const a = PHASES[(next - 1 + PHASES.length) % PHASES.length];
  const span = (b.hour - a.hour + 24) % 24;
  const raw = ((h - a.hour + 24) % 24) / span;
  const t = raw * raw * (3 - 2 * raw);
  const ta = PHASE_TITLES[PHASES.indexOf(a)];
  const tb = PHASE_TITLES[next];
  const plume = a.sky.plume.map((c, i) => mix(c, b.sky.plume[i], t));
  const title = {
    fill: mixHue(ta.fill, tb.fill, t),
    hover: mixHue(ta.hover, tb.hover, t),
    shadow: mixHue(ta.shadow, tb.shadow, t),
    hoverShadow: mixHue(ta.hoverShadow, tb.hoverShadow, t),
  };
  return {
    plume,
    glow: mix(a.sky.glow, b.sky.glow, t),
    title,
    rings: RING_OFFSETS.map((o) => accentAt(toOklch(title.fill)[2] + o)),
  };
}

/**
 * The colours of the sky for the visitor's local time.
 * `?hour=19` pins an hour; `?hour=cycle` runs a day every 24 seconds.
 */
export function useSky() {
  const param = new URLSearchParams(window.location.search).get('hour');
  const cycle = param === 'cycle';
  const pinned = param !== null && !cycle && !isNaN(Number(param)) ? Number(param) : null;

  const localHour = () => {
    const d = new Date();
    return d.getHours() + d.getMinutes() / 60;
  };
  const hour = ref(pinned ?? localHour());

  const timer = window.setInterval(
    () => {
      if (cycle) hour.value = (hour.value + 0.05) % 24;
      else if (pinned === null) hour.value = localHour();
    },
    cycle ? 50 : 60_000
  );
  onBeforeUnmount(() => window.clearInterval(timer));

  return computed(() => skyAt(hour.value));
}
