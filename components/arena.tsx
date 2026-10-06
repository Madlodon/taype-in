"use client";

import { memo, useEffect, useId, useState } from "react";
import { FieldCar } from "@/components/field-car";
import { CarBall } from "@/components/car-ball";
import { CarHat } from "@/components/car-hat";
import { CarBoost } from "@/components/car-boost";
import { CarBody } from "@/components/car-body";
import type { Loadout } from "@/lib/garage-items";
import { STADIUM_IMAGES, type Stadium } from "@/lib/garage-items";
import { fieldPose, project } from "@/lib/stadium-track";

// The same route is used by the preview car and its ball: floor, wall, ceiling, goal.
export function arenaPosition(progress: number) {
  const points = [
    [0, 240, 395], [0.36, 710, 395], [0.49, 740, 335],
    [0.59, 660, 325], [0.78, 430, 325], [1, 760, 350],
  ];
  const value = Number.isFinite(progress) ? Math.max(0, Math.min(1, progress)) : 0;
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

// Pendant la course seule la position change : on ne redessine pas la voiture à chaque touche.
const CarParts = memo(function CarParts({ orange, body, boost, hat, ball }: Required<Omit<CarProps, "x" | "y" | "angle">>) {
  return (
    <>
      <ellipse cx="0" cy="16" rx="44" ry="8" fill="#020617" opacity=".35" />
      <CarBoost boost={boost} />
      <CarBody body={body} orange={orange} />
      <CarHat hat={hat} body={body} />
      <CarBall ball={ball} />
    </>
  );
});

export function Car({ x, y, angle = 0, orange = false, body = "octane", boost = "standard", hat = "none", ball = "none" }: CarProps) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`}>
      <CarParts orange={orange} body={body} boost={boost} hat={hat} ball={ball} />
    </g>
  );
}

// Une voiture par joueur affiché sur la piste (CRS-2) : la tienne en bleu, les autres en orange.
export type TrackCar = { id: string; name: string; progress: number; you: boolean };

type ArenaProps = { progress?: number; cars?: TrackCar[]; className?: string; stadium?: Stadium; carScale?: number };

export function Arena({ progress, cars, className = "", stadium = "diorama", carScale = .65 }: ArenaProps) {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const start = performance.now();
    let frame = requestAnimationFrame(function tick(now) {
      setSeconds((now - start) / 1000);
      frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  const id = useId().replaceAll(":", "");
  const position = arenaPosition(progress ?? 0.16);
  if (stadium) {
    const racers = cars ?? [{ id: "preview", name: "", progress: progress ?? .16, you: true }];
    return <svg className={`arena ${className}`} viewBox="0 0 1400 900" fill="none" aria-hidden="true" data-stadium={stadium}>
      <image href={STADIUM_IMAGES[stadium]} width="1400" height="900" />
      {racers.map((car, index) => {
        const pose = fieldPose(seconds, index / Math.max(1, racers.length) + car.progress * .15);
        const at = project(pose.x, pose.y, 0, stadium);
        const ball = project(pose.x + 5.7 * Math.cos(pose.heading), pose.y + 5.7 * Math.sin(pose.heading), 1.2, stadium);
        const shadow = project(pose.x + 5.7 * Math.cos(pose.heading), pose.y + 5.7 * Math.sin(pose.heading), 0, stadium);
        return { car, pose, at, ball, shadow };
      }).sort((a, b) => a.at.y - b.at.y).map(({ car, pose, at, ball, shadow }) => <g key={car.id}>
        <g transform={`translate(${at.x} ${at.y})`}>
          <g transform={`translate(${-at.x} ${-at.y})`}><FieldCar pose={pose} stadium={stadium} orange={!car.you} scale={Math.min(carScale, 1.4)} /></g>
        </g>
        <ellipse cx={shadow.x} cy={shadow.y} rx="10" ry="4" fill="#071820" opacity=".35" />
        <circle cx={ball.x} cy={ball.y} r="9" fill="#ecf2e8" stroke="#273c48" strokeWidth="2" />
        <path d={`M${ball.x-4} ${ball.y-2}l4 -3 4 3 -2 5h-4Z`} fill="#304657" />
        {car.name && <text x={at.x} y={at.y - 26} textAnchor="middle" className="car-tag">{car.name}</text>}
      </g>)}
    </svg>;
  }
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
      <path d="M240 395 H710 L740 335 L660 325 H430 L760 350" stroke="#a3c9ef" strokeOpacity=".3" strokeWidth="2" strokeDasharray="5 10" />
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
