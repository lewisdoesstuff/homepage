<template>
  <div
    class="dark mocha relative flex flex-col justify-center items-center w-screen h-screen bg-ctp-base text-ctp-text"
  >
    <BlackHoleBackground
      class="!absolute inset-0 flex items-center justify-center rounded-xl"
      :number-of-discs="100"
      :number-of-lines="50"
      :plume-colors="sky.plume"
      :glow-color="sky.glow"
      :animate="!reduced"
      :surge="falling ? 1 : 0"
    />
    <div class="z-10 flex flex-col items-center" :style="[fallStyle, titleVars]">
      <BlurReveal :delay="0" :duration="reduced ? 0 : 1">
        <h1
          class="flex items-baseline font-bold text-7xl sm:text-8xl text-[var(--title)] hover:text-[var(--title-hover)] hover:[--title-shadow:var(--title-hover-shadow)] [filter:drop-shadow(0_0_1px_var(--title-halo))_drop-shadow(0_0_14px_var(--title-halo))] transition-colors duration-1000"
          aria-label="lew.ooo"
          @pointerenter="onTitleEnter"
          @pointerleave="onTitleLeave"
          @pointerup="onTitleTap"
        >
          <span
            v-for="(letter, i) in letters"
            :key="i"
            class="inline-block"
            :style="letterStyle(i)"
            aria-hidden="true"
          >
            <span ref="letterEls" class="inline-block">
              <LineShadowText shadow-color="var(--title-shadow)">{{ letter }}</LineShadowText>
            </span>
          </span>
          <span class="inline-block" :style="letterStyle(letters.length)">
            <OrbitMark
              shadow-color="var(--title-shadow)"
              :colors="sky.rings"
              :open="markOpen"
              :delay="0.5"
              :animate="!reduced"
              @impact="knockTitle"
            />
          </span>
        </h1>
      </BlurReveal>
      <BlurReveal :delay="reduced ? 0 : 1.5" :duration="reduced ? 0 : 0.75" class="mt-4">
        <div class="flex gap-3">
          <LinkButton
            v-for="(link, ind) in links"
            :key="ind"
            :link="link"
            @click="fallInto($event, link)"
          />
        </div>
      </BlurReveal>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { usePreferredReducedMotion } from '@vueuse/core';
import LinkButton from './components/LinkButton.vue';
import OrbitMark from './components/OrbitMark.vue';
import BlackHoleBackground from './components/ui/bg-black-hole/BlackHoleBackground.vue';
import BlurReveal from './components/ui/blur-reveal/BlurReveal.vue';
import LineShadowText from './components/ui/line-shadow-text/LineShadowText.vue';
import { useDecay } from './composables/useDecay';
import { useSky } from './composables/useSky';
import type { LinkItem } from './types';

const links: LinkItem[] = [
  {
    text: 'GitHub',
    href: 'https://github.com/lewisdoesstuff',
    icon: 'mdi:github',
  },
  {
    text: 'Email',
    href: 'mailto:hello@lew.ooo',
    icon: 'mdi:alternate-email',
  },
];

const letters = 'lew'.split('');
// The letters plus the ".ooo" mark, which is the first thing to go.
const pieces = letters.length + 1;

const motionPreference = usePreferredReducedMotion();
const reduced = computed(() => motionPreference.value === 'reduce');
const sky = useSky();
// The title's colours for this hour (see useSky); the links share them. Hovering the title
// swaps in the hover pair, shadow included.
const titleVars = computed(() => ({
  '--title': sky.value.title.fill,
  '--title-hover': sky.value.title.hover,
  '--title-shadow': sky.value.title.shadow,
  '--title-hover-shadow': sky.value.title.hoverShadow,
  '--title-halo': 'color-mix(in oklab, var(--title-shadow) 45%, transparent)',
}));
const { consumed, instant } = useDecay(
  pieces,
  computed(() => !reduced.value)
);

// Each piece of the title is pulled towards the middle and down, stretched thin on the way in.
function letterStyle(i: number) {
  if (instant.value && !consumed.value[i]) return { transition: 'none' };
  const fromCenter = i - (pieces - 1) / 2;
  if (consumed.value[i]) {
    return {
      transform: `translate(${-fromCenter * 0.55}em, 1.6em) rotate(${
        fromCenter * -28 - 6
      }deg) scale(0.08, 1.9)`,
      opacity: 0,
      filter: 'blur(6px)',
      transition: instant.value
        ? 'none'
        : 'transform 7s cubic-bezier(.55,0,1,.45), opacity 7s cubic-bezier(.7,0,1,.3), filter 7s ease-in',
    };
  }
  const delay = `${i * 0.12}s`;
  return {
    transition: `transform 1.8s cubic-bezier(.16,1,.3,1) ${delay}, opacity 1.2s ease-out ${delay}, filter 1.2s ease-out ${delay}`,
  };
}

// ".ooo" plays during the intro, then folds away until the title is hovered (or tapped).
const introducing = ref(true);
const hoveringTitle = ref(false);
const peeking = ref(false);
let introTimer = 0;
let leaveTimer = 0;
let peekTimer = 0;

const markOpen = computed(
  () => reduced.value || introducing.value || hoveringTitle.value || peeking.value
);

function onTitleEnter(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  window.clearTimeout(leaveTimer);
  hoveringTitle.value = true;
}

function onTitleLeave(e: PointerEvent) {
  if (e.pointerType !== 'mouse') return;
  leaveTimer = window.setTimeout(() => (hoveringTitle.value = false), 300);
}

function onTitleTap(e: PointerEvent) {
  if (e.pointerType === 'mouse') return;
  peeking.value = true;
  window.clearTimeout(peekTimer);
  peekTimer = window.setTimeout(() => (peeking.value = false), 4500);
}

// Each ring that lands in ".ooo" knocks into "lew": the jolt runs from the w back to the l.
const letterEls = ref<HTMLElement[]>([]);

function knockTitle(strength: number) {
  [...letterEls.value].reverse().forEach((el, n) =>
    el.animate(
      [
        { transform: 'none' },
        {
          transform: `translateX(${-0.07 * strength}em) scaleX(${1 - 0.06 * strength})`,
          offset: 0.25,
        },
        { transform: 'none' },
      ],
      { duration: 420, delay: n * 55, easing: 'cubic-bezier(.3,.7,.4,1)' }
    )
  );
}

// Clicking a link drops everything into the hole before leaving.
const falling = ref(false);
let fallTimers: number[] = [];

const fallStyle = computed(() =>
  falling.value
    ? {
        transform: 'translateY(14vh) scale(0.02, 1.5)',
        filter: 'blur(10px)',
        opacity: 0,
        transition:
          'transform .65s cubic-bezier(.7,0,.84,0), filter .65s ease-in, opacity .65s ease-in',
      }
    : {
        transition:
          'transform 1s cubic-bezier(.16,1,.3,1), filter 1s ease-out, opacity .6s ease-out',
      }
);

function fallInto(e: MouseEvent, link: LinkItem) {
  if (reduced.value || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  e.preventDefault();
  if (falling.value) return;
  falling.value = true;
  fallTimers = [];
  fallTimers.push(window.setTimeout(() => (window.location.href = link.href), 700));
  // mailto: (or a navigation that never happens) leaves us on the page, so climb back out.
  const stay = link.href.startsWith('mailto:') ? 1400 : 6000;
  fallTimers.push(window.setTimeout(() => (falling.value = false), stay));
}

// Coming back via the back button restores the page mid-fall; let it spring back out.
function onPageShow(e: PageTransitionEvent) {
  if (!e.persisted) return;
  fallTimers.forEach((t) => window.clearTimeout(t));
  fallTimers = [];
  falling.value = false;
}

onMounted(() => {
  window.addEventListener('pageshow', onPageShow);
  introTimer = window.setTimeout(() => (introducing.value = false), 4500);
});
onBeforeUnmount(() => {
  window.removeEventListener('pageshow', onPageShow);
  [introTimer, leaveTimer, peekTimer].forEach((t) => window.clearTimeout(t));
});
</script>
