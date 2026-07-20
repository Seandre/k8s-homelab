import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NetworkScreen } from './network.js';

describe('Network fixture view', () => {
  it('renders read-only protocol-labeled latency and planned endpoint states', () => {
    const markup = renderToStaticMarkup(<NetworkScreen />);
    expect(markup).toContain('GATEWAY / ICMP');
    expect(markup).toContain('INTERNET / HTTPS');
    expect(markup).toContain('NOT SUPPORTED');
    expect(markup).toContain('NOT PROVISIONED');
    expect(markup).not.toContain('Run speed test');
  });
});
