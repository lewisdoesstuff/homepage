import { onBeforeUnmount, onMounted, ref, type Ref } from 'vue';

const FIRST_AFTER = 20; // seconds idle before the first letter goes
const EACH_AFTER = 12; // and between each one after that

/**
 * Letters that the black hole has pulled in while nobody was looking, last letter first.
 * Any activity, or coming back to the tab, lets them drift back out.
 */
export function useDecay(count: number, enabled: Ref<boolean>) {
  const consumed = ref<boolean[]>(Array(count).fill(false));
  // Set while jumping straight to the consumed state, so the pull-in isn't shown on return.
  const instant = ref(false);
  let lastActive = Date.now();
  let timer = 0;

  function update() {
    const idle = (Date.now() - lastActive) / 1000;
    const next = consumed.value.map(
      (_, i) => enabled.value && idle >= FIRST_AFTER + (count - 1 - i) * EACH_AFTER
    );
    if (next.some((c, i) => c !== consumed.value[i])) consumed.value = next;
  }

  function wake() {
    lastActive = Date.now();
    if (consumed.value.some(Boolean)) consumed.value = Array(count).fill(false);
  }

  function onVisibility() {
    if (document.hidden) return;
    instant.value = true;
    update();
    // Let the consumed state paint before releasing it.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => {
        instant.value = false;
        wake();
      })
    );
  }

  const events = ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'] as const;

  onMounted(() => {
    timer = window.setInterval(() => !document.hidden && update(), 1000);
    document.addEventListener('visibilitychange', onVisibility);
    events.forEach((e) => window.addEventListener(e, wake, { passive: true }));
  });

  onBeforeUnmount(() => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisibility);
    events.forEach((e) => window.removeEventListener(e, wake));
  });

  return { consumed, instant };
}
