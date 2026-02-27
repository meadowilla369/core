/**
 * A visually realistic QR code simulation using SVG.
 * Renders a deterministic pattern based on the input value.
 * For production, replace with actual qrcode.react library.
 */

interface QRCodeDisplayProps {
  value: string;
  size?: number;
  className?: string;
}

function seededRandom(seed: string, index: number): boolean {
  let hash = 0;
  const str = seed + index.toString();
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return (hash & 1) === 1;
}

export function QRCodeDisplay({ value, size = 240, className = "" }: QRCodeDisplayProps) {
  const modules = 29; // Standard QR module count
  const cellSize = size / modules;

  // Generate module matrix
  const matrix: boolean[][] = Array.from({ length: modules }, (_, row) =>
    Array.from({ length: modules }, (_, col) => {
      // Finder patterns (top-left, top-right, bottom-left corners)
      if (isFinderPattern(row, col, modules)) return isFinderPatternFilled(row, col, modules);
      // Timing patterns
      if (row === 6 || col === 6) return (row + col) % 2 === 0;
      // Data modules - deterministic based on value
      return seededRandom(value, row * modules + col);
    })
  );

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* White background */}
      <rect width={size} height={size} fill="white" />

      {/* QR modules */}
      {matrix.map((row, rowIdx) =>
        row.map((filled, colIdx) =>
          filled ? (
            <rect
              key={`${rowIdx}-${colIdx}`}
              x={colIdx * cellSize}
              y={rowIdx * cellSize}
              width={cellSize}
              height={cellSize}
              fill="#111"
            />
          ) : null
        )
      )}

      {/* Finder pattern overlays for clean corners */}
      {/* Top-left */}
      <rect x={0} y={0} width={cellSize * 7} height={cellSize * 7} fill="none" stroke="#111" strokeWidth={cellSize} />
      <rect x={cellSize * 2} y={cellSize * 2} width={cellSize * 3} height={cellSize * 3} fill="#111" />

      {/* Top-right */}
      <rect x={cellSize * (modules - 7)} y={0} width={cellSize * 7} height={cellSize * 7} fill="none" stroke="#111" strokeWidth={cellSize} />
      <rect x={cellSize * (modules - 5)} y={cellSize * 2} width={cellSize * 3} height={cellSize * 3} fill="#111" />

      {/* Bottom-left */}
      <rect x={0} y={cellSize * (modules - 7)} width={cellSize * 7} height={cellSize * 7} fill="none" stroke="#111" strokeWidth={cellSize} />
      <rect x={cellSize * 2} y={cellSize * (modules - 5)} width={cellSize * 3} height={cellSize * 3} fill="#111" />
    </svg>
  );
}

function isFinderPattern(row: number, col: number, modules: number): boolean {
  return (
    (row < 8 && col < 8) ||
    (row < 8 && col >= modules - 8) ||
    (row >= modules - 8 && col < 8)
  );
}

function isFinderPatternFilled(row: number, col: number, modules: number): boolean {
  // Top-left
  if (row < 8 && col < 8) return isFinderBlock(row, col);
  // Top-right
  if (row < 8 && col >= modules - 8) return isFinderBlock(row, col - (modules - 7));
  // Bottom-left
  if (row >= modules - 8 && col < 8) return isFinderBlock(row - (modules - 7), col);
  return false;
}

function isFinderBlock(r: number, c: number): boolean {
  const nr = r % 8;
  const nc = c % 8;
  if (nr === 7 || nc === 7) return false; // Separator
  if (nr === 0 || nr === 6 || nc === 0 || nc === 6) return true; // Outer ring
  if (nr === 1 || nr === 5 || nc === 1 || nc === 5) return false; // Inner white
  return true; // Center block
}
