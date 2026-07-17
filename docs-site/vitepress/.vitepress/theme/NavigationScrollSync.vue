<script setup>
import {nextTick, onBeforeUnmount, onMounted} from 'vue';
import {onContentUpdated} from 'vitepress';

const navigationTargets = [
  {
    activeItem: '.VPDocAsideOutline .outline-link.active',
    scrollPanel: '.aside-container',
  },
  {
    activeItem: '.VPSidebar .VPSidebarItem.is-active > .item',
    scrollPanel: '.VPSidebar',
  },
];

let animationFrame;
let observers = [];

function getVisibleBounds(panel) {
  const panelBounds = panel.getBoundingClientRect();
  const documentStyles = getComputedStyle(document.documentElement);
  const navHeight = Number.parseFloat(
    documentStyles.getPropertyValue('--vp-nav-height'),
  ) || 0;

  return {
    top: panelBounds.top + navHeight + 16,
    bottom: panelBounds.bottom - 32,
  };
}

function keepActiveItemVisible({activeItem, scrollPanel}) {
  const item = document.querySelector(activeItem);
  const panel = item?.closest(scrollPanel) ?? document.querySelector(scrollPanel);

  if (!item || !panel) return;

  const itemBounds = item.getBoundingClientRect();
  const visibleBounds = getVisibleBounds(panel);
  let scrollOffset = 0;

  if (itemBounds.top < visibleBounds.top) {
    scrollOffset = itemBounds.top - visibleBounds.top;
  } else if (itemBounds.bottom > visibleBounds.bottom) {
    scrollOffset = itemBounds.bottom - visibleBounds.bottom;
  }

  if (!scrollOffset) return;

  const prefersReducedMotion = window.matchMedia(
    '(prefers-reduced-motion: reduce)',
  ).matches;

  panel.scrollBy({
    top: scrollOffset,
    behavior: prefersReducedMotion ? 'auto' : 'smooth',
  });
}

function syncNavigation() {
  cancelAnimationFrame(animationFrame);
  animationFrame = requestAnimationFrame(() => {
    navigationTargets.forEach(keepActiveItemVisible);
  });
}

function observeNavigation() {
  observers.forEach((observer) => observer.disconnect());
  observers = [];

  navigationTargets.forEach(({scrollPanel}) => {
    const panel = document.querySelector(scrollPanel);
    if (!panel) return;

    const observer = new MutationObserver(syncNavigation);
    observer.observe(panel, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });
    observers.push(observer);
  });

  syncNavigation();
}

onMounted(() => nextTick(observeNavigation));
onContentUpdated(() => nextTick(observeNavigation));

onBeforeUnmount(() => {
  cancelAnimationFrame(animationFrame);
  observers.forEach((observer) => observer.disconnect());
});
</script>

<template></template>
