<script setup>
import {computed, onBeforeUnmount, onMounted, ref} from 'vue';
import {useData} from 'vitepress';

const appearanceKey = 'vitepress-theme-appearance';
const validModes = new Set(['light', 'dark', 'auto']);
const mode = ref('auto');
const {isDark} = useData();

const nextMode = computed(() => ({
  light: 'dark',
  dark: 'auto',
  auto: 'light',
})[mode.value]);

const switchTitle = computed(() => {
  const current = mode.value === 'auto'
    ? `Auto (${isDark.value ? 'dark' : 'light'} system theme)`
    : `${mode.value[0].toUpperCase()}${mode.value.slice(1)} theme`;
  const next = `${nextMode.value[0].toUpperCase()}${nextMode.value.slice(1)}`;

  return `${current}. Switch to ${next}.`;
});

function normalizeMode(value) {
  return validModes.has(value) ? value : 'auto';
}

function applyMode(nextMode) {
  const normalizedMode = normalizeMode(nextMode);
  const previousMode = window.localStorage.getItem(appearanceKey);

  mode.value = normalizedMode;
  window.localStorage.setItem(appearanceKey, normalizedMode);

  // VitePress uses VueUse's storage listener for appearance. Dispatching the
  // same event keeps its internal state in sync and lets `auto` continue to
  // react whenever the operating system preference changes.
  window.dispatchEvent(new StorageEvent('storage', {
    key: appearanceKey,
    oldValue: previousMode,
    newValue: normalizedMode,
    storageArea: window.localStorage,
  }));
}

function cycleMode() {
  applyMode(nextMode.value);
}

function handleStorage(event) {
  if (event.key === appearanceKey) {
    mode.value = normalizeMode(event.newValue);
  }
}

onMounted(() => {
  mode.value = normalizeMode(window.localStorage.getItem(appearanceKey));
  window.addEventListener('storage', handleStorage);
});

onBeforeUnmount(() => {
  window.removeEventListener('storage', handleStorage);
});
</script>

<template>
  <button
    type="button"
    class="ThemeSelector"
    :class="{
      'is-dark-position': isDark,
      'is-auto': mode === 'auto',
    }"
    role="switch"
    :aria-checked="isDark"
    :aria-label="switchTitle"
    :title="switchTitle"
    @click="cycleMode"
  >
    <span class="check" aria-hidden="true">
      <svg v-if="mode === 'auto'" class="mode-icon" viewBox="0 0 24 24">
        <rect x="3" y="4" width="18" height="13" rx="2" />
        <path d="M8 21h8M12 17v4" />
      </svg>
      <svg v-else-if="isDark" class="mode-icon" viewBox="0 0 24 24">
        <path d="M20.5 14.3A8.5 8.5 0 0 1 9.7 3.5 8.5 8.5 0 1 0 20.5 14.3Z" />
      </svg>
      <svg v-else class="mode-icon" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="4" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41" />
      </svg>
      <span v-if="mode === 'auto'" class="auto-indicator" />
    </span>
  </button>
</template>

<style scoped>
.ThemeSelector {
  position: relative;
  display: block;
  flex: 0 0 auto;
  width: 40px;
  height: 22px;
  margin-left: 0.5rem;
  border: 1px solid var(--vp-c-border);
  border-radius: 11px;
  color: var(--vp-c-text-2);
  background: var(--vp-input-switch-bg-color);
  cursor: pointer;
  transition: border-color 150ms ease, background-color 150ms ease;
}

.ThemeSelector:hover,
.ThemeSelector:focus-visible {
  border-color: var(--vp-c-brand-1);
}

.ThemeSelector:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
}

.check {
  position: absolute;
  top: 1px;
  left: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--vp-c-bg-elv);
  box-shadow: var(--vp-shadow-1);
  transition: transform 200ms ease, color 150ms ease;
}

.is-dark-position .check {
  transform: translateX(18px);
}

.is-auto .check {
  color: var(--vp-c-brand-1);
}

.mode-icon {
  width: 12px;
  height: 12px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.auto-indicator {
  position: absolute;
  top: -2px;
  right: -2px;
  width: 5px;
  height: 5px;
  border: 1px solid var(--vp-c-bg-elv);
  border-radius: 50%;
  background: var(--vp-c-brand-1);
}

@media (max-width: 479px) {
  .ThemeSelector {
    margin-left: 0;
  }
}
</style>
