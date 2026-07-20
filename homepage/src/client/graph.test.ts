import { describe, expect, it } from 'vitest';
import { toBrailleGraph, toBrailleGraphRows } from './graph.js';

describe('braille graph', () => {
  it('renders one dense braille cell per requested sample', () => {
    const graph = toBrailleGraph([0, 25, 50, 75, 100]);
    expect([...graph]).toHaveLength(5);
    expect(graph[4]).toBe('⣿');
  });

  it('scales vertically using four dot levels for each graph row', () => {
    const rows = toBrailleGraphRows([0, 25, 50, 75, 100], 12, 6);
    expect(rows).toHaveLength(6);
    expect(rows.every((row) => [...row].length === 12)).toBe(true);
    expect(rows.join('')).toContain('⣿');
  });

  it('clamps out-of-range values without producing missing glyphs', () => {
    const graph = toBrailleGraph([-10, 110]);
    expect([...graph]).toHaveLength(2);
    expect(graph).not.toContain('undefined');
    expect(graph.at(-1)).not.toBe('⠀');
  });
});
