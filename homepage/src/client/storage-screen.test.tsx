import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { StorageScreen } from './storage-screen.js';

describe('Storage fixture view', () => {
  it('has no write-capable backup controls and shows every state category', () => {
    const markup = renderToStaticMarkup(<StorageScreen />);
    expect(markup).toContain('HEALTHY');
    expect(markup).toContain('OLD');
    expect(markup).toContain('FAILED');
    expect(markup).toContain('Unreachable');
    expect(markup).toContain('NO DATA');
    expect(markup).not.toContain('Start backup');
    expect(markup).not.toContain('Restore');
  });
});
