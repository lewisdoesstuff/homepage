<template>
  <button
    class="grid grid-cols-3 bg-ctp-base/90 border border-ctp-peach gap-4 w-40 lg:w-48 py-2 lg:pl-4 cursor-pointer rounded-3xl hover:rounded-md hover:bg-ctp-mantle transition-all duration-300 group"
    @click="gotoLink"
  >
    <Icon
      class="ml-4 w-8 h-8 text-ctp-subtext0 group-hover:text-ctp-text transition-all delay-75 duration-300"
      :icon="link.icon"
    />
    <p class="font-semibold text-lg text-ctp-subtext0 mt-1 group-hover:text-ctp-text">
      {{ link.text }}
    </p>
  </button>
</template>

<script setup lang="ts">
import type { LinkItem } from '@/types';
import { Icon } from '@iconify/vue';
const props = defineProps<{
  link: LinkItem;
}>();

const gotoLink = () => {
  window.location.href = props.link.href;
};
</script>
