<template>
  <button
    class="flex items-center justify-start bg-background border-b border-b-secondary gap-4 w-48 py-2 pl-4 rounded-md rounded-b-none hover:rounded-b-md hover:bg-secondary transition-all duration-150 group"
    @click="gotoLink"
  >
    <font-awesome-icon
      class="w-8 h-8 text-primary/75 group-hover:text-accent transition-all delay-75 duration-300"
      :icon="icon"
    />
    <p class="font-semibold text-lg text-text/80 mt-1 group-hover:text-text">{{ text }}</p>
  </button>
</template>

<script setup lang="ts">
const props = defineProps<{
  href: string;
  text: string;
  icon: string;
}>();

const gotoLink = () => {
  window.location.href = props.href;
};
</script>
