"use client";
import { Candle } from "@/modules/market-data/providers/MarketDataProvider";

interface Props {
  candles: Candle[];
  levels?: { entry?: number; stopLoss?: number; target?: number };
  height?: number;
}

const W = 340;

export default function CandlestickChart({ candles, levels, height = 200 }: Props) {
  if (candles.length === 0) {
    return <div className="text-sub text-xs text-center py-10">Loading chart…</div>;
  }

  const volH = 36;
  const chartH = height - volH - 8;
  const pad = 6;
  const n = candles.length;
  const candleW = (W - pad * 2) / n;

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const levelVals = [levels?.entry, levels?.stopLoss, levels?.target].filter((v): v is number => v != null);
  const maxPrice = Math.max(...highs, ...levelVals);
  const minPrice = Math.min(...lows, ...levelVals);
  const priceRange = maxPrice - minPrice || 1;

  const maxVol = Math.max(...candles.map((c) => c.volume));

  const yForPrice = (p: number) => pad + (1 - (p - minPrice) / priceRange) * (chartH - pad * 2);
  const xForIndex = (i: number) => pad + i * candleW;

  return (
    <svg viewBox={`0 0 ${W} ${height}`} width="100%" height={height} className="block">
      {/* grid lines */}
      {[0.25, 0.5, 0.75].map((f) => (
        <line key={f} x1={0} x2={W} y1={pad + f * (chartH - pad * 2)} y2={pad + f * (chartH - pad * 2)} stroke="#232B38" strokeWidth={0.5} />
      ))}

      {/* candles */}
      {candles.map((c, i) => {
        const x = xForIndex(i);
        const up = c.close >= c.open;
        const color = up ? "#3ECF8E" : "#FF5C5C";
        const bodyTop = yForPrice(Math.max(c.open, c.close));
        const bodyBottom = yForPrice(Math.min(c.open, c.close));
        return (
          <g key={c.timestamp}>
            <line x1={x + candleW / 2} x2={x + candleW / 2} y1={yForPrice(c.high)} y2={yForPrice(c.low)} stroke={color} strokeWidth={1} />
            <rect
              x={x + candleW * 0.15}
              y={bodyTop}
              width={candleW * 0.7}
              height={Math.max(1, bodyBottom - bodyTop)}
              fill={color}
            />
          </g>
        );
      })}

      {/* AI level overlays */}
      {levels?.entry != null && <LevelLine y={yForPrice(levels.entry)} color="#E8A33D" label={`Entry ${levels.entry.toFixed(0)}`} />}
      {levels?.stopLoss != null && <LevelLine y={yForPrice(levels.stopLoss)} color="#FF5C5C" label={`SL ${levels.stopLoss.toFixed(0)}`} />}
      {levels?.target != null && <LevelLine y={yForPrice(levels.target)} color="#3ECF8E" label={`Target ${levels.target.toFixed(0)}`} />}

      {/* volume */}
      {candles.map((c, i) => {
        const x = xForIndex(i);
        const up = c.close >= c.open;
        const vh = (c.volume / maxVol) * volH;
        return (
          <rect
            key={"v" + c.timestamp}
            x={x + candleW * 0.15}
            y={height - vh}
            width={candleW * 0.7}
            height={vh}
            fill={up ? "#3ECF8E" : "#FF5C5C"}
            opacity={0.35}
          />
        );
      })}
    </svg>
  );
}

function LevelLine({ y, color, label }: { y: number; color: string; label: string }) {
  return (
    <g>
      <line x1={0} x2={W} y1={y} y2={y} stroke={color} strokeWidth={1} strokeDasharray="4 3" opacity={0.8} />
      <text x={W - 4} y={y - 3} fontSize={8} fill={color} textAnchor="end" fontFamily="monospace">
        {label}
      </text>
    </g>
  );
}
