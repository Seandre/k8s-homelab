// btop's braille renderer maps two adjacent samples into one cell and repeats
// that work for every graph row. Each text row therefore adds four vertical
// dot levels, instead of reducing the entire graph to a single glyph row.
const brailleUp = [
  ' ', '⢀', '⢠', '⢰', '⢸',
  '⡀', '⣀', '⣠', '⣰', '⣸',
  '⡄', '⣄', '⣤', '⣴', '⣼',
  '⡆', '⣆', '⣦', '⣶', '⣾',
  '⡇', '⣇', '⣧', '⣷', '⣿',
];

function clampPercent(value: number) {
  return Math.min(100, Math.max(0, value));
}

function resample(values: number[], count: number) {
  if (values.length === 0) return [];
  if (count === 1) return [values[0]!];
  return Array.from({ length: count }, (_, index) => {
    const position = index / (count - 1) * (values.length - 1);
    const lower = Math.floor(position);
    const upper = Math.ceil(position);
    const progress = position - lower;
    return values[lower]! + ((values[upper]! - values[lower]!) * progress);
  });
}

function toBrailleLevel(value: number, high: number, low: number) {
  if (value >= high) return 4;
  if (value <= low) return 0;
  return Math.min(4, Math.max(0, Math.round(((value - low) * 4 / (high - low)) + 0.1)));
}

export function toBrailleGraphRows(values: number[], cells = values.length, height = 1): string[] {
  if (cells <= 0 || values.length === 0) return [];
  const samples = resample(values, cells * 2);
  return Array.from({ length: height }, (_, row) => {
    const high = Math.round(100 * (height - row) / height);
    const low = Math.round(100 * (height - (row + 1)) / height);
    return Array.from({ length: cells }, (_, cell) => {
      const left = toBrailleLevel(clampPercent(samples[cell * 2]!), high, low);
      const right = toBrailleLevel(clampPercent(samples[(cell * 2) + 1]!), high, low);
      return brailleUp[(left * 5) + right]!;
    }).join('');
  });
}

export function toBrailleGraph(values: number[], cells = values.length): string {
  return toBrailleGraphRows(values, cells)[0] ?? '';
}
