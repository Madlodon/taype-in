import { useId } from "react";

// Side view with a little of the hood and roof visible, facing along the track.
export function CarBody({ orange = false }: { orange?: boolean }) {
  const id = useId().replaceAll(":", "");
  const paint = (name: string) => `url(#${id}-${name})`;
  const light = orange ? "#ffe0a1" : "#b1d7ff";
  const color = orange ? "#f28a24" : "#367ee9";
  const dark = orange ? "#783013" : "#13367f";

  return <g data-body="octane" strokeLinejoin="round" strokeLinecap="round">
    <defs>
      <linearGradient id={`${id}-body`} x1="0" y1="0" x2=".2" y2="1">
        <stop stopColor={light} /><stop offset=".22" stopColor={color} /><stop offset=".65" stopColor={color} /><stop offset="1" stopColor={dark} />
      </linearGradient>
      <linearGradient id={`${id}-top`} x2=".3" y2="1">
        <stop stopColor={light} /><stop offset=".45" stopColor={color} /><stop offset="1" stopColor={dark} />
      </linearGradient>
      <linearGradient id={`${id}-glass`} x1="0" y1="0" x2=".7" y2="1">
        <stop stopColor="#4c677b" /><stop offset=".4" stopColor="#16232d" /><stop offset="1" stopColor="#070d14" />
      </linearGradient>
      <linearGradient id={`${id}-metal`} x2=".3" y2="1">
        <stop stopColor="#d8e0e1" /><stop offset=".3" stopColor="#8b999e" /><stop offset=".55" stopColor="#3b484f" /><stop offset=".8" stopColor="#abb7ba" /><stop offset="1" stopColor="#414d53" />
      </linearGradient>
      <radialGradient id={`${id}-tire`} cx=".35" cy=".25" r=".8">
        <stop stopColor="#42474b" /><stop offset=".65" stopColor="#1d2227" /><stop offset="1" stopColor="#080c12" />
      </radialGradient>
      <radialGradient id={`${id}-rim`} cx=".35" cy=".2" r=".9">
        <stop stopColor="#c4cfd2" /><stop offset=".55" stopColor="#75858d" /><stop offset="1" stopColor="#34414b" />
      </radialGradient>
    </defs>

    {/* Far tires, chassis and the exposed rear engine sit behind the shell. */}
    <g fill="#10161c" stroke="#303a43" strokeWidth=".6">
      <ellipse cx="-28" cy="9" rx="8" ry="10" />
      <ellipse cx="21" cy="8" rx="8" ry="10" />
      <path d="M-34 9-28 15H29L38 8 27 4-23 4Z" />
    </g>
    <path d="M-33 4-26-10-18-14M-30-10-25-20M-22-7-18-20" fill="none" stroke={paint("metal")} strokeWidth="2" />
    <path d="M-32-5-30-13-22-14-18-7Z" fill="#782e25" stroke="#301e1b" strokeWidth=".7" />
    <path d="m-29-12 1 5m3-6 1 5" stroke="#c4563d" strokeWidth="1.1" />
    <path d="M-38 5H-30V11H-38Z" fill={paint("metal")} stroke="#151d25" strokeWidth=".7" />
    <ellipse cx="-38" cy="8" rx="1.4" ry="2.7" fill="#121922" />
    <path d="M-38-19-28-22-16-20-17-17-36-16Z" fill={paint("top")} stroke={dark} strokeWidth=".7" />
    <path d="M-39-22-36-23-35-16-38-15ZM-18-23-15-22-15-17-18-17Z" fill={color} stroke={dark} strokeWidth=".6" />
    <path d="m-36-19 17-.9" stroke={light} strokeWidth=".6" />

    {/* Narrow cockpit and tapered nose between separate mudguards. */}
    <path d="M-29-3-20-14-6-18 3-16 15-5 29-2 38 5 34 12 14 14 8 18-11 17-18 5Z" fill={paint("body")} stroke={dark} strokeWidth=".9" />
    <path d="M-20-14-6-18 3-16-11-14-24-4-29-3Z" fill={paint("top")} />
    <path d="M-18-12-10-14 1-13 10-5-22-3Z" fill={paint("glass")} stroke="#101923" strokeWidth="1" />
    <path d="m-17-11 7-2 9 .7" fill="none" stroke="#a9cbe3" strokeWidth=".5" opacity=".6" />
    <path d="m3-14 8-1 12 11-9 .5Z" fill={paint("glass")} stroke="#142439" strokeWidth=".9" />
    <path d="m7-12 4-.2 8 7" fill="none" stroke="#accbe2" strokeWidth=".6" opacity=".5" />
    <path d="m-12-17 1-4 7-1 5 2-1 3Z" fill={paint("metal")} stroke="#111921" strokeWidth=".6" />
    <path d="M-9-20H-3V-17.8H-9Z" fill="#090f17" />
    <path d="m15-4 11-2 13 8-7 2Z" fill={paint("top")} stroke={dark} strokeWidth=".6" />
    <path d="m18-3 9-1 7 4" fill="none" stroke={light} strokeWidth=".7" opacity=".7" />
    <path d="M-19 1 10-1 18 4 8 15-9 14Z" fill={paint("body")} stroke={dark} strokeWidth=".7" />
    <path d="m-12 2 22-2M-8 13 7 14 13 7" fill="none" stroke={light} strokeWidth=".6" opacity=".65" />
    <path d="m-13 5 4-2-2 8-4 1Z" fill="#14202b" />
    <path d="M-9 16 8 17 12 13" fill="none" stroke="#111a23" strokeWidth="1.7" />
    <path d="m-30 10 10-5m38 4 10 4" stroke={paint("metal")} strokeWidth="1.2" />

    {/* Octane's floating fenders leave the knobby tires and suspension exposed. */}
    <path d="M-39 3-36-3-29-7-20-5-13 1-17 5-28 1-36 6Z" fill={paint("top")} stroke="#142535" strokeWidth=".8" />
    <path d="m-38 3 10-3 11 4" fill="none" stroke="#202a32" strokeWidth="1.6" />
    <path d="M14 4 18-3 26-5 35-1 40 5 36 8 26 2 18 7Z" fill={paint("top")} stroke="#142535" strokeWidth=".8" />
    <path d="m17 6 9-4 11 5" fill="none" stroke="#202a32" strokeWidth="1.6" />
    <path d="m-35-2 6-3 8 2m42-5 6 3 4 4" fill="none" stroke={light} strokeWidth=".65" />

    {/* Front grille, tubular bumper and circular rally lights. */}
    <path d="m34 3 8 1 2 9-8 2Z" fill="#141e27" stroke="#596670" strokeWidth=".7" />
    <path d="m36 5 1 7m2-7 1 7m1-6 1 5" stroke="#9ba6a9" strokeWidth=".65" />
    <path d="m35 3 2 12 8-1-2-10M36 9l8-.5" fill="none" stroke={paint("metal")} strokeWidth="1.2" />
    <ellipse cx="39" cy="5.5" rx="2.5" ry="3" fill="#dce7e7" stroke="#65767e" strokeWidth="1" />
    <ellipse cx="39.4" cy="5.2" rx="1.4" ry="1.9" fill="#f3ffff" />
    <ellipse cx="42.7" cy="11.5" rx="1" ry="1.2" fill="#e6fcff" stroke="#80939c" strokeWidth=".5" />

    {[-26, 26].map((x) => <CarWheel key={x} x={x} paint={paint} rugged />)}
  </g>;
}

function CarWheel({ x, paint, rugged = false }: { x: number; paint: (name: string) => string; rugged?: boolean }) {
  return <g transform={`translate(${x} 14)`}>
    <ellipse cx="-1.5" cy="-.6" rx="10.8" ry="11.1" fill="#0b1017" />
    <ellipse rx="9.6" ry="10.3" fill={paint("tire")} stroke="#101720" strokeWidth=".7" />
    <ellipse rx="8.5" ry="9.1" fill="none" stroke="#647079" strokeWidth=".45" opacity=".6" />
    {rugged && Array.from({ length: 16 }, (_, i) => <path key={i} d="m-1-9.1 1.2-.5 1 .8" transform={`rotate(${i * 22.5})`} fill="none" stroke="#657078" strokeWidth=".65" opacity=".6" />)}
    <ellipse rx="6.8" ry="7.3" fill={paint("rim")} stroke="#050b13" strokeWidth=".9" />
    <ellipse rx="5.7" ry="6.2" fill="#101923" stroke="#c0c9ca" strokeWidth=".35" />
    <ellipse rx="4.5" ry="4.9" fill="#45515a" opacity=".55" />
    <path d="M3-3 4-2.4 4 1.7 2.8 2Z" fill="#a44c29" />
    {Array.from({ length: 8 }, (_, i) => <path key={i} d="M-1-1.1-.6-5.8 .25-6.1 .8-1.1Z" transform={`rotate(${i * 45})`} fill={paint("metal")} stroke="#293b48" strokeWidth=".2" />)}
    <ellipse rx="2" ry="2.2" fill={paint("rim")} stroke="#111c27" strokeWidth=".45" />
    <ellipse rx=".9" ry="1" fill="#18252f" />
    <path d="M-6.5-6.3Q0-11 6.2-6.4" fill="none" stroke="#9ca9b0" strokeWidth=".45" opacity=".55" />
  </g>;
}
