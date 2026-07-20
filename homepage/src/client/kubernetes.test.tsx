import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { KubernetesScreen, OkdScreen } from './kubernetes.js';

describe('Kubernetes fixture views', () => {
  it('renders fixture-backed capacity, node health, and only approved workload links', () => {
    const html = renderToStaticMarkup(<KubernetesScreen />);
    expect(html).toContain('5.4');
    expect(html).toContain('k3s-worker-02');
    expect(html).toContain('koreader-sync');
    expect(html).toContain('https://argocd.lab.seandre.dev');
  });

  it('renders the future OKD state as neutral, not as an error', () => {
    const html = renderToStaticMarkup(<OkdScreen />);
    expect(html).toContain('NOT PROVISIONED');
    expect(html).toContain('RESERVED TOPOLOGY');
    expect(html).not.toContain('ERROR');
  });
});
