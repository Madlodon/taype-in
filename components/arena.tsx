import { useId } from "react";
import { CarBall } from "@/components/car-ball";
import { CarHat } from "@/components/car-hat";
import { CarBoost } from "@/components/car-boost";
import { CarBody } from "@/components/car-body";
import type { Loadout } from "@/lib/garage-items";

// The same route is used by the preview car and its ball: floor, wall, ceiling, goal.
export function arenaPosition(progress: number) {
  const points = [
    [0, 180, 370], [0.36, 780, 370], [0.49, 840, 205],
    [0.59, 765, 140], [0.78, 430, 140], [1, 800, 310],
  ];
  const value = Math.max(0, Math.min(1, progress));
  const end = points.findIndex((point, index) => index > 0 && value <= point[0]);
  const a = points[end - 1];
  const b = points[end];
  const fraction = (value - a[0]) / (b[0] - a[0]);
  return { x: a[1] + (b[1] - a[1]) * fraction, y: a[2] + (b[2] - a[2]) * fraction, angle: Math.atan2(b[2] - a[2], b[1] - a[1]) * 180 / Math.PI };
}

// Le garage (#34) choisit le boost, le chapeau et le ballon ; sans ces props, la voiture de base.
type CarProps = {
  x: number;
  y: number;
  angle?: number;
  orange?: boolean;
  body?: Loadout["car"];
  boost?: Loadout["boost"];
  hat?: Loadout["hat"];
  ball?: Loadout["ball"];
};

export function Car({ x, y, angle = 0, orange = false, body = "octane", boost = "standard", hat = "none", ball = "none" }: CarProps) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <ellipse cx="0" cy="16" rx="44" ry="8" fill="#020617" opacity=".35" />
      <CarBoost boost={boost} />
      {body === "octane" ? <CarBody orange={orange} /> : <g data-body={body}>
        {body === "fennec" && <>
          <path d="M-38 13 L-38-7 L-30-21 L3-21 L18-7 L35-5 L40 1 L40 14Z" fill={orange ? "#f89840" : "#559bff"} stroke="#122e50" strokeWidth="2" />
          <path d="M-29-17 H-14 V-7 H-34Z M-10-17 H1 L12-7 H-10Z" fill="#142941" />
          <path d="M-35-3 H34 M-10-3 V11" stroke={orange ? "#ffd79b" : "#a9d8ff"} strokeWidth="2" />
          <path d="M-34-23 H-22 M-5 1 H1" stroke="#122e50" strokeWidth="3" />
          <path d="M33-2 H39" stroke="#eaf7ff" strokeWidth="4" />
          <path d="M-40 10 H-31 M31 10 H42" stroke="#142941" strokeWidth="5" />
        </>}
        {body === "dominus" && <>
          <path d="M-45 5 L-38-3 L-24-5 L-13-16 L6-16 L20-4 L42 0 L47 7 L44 15 H-43Z" fill={orange ? "#f89840" : "#559bff"} stroke="#122e50" strokeWidth="2" />
          <path d="M-20-5 L-11-13 H-3 V-5Z M1-13 H5 L15-5 H1Z" fill="#142941" />
          <path d="M-38 3 H40 M-1-2 V11" stroke={orange ? "#ffd79b" : "#a9d8ff"} strokeWidth="2" />
          <path d="M23-3 L37-1 M21 0 L35 2" stroke="#142941" strokeWidth="2" />
          <path d="M-39 3 V-8 M-46-9 H-30" stroke={orange ? "#ce631e" : "#2a69bf"} strokeWidth="4" />
          <path d="M39 4 H46" stroke="#eaf7ff" strokeWidth="3" />
          <path d="M-16 13 H17" stroke="#142941" strokeWidth="4" />
        </>}
        {body === "merc" && <>
          <path d="M-38 14 V-24 Q-38-29-32-29 H12 L27-16 L35-6 L39 1 V14Z" fill={orange ? "#f89840" : "#559bff"} stroke="#122e50" strokeWidth="2" />
          <path d="M-31-23 H-14 V-9 H-31Z M-10-23 H9 L22-10 H-10Z" fill="#142941" />
          <path d="M-34-5 H31 M-11-5 V11" stroke={orange ? "#ffd79b" : "#a9d8ff"} strokeWidth="2" />
          <path d="M-6 0 H1 M-39 10 H-30 M30 10 H41" stroke="#142941" strokeWidth="3" />
          <path d="M31-3 H37" stroke="#eaf7ff" strokeWidth="5" />
          <path d="M-37-19 V-10" stroke="#ef4444" strokeWidth="3" />
        </>}
        <circle cx={body === "dominus" ? -29 : -22} cy="14" r="10" fill="#0b1426" />
        <circle cx={body === "dominus" ? 31 : 25} cy="14" r="10" fill="#0b1426" />
        <circle cx={body === "dominus" ? -29 : -22} cy="14" r="5" fill="#bdcfe6" />
        <circle cx={body === "dominus" ? 31 : 25} cy="14" r="5" fill="#bdcfe6" />
      </g>}
      <CarHat hat={hat} body={body} />
      <CarBall ball={ball} />
    </g>
  );
}

// Une voiture par joueur affiché sur la piste (CRS-2) : la tienne en bleu, les autres en orange.
export type TrackCar = { id: string; name: string; progress: number; you: boolean };

type ArenaProps = { progress?: number; cars?: TrackCar[]; className?: string };

export function Arena({ progress, cars, className = "" }: ArenaProps) {
  const id = useId().replaceAll(":", "");
  const position = arenaPosition(progress ?? 0.16);
  return (
    <svg className={`arena ${className}`} viewBox="0 0 960 500" fill="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-sky`} x2="0" y2="1">
          <stop stopColor="#102443" />
          <stop offset="1" stopColor="#233d5c" />
        </linearGradient>
        <linearGradient id={`${id}-field`} x2="0" y2="1">
          <stop stopColor="#164553" />
          <stop offset="1" stopColor="#0e273d" />
        </linearGradient>
        <linearGradient id={`${id}-beam`} x2="0" y2="1">
          <stop stopColor="#a5d9ff" stopOpacity=".17" />
          <stop offset="1" stopColor="#a5d9ff" stopOpacity="0" />
        </linearGradient>
        <pattern id={`${id}-crowd`} width="15" height="13" patternUnits="userSpaceOnUse">
          <circle cx="4" cy="4" r="1.5" fill="#7593af" opacity=".5" />
        </pattern>
        <pattern id={`${id}-net`} width="14" height="14" patternUnits="userSpaceOnUse">
          <path d="M14 0H0V14" stroke="#7ca5b9" strokeWidth=".6" opacity=".4" />
        </pattern>
      </defs>
      <rect width="960" height="500" rx="18" fill={`url(#${id}-sky)`} />
      <path d="M0 80 Q480-65 960 80 M0 106 Q480-35 960 106" stroke="#516680" strokeWidth="2" />
      {[110, 300, 660, 850].map((x) => <g key={x}>
        <path d={`M${x} 58 L${x - 115} 360 L${x + 155} 360Z`} fill={`url(#${id}-beam)`} />
        <rect x={x - 27} y="51" width="54" height="7" rx="2" fill="#d9efff" />
      </g>)}
      <path d="M0 167 Q480 85 960 167 L960 320 L0 320Z" fill="#102039" />
      <path d="M0 167 Q480 85 960 167 L960 298 L0 298Z" fill={`url(#${id}-crowd)`} />
      <path d="M0 203 Q480 133 960 203 M0 244 Q480 184 960 244" stroke="#344962" strokeWidth="4" />
      <path d="M0 282 Q480 249 960 282" stroke="#5ca5f7" strokeWidth="4" />
      <path d="M480 265 Q720 265 960 282" stroke="#ffab5e" strokeWidth="4" />
      <path d="M90 290 L870 290 L1020 500 L-60 500Z" fill={`url(#${id}-field)`} />
      <path d="M180 300 L780 300 L910 461 L50 461Z" stroke="#91bbc5" strokeOpacity=".45" strokeWidth="2" />
      <path d="M480 300 V461 M180 341 H811 M132 396 H861" stroke="#91bbc5" strokeOpacity=".14" />
      <ellipse cx="480" cy="367" rx="98" ry="42" stroke="#91bbc5" strokeOpacity=".4" strokeWidth="2" />
      <ellipse cx="480" cy="367" rx="5" ry="3" fill="#c8e6e9" />
      <path d="M60 351 V275 L153 271 V340Z" fill={`url(#${id}-net)`} stroke="#66b9ff" strokeWidth="4" />
      <path d="M807 340 V271 L900 275 V351Z" fill={`url(#${id}-net)`} stroke="#ffab5e" strokeWidth="4" />
      <path d="M153 271 L170 287 V340 M807 271 L790 287 V340" stroke="#d6efff" strokeOpacity=".4" strokeWidth="2" />
      <path d="M180 370 H780 L840 205 L765 140 H430 L800 310" stroke="#a3c9ef" strokeOpacity=".3" strokeWidth="2" strokeDasharray="5 10" />
      <g fill="#ffad55" opacity=".8">{[240, 360, 600, 720].map((x) => <ellipse key={x} cx={x} cy="431" rx="10" ry="3" />)}</g>
      {progress === undefined && !cars && <g transform="translate(660 315) scale(.72)">
        <Car x={0} y={0} orange />
      </g>}
      {cars ? [...cars].sort((a, b) => Number(a.you) - Number(b.you)).map((car) => {
        // Ta voiture est dessinée en dernier, par-dessus les autres.
        const at = arenaPosition(car.progress);
        return <g key={car.id}>
          <g transform={`translate(${at.x} ${at.y}) scale(.6)`}>
            <Car x={0} y={0} angle={at.angle} orange={!car.you} />
          </g>
          <text x={at.x} y={at.y - 22} textAnchor="middle" className="car-tag">{car.name}</text>
        </g>;
      }) : <Car x={position.x} y={position.y} angle={position.angle} />}
      <path d="M0 483 H960" stroke="#6fb2ed" strokeWidth="2" opacity=".5" />
    </svg>
  );
}
