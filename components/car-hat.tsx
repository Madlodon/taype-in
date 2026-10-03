import { useId } from "react";
import type { Loadout } from "@/lib/garage-items";

export function CarHat({ hat, body }: Pick<Loadout, "hat"> & { body: Loadout["car"] }) {
  const id = useId().replaceAll(":", "");
  if (hat === "none") return null;
  const paint = (name: string) => `url(#${id}-${name})`;

  return <g data-item={hat} transform={`translate(-6 ${{ octane: -15, fennec: -21, dominus: -16, merc: -29 }[body]})`}>
    <defs>
      <linearGradient id={`${id}-gold`} x1="0" y1="0" x2="1" y2=".7">
        <stop stopColor="#80501a" /><stop offset=".28" stopColor="#efbd4e" /><stop offset=".48" stopColor="#fff0a0" /><stop offset=".68" stopColor="#d69b27" /><stop offset="1" stopColor="#805016" />
      </linearGradient>
      <linearGradient id={`${id}-brim`} x2="0" y2="1">
        <stop stopColor="#ffe698" /><stop offset=".5" stopColor="#d9a036" /><stop offset="1" stopColor="#754311" />
      </linearGradient>
      <linearGradient id={`${id}-felt`}>
        <stop stopColor="#11131a" /><stop offset=".32" stopColor="#535768" /><stop offset=".55" stopColor="#303440" /><stop offset="1" stopColor="#101119" />
      </linearGradient>
      <linearGradient id={`${id}-ribbon`}>
        <stop stopColor="#451522" /><stop offset=".4" stopColor="#b84050" /><stop offset="1" stopColor="#591624" />
      </linearGradient>
      <linearGradient id={`${id}-cloth`}>
        <stop stopColor="#252256" /><stop offset=".35" stopColor="#7278c1" /><stop offset=".65" stopColor="#494880" /><stop offset="1" stopColor="#242043" />
      </linearGradient>
    </defs>
    <ellipse cy=".4" rx="13" ry="2" fill="#080b14" opacity=".4" />
    {hat === "cone" && <>
      <rect x="-11" y="-3" width="22" height="4" rx="1" fill="#f97316" />
      <path d="M-7-3 L-2-26 L2-26 L7-3Z" fill="#f97316" />
      <path d="M-5.3-10 L5.3-10 L4.4-15 L-4.4-15Z" fill="#fff" />
    </>}
    {hat === "alpha-cap" && <g transform="rotate(-9 0 -3)" strokeLinejoin="round">
      <path d="M-12-5 Q-21-5-26-1 Q-21 3-8 0 L9-3Z" fill={paint("brim")} stroke="#91601f" strokeWidth=".7" />
      <path d="M-25-1 Q-17 1-9-2" fill="none" stroke="#ffde81" strokeWidth=".6" />
      <path d="M-13-4 Q-15-21-2-23 Q12-24 14-8 L13-3 Q1 1-13-4Z" fill={paint("gold")} stroke="#91601f" strokeWidth=".7" />
      <path d="M-2-22 Q-8-16-7-5 M-1-22 Q7-18 8-5" fill="none" stroke="#9b6b24" strokeWidth=".5" opacity=".7" />
      <path d="M-12-5 Q0-1 13-5" fill="none" stroke="#ffe99c" strokeWidth=".7" />
      <ellipse cx="-2" cy="-23" rx="2" ry=".9" fill="#fce18a" stroke="#ac7929" strokeWidth=".5" />
      <text x="-4.5" y="-10" fontFamily="Arial, sans-serif" fontSize="5" fontWeight="900" letterSpacing="-.2" fill="#81541b" stroke="#ffe797" strokeWidth=".16" paintOrder="stroke">ALPHA</text>
      <path d="M-11-14 Q-10-19-6-20" fill="none" stroke="#fff4b6" strokeWidth=".8" opacity=".7" />
      <circle cx="10" cy="-14" r=".55" fill="#80531e" />
    </g>}
    {hat === "top-hat" && <g stroke="#15151d" strokeWidth=".7">
      <ellipse cy="-2.5" rx="20" ry="4.5" fill={paint("felt")} />
      <path d="M-12-27 Q0-30 12-27 L10-5 Q0-1-10-5Z" fill={paint("felt")} />
      <ellipse cy="-27" rx="12" ry="3" fill="#373b48" />
      <path d="M-11-26 Q0-23 11-26" fill="none" stroke="#848999" strokeWidth=".5" />
      <path d="M-10.5-11 Q0-8 10.5-11 L10-5 Q0-2-10-5Z" fill={paint("ribbon")} stroke="#421726" />
      <path d="M-8-23-7-13" stroke="#8f94a4" opacity=".35" />
      <path d="M-18-2 Q0 3 18-2" fill="none" stroke="#6d7180" strokeWidth=".5" />
    </g>}
    {hat === "pirate" && <g strokeLinejoin="round">
      <path d="M-14-6 Q-15-22 0-24 Q13-22 14-6Z" fill={paint("felt")} stroke="#15151d" strokeWidth=".8" />
      <path d="M-24-13 Q-19-8-12-13 L-3-20 Q0-23 4-20 L13-13 Q19-9 24-14 L19-2 Q0 2-19-2Z" fill={paint("felt")} stroke="#1a1516" strokeWidth="1" />
      <path d="M-22-12 Q-17-7-11-12 L-2-19 Q0-21 3-19 L12-12 Q18-8 22-12" fill="none" stroke="#c7a777" strokeWidth="1.3" />
      <path d="M-18-3 Q0 0 18-3" fill="none" stroke="#8f7351" strokeWidth=".65" />
      <g fill="#efe7cd" stroke="#efe7cd" strokeWidth="1" strokeLinecap="round">
        <path d="m-4-7 8 4 m-8 0 8-4" />
        <path d="M-3-12 Q0-15 3-12 L2.5-9 1-8 H-1 L-2.5-9Z" strokeWidth=".5" />
        <path d="M-1-9 V-7.5 M1-9 V-7.5" strokeWidth=".6" />
      </g>
      <circle cx="-1.2" cy="-11" r=".8" fill="#24232a" /><circle cx="1.2" cy="-11" r=".8" fill="#24232a" />
    </g>}
    {hat === "wizard" && <g strokeLinejoin="round">
      <ellipse cy="-2" rx="21" ry="4.5" fill={paint("cloth")} stroke="#292442" strokeWidth=".8" />
      <path d="M-13-4 Q-7-15-5-23 Q-3-31 7-30 L3-26 Q5-17 13-4 Q0 1-13-4Z" fill={paint("cloth")} stroke="#2a274d" strokeWidth=".8" />
      <path d="M-10-5 Q-4-16-3-23 Q-2-28 4-29" fill="none" stroke="#b4b6df" strokeWidth=".6" opacity=".5" />
      <path d="M-18-1 Q0 4 18-1" fill="none" stroke="#a7a4d0" strokeWidth=".6" />
      <g fill="#e5cb79" stroke="#aa8948" strokeWidth=".25">
        <path d="m0-23 .8 2 2.2.1-1.7 1.4 .5 2.1L0-18.5-1.8-17.4l.5-2.1L-3-20.9l2.2-.1Z" />
        <path d="m-5-12 .8 1.8 2 .2-1.5 1.3 .4 1.9L-5-7.9-6.7-6.8l.4-1.9-1.5-1.3 2-.2Z" />
        <path d="M5-14 A3 3 0 1 0 8-9 A3.3 3.3 0 0 1 5-14Z" />
        <circle cx="1" cy="-6" r=".6" /><circle cx="-3" cy="-15" r=".5" />
      </g>
    </g>}
  </g>;
}
