// A Braille cell holds two 4-dot columns. These bit masks fill each column
// from the bottom upward, so every non-zero bar is contiguous with its base.
const leftColumnMasks = [0, 1 << 6, (1 << 6) | (1 << 2), (1 << 6) | (1 << 2) | (1 << 1), (1 << 6) | (1 << 2) | (1 << 1) | 1];
const rightColumnMasks = [0, 1 << 7, (1 << 7) | (1 << 5), (1 << 7) | (1 << 5) | (1 << 4), (1 << 7) | (1 << 5) | (1 << 4) | (1 << 3)];

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function dotsInRow(value: number, row: number, height: number) {
  const totalDots = height * 4;
  const filledDots = Math.ceil((clampPercent(value) / 100) * totalDots);
  const dotsBelowRow = (height - row - 1) * 4;
  return Math.min(4, Math.max(0, filledDots - dotsBelowRow));
}

function toBrailleCell(left: number, right: number) {
  return String.fromCodePoint(0x2800 + leftColumnMasks[left]! + rightColumnMasks[right]!);
}

export function toBrailleGraphRows(values: number[], cells = values.length, height = 1): string[] {
  if (cells <= 0 || values.length === 0) return [];
  const sampleCapacity = cells * 2;
  const visibleValues = values.slice(-sampleCapacity);
  // A cell contains two horizontal samples. Pad the incomplete history on the
  // left so the newest sample always enters at the far right; once the window
  // is full, each subsequent sample shifts every older sample one dot left.
  const samples = [
    ...Array<number>(sampleCapacity - visibleValues.length).fill(0),
    ...visibleValues,
  ];
  return Array.from({ length: height }, (_, row) => {
    return Array.from({ length: cells }, (_, cell) => {
      const left = dotsInRow(samples[cell * 2]!, row, height);
      const right = dotsInRow(samples[(cell * 2) + 1]!, row, height);
      return toBrailleCell(left, right);
    }).join('');
  });
}

export function toBrailleGraph(values: number[], cells = values.length): string {
  // The single-row helper historically treats each value as a complete cell.
  // Keep that compact API while the scrolling row renderer works in half-cell
  // sample columns.
  return toBrailleGraphRows(values.flatMap((value) => [value, value]), cells)[0] ?? '';
}

export function toMirroredBrailleGraphRows(upload: number[], download: number[], cells: number, height: number) {
  const ceiling = Math.max(...upload, ...download, 1);
  const normalize = (values: number[]) => values.map((value) => (value / ceiling) * 100);

  return {
    // The normal renderer grows from its final row upward, which places upload
    // directly above the shared baseline. Reversing the download rows makes
    // its bars grow away from that same baseline instead.
    upload: toBrailleGraphRows(normalize(upload), cells, height),
    download: toBrailleGraphRows(normalize(download), cells, height).reverse(),
  };
}
