import { useId, type CSSProperties } from "react";
import type { Loadout } from "@/lib/garage-items";

const COLORS = {
  standard: ["#ff8a24", "#ffd078", "#fff5d8"],
  flames: ["#f04416", "#ffae28", "#fff4bb"],
  ion: ["#6254ff", "#80cbff", "#e9fcff"],
  sparkles: ["#9d62ef", "#edbaff", "#fff3ff"],
} as const;

export function CarBoost({ boost }: { boost: Loadout["boost"] }) {
  const id = useId().replaceAll(":", "");
  const [edge, middle, core] = COLORS[boost];
  return (
    <g data-item={boost} className={`car-boost car-boost-${boost}`} transform="translate(-36 8)">
      <defs>
        <linearGradient id={`${id}-jet`} x1="0" x2="1">
          <stop stopColor={edge} stopOpacity="0" />
          <stop offset=".3" stopColor={edge} stopOpacity=".45" />
          <stop offset=".72" stopColor={middle} stopOpacity=".9" />
          <stop offset="1" stopColor={core} />
        </linearGradient>
        <radialGradient id={`${id}-glow`}>
          <stop stopColor={core} stopOpacity=".8" />
          <stop offset=".35" stopColor={middle} stopOpacity=".5" />
          <stop offset="1" stopColor={edge} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-soft`} x="-30%" y="-100%" width="160%" height="300%">
          <feGaussianBlur stdDeviation="1.6" />
        </filter>
      </defs>
      <ellipse cx="-27" rx="51" ry={boost === "flames" ? 17 : 11} fill={`url(#${id}-glow)`} />
      <g className="boost-plume" fill={`url(#${id}-jet)`}>
        {boost === "standard" && <>
          <path d="M2-4 C-15-9-28-7-43-4 S-72 1-91-2 C-70 9-48 5-31 8 S-10 6 2 4Z" filter={`url(#${id}-soft)`} />
          <path d="M2-3 Q-20-7-40-2 T-78 2 Q-45 8-23 4 L2 3Z" />
          <path d="M0-2 Q-17-3-37 1 Q-15 3 0 2Z" fill={core} />
        </>}
        {boost === "flames" && <>
          <path d="M2-5 C-20-16-27-4-42-14 Q-39-5-54-8 T-95-10 Q-81 0-64 2 L-86 9 Q-61 8-56 15 Q-45 6-31 12 T2 5Z" filter={`url(#${id}-soft)`} />
          <path d="M2-4 Q-15-10-28-4 L-45-9 Q-39-1-59-2 L-78-4 Q-66 4-47 5 L-55 10 Q-34 4-24 7 T2 4Z" />
          <path d="M2-2 Q-12-5-24 0 L-42 2 Q-23 2-15 4 L2 2Z" fill={core} />
        </>}
        {boost === "ion" && <>
          <path d="M2-4 C-24-7-65-4-94 0 C-65 4-24 7 2 4Z" filter={`url(#${id}-soft)`} />
          <path d="M2-2 Q-39-4-87 0 Q-39 4 2 2Z" />
          <path d="M0 0 H-68" stroke={core} strokeWidth="1.3" strokeLinecap="round" />
          {[-13, -29, -45, -61].map((x, i) => <ellipse key={x} cx={x} rx={2 + i * .3} ry={4 - i * .5} fill="none" stroke={middle} strokeWidth=".8" opacity={.8 - i * .15} />)}
        </>}
        {boost === "sparkles" && <>
          <path d="M2-4 Q-33-9-93 0 Q-33 9 2 4Z" opacity=".55" filter={`url(#${id}-soft)`} />
          <path d="M2-2 Q-17-4-48 0 Q-17 4 2 2Z" />
        </>}
      </g>
      {Array.from({ length: boost === "sparkles" ? 16 : 9 }, (_, i) => {
        const x = -8 - (i * 19 % 79);
        const y = ((i * 7 % 17) - 8) * (boost === "ion" ? .4 : 1);
        return <g key={i} className="boost-particle" style={{ "--boost-delay": `${-i * .137}s` } as CSSProperties}>
          {boost === "sparkles"
            ? <path d={`M${x} ${y - 2.5} l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z`} fill={i % 3 ? core : middle} />
            : <ellipse cx={x} cy={y} rx={boost === "ion" ? 2 : 1.2} ry=".65" fill={i % 2 ? middle : core} />}
        </g>;
      })}
      <ellipse cx="-1" rx="6" ry="5" fill={`url(#${id}-glow)`} />
      <ellipse cx="0" rx="2.5" ry="2" fill={core} />
    </g>
  );
}
