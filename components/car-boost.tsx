import { useId, type CSSProperties } from "react";
import type { Loadout } from "@/lib/garage-items";

const COLORS = {
  standard: ["#ff8a24", "#ffd078", "#fff5d8"],
  flames: ["#f04416", "#ffae28", "#fff4bb"],
  ion: ["#6254ff", "#80cbff", "#e9fcff"],
  sparkles: ["#9d62ef", "#edbaff", "#fff3ff"],
  alpha: ["#e98a16", "#ffd844", "#fff5ad"],
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
        {boost === "alpha" && <>
          <linearGradient id={`${id}-gold-rush`} x1="0" x2="1">
            <stop stopColor="#b96010" stopOpacity="0" />
            <stop offset=".16" stopColor={edge} stopOpacity=".65" />
            <stop offset=".42" stopColor="#ffbf28" />
            <stop offset=".78" stopColor={middle} />
            <stop offset="1" stopColor={core} />
          </linearGradient>
          <filter id={`${id}-turbulence`} x="-10%" y="-50%" width="120%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency=".16 .3" numOctaves="2" seed="7" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="5" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </>}
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
        {boost === "alpha" && <>
          {/* Gold Rush : flamme dense et granuleuse, bord ambré et cœur jaune pâle. */}
          <path d="M2-4 C-12-8-26-12-43-10 S-74-13-96-7 L-91 0 L-99 7 Q-72 14-50 10 T-24 9 Q-9 8 2 4Z" fill={edge} opacity=".65" filter={`url(#${id}-soft)`} />
          <g filter={`url(#${id}-turbulence)`}>
            <path d="M2-4 Q-8-5-17-8 L-24-7 L-31-11 L-37-8 L-45-12 L-51-9 L-61-12 L-65-8 L-77-11 L-74-6 L-91-7 L-85-2 L-98 2 L-84 5 L-91 10 L-75 7 L-68 12 L-61 8 L-51 11 L-44 8 L-35 11 L-28 7 L-21 9 Q-9 7 2 4Z" fill={`url(#${id}-gold-rush)`} />
            <path d="M1-3 Q-13-8-21-4 T-36-5 L-44-8 L-43-3 L-58-6 L-54-1 L-73-3 L-65 2 L-80 5 L-61 5 L-53 8 L-47 4 L-37 7 L-29 4 Q-12 8 1 3Z" fill={middle} />
            <path d="M2-2 Q-9-5-19-2 L-25-5 L-28-1 L-41-3 L-36 1 L-53 3 L-39 5 L-28 2 L-19 5 Q-7 3 2 2Z" fill={core} />
            {Array.from({ length: 18 }, (_, i) => <ellipse key={i}
              cx={-11 - (i * 13 % 72)} cy={(i * 7 % 15) - 7}
              rx={2 + i % 3} ry={1.1 + i % 2}
              fill={i % 3 ? core : edge} opacity={i % 3 ? .5 : .65} />)}
          </g>
        </>}
      </g>
      {Array.from({ length: boost === "sparkles" ? 16 : boost === "alpha" ? 20 : 9 }, (_, i) => {
        const x = -8 - (i * 19 % 79);
        const y = ((i * 7 % 17) - 8) * (boost === "ion" ? .4 : 1);
        return <g key={i} className="boost-particle" style={{ "--boost-delay": `${-i * .137}s` } as CSSProperties}>
          {boost === "sparkles"
            ? <path d={`M${x} ${y - 2.5} l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z`} fill={i % 3 ? core : middle} />
            : <ellipse cx={x} cy={y} rx={boost === "ion" ? 2 : 1.2} ry=".65" fill={boost === "alpha" && i % 3 === 0 ? edge : i % 2 ? middle : core} />}
        </g>;
      })}
      <ellipse cx="-1" rx="6" ry="5" fill={`url(#${id}-glow)`} />
      <ellipse cx="0" rx="2.5" ry="2" fill={core} />
    </g>
  );
}
