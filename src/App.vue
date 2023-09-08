<template>
  <div class="flex flex-col justify-center items-center w-screen h-screen bg-background text-text">
    <div class="mt-auto flex items-center justify-between w-1/5">
      <div class="flex flex-col justify-center items-center h-64 w-1/2 border-r border-primary">
        <p class="text-4xl font-bold text-accent hover:text-primary transition duration-300">lew</p>
      </div>
      <div class="flex flex-col gap-2 w-1/2 pl-8">
        <LinkButton
          v-for="link in links"
          :key="link.href"
          :href="link.href"
          :text="link.text"
          :icon="link.icon"
        />
      </div>
    </div>
    <TheFooter class="mt-auto"></TheFooter>
  </div>
</template>

<script setup lang="ts">
import LinkButton from './components/LinkButton.vue';
import TheFooter from './components/TheFooter.vue';
import type { LinkItem } from './types';

const links: LinkItem[] = [
  {
    text: 'GitHub',
    href: 'https://github.com/lewisdoesstuff',
    icon: 'fa-brands fa-github',
  },
  {
    text: 'LinkedIn',
    href: 'https://www.linkedin.com/in/lewisdoesstuff/',
    icon: 'fa-brands fa-linkedin',
  },
  {
    text: 'Email',
    href: 'mailto:hello@lew.ooo',
    icon: 'envelope',
  },
];
</script>
