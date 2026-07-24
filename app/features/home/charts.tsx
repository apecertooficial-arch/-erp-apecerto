"use client";

// Gráficos SVG compartilhados (dataviz): marcas finas, pontas 4px, rótulos diretos.

export function VBars({ data, fmt = (v: number) => String(v) }: { data: { label: string; value: number }[]; fmt?: (v: number) => string }) {
  const w = 580, h = 240, pad = 30;
  const bw = (w - pad * 2) / Math.max(1, data.length);
  const max = Math.max(1, ...data.map((d) => d.value));
  return <svg viewBox={`0 0 ${w} ${h}`} className="dv-chart" role="img">
    <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} className="dv-base" />
    {data.map((d, i) => {
      const bh = (h - pad * 2) * (d.value / max); const x = pad + i * bw; const y = h - pad - bh;
      return <g key={i}>
        <rect x={x + 4} y={y} width={Math.max(2, bw - 8)} height={Math.max(2, bh)} rx="4" fill="#E8620E"><title>{d.label}: {fmt(d.value)}</title></rect>
        {i % 2 === 0 && <text x={x + bw / 2} y={h - pad + 15} textAnchor="middle" className="dv-axis">{d.label}</text>}
        {d.value > 0 && <text x={x + bw / 2} y={y - 5} textAnchor="middle" className="dv-val">{fmt(d.value)}</text>}
      </g>;
    })}
  </svg>;
}

export function HBars({ data, colors, fmt = (v: number) => String(v) }: { data: { label: string; value: number; sub?: number }[]; colors?: string[]; fmt?: (v: number) => string }) {
  const w = 580, rowH = 40, pad = 10;
  const h = data.length * rowH + pad * 2;
  const max = Math.max(1, ...data.map((d) => d.value));
  const labelW = 130, barX = labelW + 10, barMax = w - barX - 100;
  return <svg viewBox={`0 0 ${w} ${h}`} className="dv-chart" role="img">
    {data.map((d, i) => {
      const y = pad + i * rowH; const bw = barMax * (d.value / max); const col = (colors && colors[i]) || "#E8620E";
      const sub = d.sub != null && d.sub > 0 ? barMax * (d.sub / max) : 0;
      return <g key={i}>
        <text x={labelW} y={y + rowH / 2} textAnchor="end" dominantBaseline="middle" className="dv-lbl">{d.label}</text>
        <rect x={barX} y={y + 9} width={Math.max(3, bw)} height={rowH - 20} rx="4" fill={col}><title>{d.label}: {fmt(d.value)}</title></rect>
        {sub > 0 && <rect x={barX} y={y + 9} width={Math.max(3, sub)} height={rowH - 20} rx="4" fill="#E5484D"><title>{d.label}: {d.sub} parados</title></rect>}
        <text x={barX + Math.max(3, bw) + 8} y={y + rowH / 2} dominantBaseline="middle" className="dv-val">{fmt(d.value)}{d.sub != null && d.sub > 0 ? ` · ${d.sub} parados` : ""}</text>
      </g>;
    })}
  </svg>;
}
