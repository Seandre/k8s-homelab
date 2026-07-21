import { describe, expect, it } from 'vitest';
import { toBrailleGraph, toBrailleGraphRows, toMirroredBrailleGraphRows } from './graph.js';

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

  it('fills every dot from the bottom through the top at 100%', () => {
    const rows = toBrailleGraphRows([100, 100], 1, 6);
    expect(rows).toEqual(Array(6).fill('⣿'));
  });

  it('renders partial bars as contiguous bottom-up dots', () => {
    const rows = toBrailleGraphRows([50, 50], 1, 1);
    expect(rows).toEqual(['⣤']);

    const tallRows = toBrailleGraphRows([51, 51], 1, 2);
    expect(tallRows).toEqual(['⣀', '⣿']);
  });

  it('streams new samples in from the right and shifts history left', () => {
    expect(toBrailleGraphRows([100], 2, 1)).toEqual(['⠀⢸']);
    expect(toBrailleGraphRows([100, 0], 2, 1)).toEqual(['⠀⡇']);
    expect(toBrailleGraphRows([100, 0, 0], 2, 1)).toEqual(['⢸⠀']);
    expect(toBrailleGraphRows([100, 0, 0, 0, 100], 2, 1)).toEqual(['⠀⢸']);
  });

  it('clamps out-of-range values without producing missing glyphs', () => {
    const graph = toBrailleGraph([-10, 110]);
    expect([...graph]).toHaveLength(2);
    expect(graph).not.toContain('undefined');
    expect(graph.at(-1)).not.toBe('⠀');
  });

  it('keeps upload above and reverses download below a shared baseline', () => {
    const rows = toMirroredBrailleGraphRows([100], [50], 1, 2);
    expect(rows.upload).toEqual(['⢸', '⢸']);
    expect(rows.download[0]).not.toBe('⠀');
    expect(rows.download[1]).toBe('⠀');
  });
});
