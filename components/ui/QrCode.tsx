import { colors } from "@/lib/theme";

/**
 * A decorative, deterministic QR-like pattern (not a scannable code — this is a
 * prototype). Ported from the design's `makeQr()`.
 */
export function QrCode() {
  const n = 25;
  const cell = 6;
  const dark = colors.bg;
  const rects: React.ReactNode[] = [];

  const drawFinder = (ox: number, oy: number) => {
    for (let y = 0; y < 7; y++) {
      for (let x = 0; x < 7; x++) {
        const edge = x === 0 || y === 0 || x === 6 || y === 6;
        const core = x >= 2 && x <= 4 && y >= 2 && y <= 4;
        if (edge || core) {
          rects.push(
            <rect key={`f${ox}-${oy}-${x}-${y}`} x={(ox + x) * cell} y={(oy + y) * cell} width={cell} height={cell} fill={dark} />,
          );
        }
      }
    }
  };

  const inFinder = (x: number, y: number) =>
    (x < 8 && y < 8) || (x > n - 9 && y < 8) || (x < 8 && y > n - 9);

  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (inFinder(x, y)) continue;
      if ((x * 7 + y * 5 + x * y) % 3 === 0) {
        rects.push(<rect key={`${x}-${y}`} x={x * cell} y={y * cell} width={cell} height={cell} fill={dark} />);
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(n - 7, 0);
  drawFinder(0, n - 7);

  const dim = n * cell;
  return (
    <svg width={dim} height={dim} viewBox={`0 0 ${dim} ${dim}`} style={{ display: "block" }}>
      {rects}
    </svg>
  );
}
