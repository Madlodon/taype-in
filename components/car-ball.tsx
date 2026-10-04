import { useId } from "react";
import type { Loadout } from "@/lib/garage-items";

// Même coque et mêmes panneaux pour les finitions du ballon.
const FINISHES = {
  none: { shell: "#d5d8cd", shadow: "#687775", panel: "#b3b9b8", dark: "#626d70", edge: "#c3ceca", light: "#b9f5ff" },
  emerald: { shell: "#e9fff3", shadow: "#658c79", panel: "#26956b", dark: "#073f32", edge: "#52bd91", light: "#69ffb0" },
  glacier: { shell: "#edf9ff", shadow: "#638ba7", panel: "#328ac5", dark: "#103c6e", edge: "#83d5ff", light: "#b5f6ff" },
  solar: { shell: "#707982", shadow: "#232b38", panel: "#f5a345", dark: "#a34217", edge: "#ffcf84", light: "#ffe5ac" },
  gold: { shell: "#f5cd61", shadow: "#7b430d", panel: "#f8d16a", dark: "#875018", edge: "#ffe59a", light: "#fff1b5" },
};
export function CarBall({ ball }: { ball: Loadout["ball"] }) {
  const id = useId().replaceAll(":", "");
  const finish = FINISHES[ball === "beach" ? "none" : ball];
  const isGold = ball === "gold";
  const shell = `${id}-ball-shell`;
  const panel = `${id}-ball-panel`;
  const accent = finish.light;
  const mesh = `${id}-ball-mesh`;
  const shade = `${id}-ball-shade`;

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
            <stop stopColor={isGold ? "#fff8d6" : "#ffffff"} />
            {isGold && <>
              <stop offset=".28" stopColor="#ffe99a" />
              <stop offset=".43" stopColor="#b47a20" />
            </>}
            <stop offset=".55" stopColor={finish.shell} />
            <stop offset="1" stopColor={finish.shadow} />
          </radialGradient>
          <linearGradient id={panel} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor={finish.panel} />
            {isGold && <>
              <stop offset=".28" stopColor="#fff2b4" />
              <stop offset=".46" stopColor="#dba43b" />
              <stop offset=".56" stopColor="#986019" />
              <stop offset=".7" stopColor="#efbd50" />
            </>}
            <stop offset="1" stopColor={finish.dark} />
          </linearGradient>
          <pattern id={mesh} width="1.5" height="2.6" patternUnits="userSpaceOnUse">
            <path d="M.75 0 L1.5.43 V1.3 L.75 1.73 L0 1.3 V.43Z M.75 1.73 V2.6" fill="none" stroke={isGold ? "#754313" : "#122b30"} strokeWidth=".13" opacity=".5" />
          </pattern>
          <radialGradient id={shade} cx="32%" cy="25%" r="75%">
            <stop offset=".35" stopColor="#fff" stopOpacity=".12" />
            <stop offset=".75" stopColor={isGold ? "#3d2009" : "#07151e"} stopOpacity=".08" />
            <stop offset="1" stopColor={isGold ? "#3d2009" : "#07151e"} stopOpacity=".6" />
          </radialGradient>
        </defs>
        <circle r="16" fill={`url(#${shell})`} stroke={isGold ? "#694115" : "#354347"} strokeWidth=".7" />
        {/* Panneaux blindés biseautés, joints profonds et points lumineux. */}
        <g fill={`url(#${panel})`} stroke={isGold ? "#664018" : "#293b40"} strokeWidth="1.15" strokeLinejoin="round">
          <path d="M-5-7 L4-8 L9-1 L5 7 L-4 8 L-9 1Z" />
          <path d="M-8-13 L-4-15.5 L3-15.6 L6-12 L3-10 L-5-10Z" />
          <path d="M12-9 L15-5 L16 1 L12 4 L11-1 L8-6Z" />
          <path d="M10 10 L6 14 L0 16 L-2 12 L-1 10 L6 9Z" />
          <path d="M-13 9 L-15 5 L-16-1 L-12-4 L-11 2 L-9 6Z" />
        </g>
        <g fill={`url(#${mesh})`}>
          <path d="M-5-7 L4-8 L9-1 L5 7 L-4 8 L-9 1Z M-8-13 L-4-15.5 L3-15.6 L6-12 L3-10 L-5-10Z M12-9 L15-5 L16 1 L12 4 L11-1 L8-6Z M10 10 L6 14 L0 16 L-2 12 L-1 10 L6 9Z M-13 9 L-15 5 L-16-1 L-12-4 L-11 2 L-9 6Z" />
        </g>
        <g fill="none" stroke={isGold ? "#a1702d" : "#65716e"} strokeWidth=".5">
          <path d="M-5-7 L-5-10 M4-8 L3-10 M9-1 L11-1 M5 7 L6 9 M-4 8 L-2 12 M-9 1 L-11 2" />
          <path d="M-8-13 L-11-9 L-12-4 M6-12 L10-10 L12-9 M12 4 L12 7 L10 10 M-13 9 L-8 12 L-2 12" />
          <path d="M-4-5 L3-6 L6-1 L3 5 L-3 6 L-6 1Z" stroke={finish.edge} />
        </g>
        <path d="M-4-5 L3-6 L6-1" fill="none" stroke={isGold ? "#fff4c4" : "#eafff4"} strokeWidth=".6" opacity=".65" />
        <g fill={isGold ? "#614019" : "#263b40"} stroke={isGold ? "#d5a34c" : "#a0aaa4"} strokeWidth=".45">
          <path d="M-9.8-9.6 L-7.1-11 L-5.1-8.6 L-7-6.1 L-9.7-7Z" />
          <path d="M9 3.4 L11.6 3.3 L13 5.5 L11.7 7.7 L9.2 7.4 L8.3 5.5Z" />
          <path d="M-8.4 9.4 L-6.2 8.3 L-3.8 9.6 L-4.2 11.8 L-6.5 12.8 L-8.5 11.4Z" />
        </g>
        <g fill={accent} opacity=".22">
          <circle cx="-7.5" cy="-8.5" r="2.2" />
          <circle cx="10.7" cy="5.6" r="2.1" />
          <circle cx="-6" cy="10.5" r="2" />
        </g>
        <g fill={accent}>
          <circle cx="-7.5" cy="-8.5" r="1" />
          <circle cx="10.7" cy="5.6" r=".9" />
          <circle cx="-6" cy="10.5" r=".85" />
        </g>
        <g fill="#fff">
          <circle cx="-7.8" cy="-8.8" r=".6" />
          <circle cx="10.4" cy="5.3" r=".5" />
          <circle cx="-6.3" cy="10.2" r=".5" />
        </g>
        <circle r="15.7" fill={`url(#${shade})`} />
        <path d="M-12-7 A14 14 0 0 1 -1-14" fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" opacity=".7" />
      </>}
    </g>
  );
}
