<template>
  <!-- Plain text in the title's colours; on hover it takes the title's hover colour and the same
       drifting hatched shadow, on the icon and the text alike. -->
  <a
    class="group flex items-center gap-2 px-3.5 py-1.5 text-xl font-semibold lowercase tracking-wide text-[var(--title)] [text-shadow:0_0_1px_var(--title-halo),0_0_14px_var(--title-halo)] outline-none transition-colors duration-300 hover:text-[var(--title-hover)] focus-visible:text-[var(--title-hover)]"
    :href="link.href"
  >
    <span
      class="relative z-0 inline-flex transition-[rotate] duration-300 group-hover:-rotate-12 group-focus-visible:-rotate-12"
    >
      <Icon class="size-6" :icon="link.icon" />
      <Icon
        class="hatch absolute left-[2px] top-[2px] -z-10 size-6 text-[var(--title-hover-shadow)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100"
        :icon="link.icon"
        aria-hidden="true"
      />
    </span>
    <LineShadowText
      shadow-color="var(--title-hover-shadow)"
      class="after:left-[0.1em] after:top-[0.1em] after:bg-[length:0.15em_0.15em] after:opacity-0 after:transition-opacity after:duration-300 group-hover:after:opacity-100 group-focus-visible:after:opacity-100"
      >{{ link.text }}</LineShadowText
    >
  </a>
</template>

<script setup lang="ts">
import type { LinkItem } from '@/types';
import { Icon } from '@iconify/vue';
import LineShadowText from './ui/line-shadow-text/LineShadowText.vue';
defineProps<{
  link: LinkItem;
}>();
</script>

<style scoped>
/* The same hatch LineShadowText draws behind text, cut out of a copy of the icon. */
.hatch {
  mask-image: linear-gradient(45deg, transparent 45%, #000 45%, #000 55%, transparent 0);
  mask-size: 3px 3px;
  animation: hatch-drift 15s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .hatch {
    animation: none;
  }
}

@keyframes hatch-drift {
  to {
    mask-position: 27px -48px;
  }
}
</style>
