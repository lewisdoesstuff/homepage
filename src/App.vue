<template>
  <div
    class="dark mocha relative flex flex-col justify-center items-center w-screen h-screen bg-ctp-base text-ctp-text"
  >
    <BlackHoleBackground
      class="!absolute inset-0 flex items-center justify-center rounded-xl"
      :number-of-discs="100"
      :number-of-lines="50"
    />
    <BlurReveal :delay="0" :duration="1" class="z-10">
      <h1
        class="font-bold text-8xl text-ctp-yellow-200 hover:text-ctp-blue-200 drop-shadow-sm drop-shadow-ctp-red transition duration-[2000ms]"
      >
        <LineShadowText shadow-color="var(--catppuccin-color-blue)">lew</LineShadowText>
      </h1>
    </BlurReveal>
    <BlurReveal :delay="1.5" :duration="0.75" class="z-10">
      <div class="flex flex-col sm:flex-row gap-2">
        <LinkButton v-for="(link, ind) in links" :key="ind" :link="link" />
      </div>
    </BlurReveal>
  </div>
</template>

<script setup lang="ts">
import LinkButton from './components/LinkButton.vue';
import BlackHoleBackground from './components/ui/bg-black-hole/BlackHoleBackground.vue';
import BlurReveal from './components/ui/blur-reveal/BlurReveal.vue';
import LineShadowText from './components/ui/line-shadow-text/LineShadowText.vue';
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
</script>
