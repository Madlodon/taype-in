import { useId } from "react";
import type { Loadout } from "@/lib/garage-items";

// Même coque et mêmes panneaux pour le ballon standard et sa finition émeraude.
export function CarBall({ ball }: { ball: Loadout["ball"] }) {
  const id = useId().replaceAll(":", "");
  const emerald = ball === "emerald";
  const shell = `${id}-ball-shell`;
  const panel = `${id}-ball-panel`;
  const accent = emerald ? "#69ffb0" : "#a6e4ff";

  return (
    <g transform="translate(65 -2)" data-item={ball === "none" ? undefined : ball}>
      {ball === "beach" ? <>
        <circle r="16" fill="#f8fafc" stroke="#9bacbf" strokeWidth="2" />
        <path d="M0 0 L0-16 A16 16 0 0 1 13.86-8Z" fill="#ef4444" />
        <path d="M0 0 L13.86 8 A16 16 0 0 1 0 16Z" fill="#3b82f6" />
        <path d="M0 0 L-13.86 8 A16 16 0 0 1 -13.86-8Z" fill="#facc15" />
        <circle r="3" fill="#f8fafc" />
      </> : <>
        <defs>
          <radialGradient id={shell} cx="30%" cy="24%" r="78%">
            <stop stopColor="#ffffff" />
            <stop offset=".55" stopColor={emerald ? "#e9fff3" : "#e3edf1"} />
            <stop offset="1" stopColor={emerald ? "#658c79" : "#74858c"} />
          </radialGradient>
          <linearGradient id={panel} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={emerald ? "#26956b" : "#536673"} />
            <stop offset="1" stopColor={emerald ? "#073f32" : "#1e2b35"} />
          </linearGradient>
        </defs>
        <circle r="16" fill={`url(#${shell})`} stroke="#263e3b" strokeWidth="1" />
        {/* Panneaux blindés biseautés, joints profonds et points lumineux. */}
        <g fill={`url(#${panel})`} stroke="#233c38" strokeWidth=".8" strokeLinejoin="round">
          <path d="M-5-7 L4-8 L9-1 L5 7 L-4 8 L-9 1Z" />
          <path d="M-8-13 L-4-15.5 L3-15.6 L6-12 L3-10 L-5-10Z" />
          <path d="M12-9 L15-5 L16 1 L12 4 L11-1 L8-6Z" />
          <path d="M10 10 L6 14 L0 16 L-2 12 L-1 10 L6 9Z" />
          <path d="M-13 9 L-15 5 L-16-1 L-12-4 L-11 2 L-9 6Z" />
        </g>
        <g fill="none" stroke="#516c64" strokeWidth=".7">
          <path d="M-5-7 L-5-10 M4-8 L3-10 M9-1 L11-1 M5 7 L6 9 M-4 8 L-2 12 M-9 1 L-11 2" />
          <path d="M-8-13 L-11-9 L-12-4 M6-12 L10-10 L12-9 M12 4 L12 7 L10 10 M-13 9 L-8 12 L-2 12" />
          <path d="M-4-5 L3-6 L6-1 L3 5 L-3 6 L-6 1Z" stroke={emerald ? "#52bd91" : "#81959e"} />
        </g>
        <path d="M-4-5 L3-6 L6-1" fill="none" stroke="#eafff4" strokeWidth=".6" opacity=".65" />
        <g fill={accent}>
          <circle cx="-7.5" cy="-8.5" r="1.5" />
          <circle cx="10.7" cy="5.6" r="1.4" />
          <circle cx="-6" cy="10.5" r="1.3" />
        </g>
        <g fill="#fff">
          <circle cx="-7.8" cy="-8.8" r=".6" />
          <circle cx="10.4" cy="5.3" r=".5" />
          <circle cx="-6.3" cy="10.2" r=".5" />
        </g>
        <path d="M-12-7 A14 14 0 0 1 -1-14" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
      </>}
    </g>
  );
}
