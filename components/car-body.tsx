import { useId } from "react";
import type { Loadout } from "@/lib/garage-items";

// Side view with a little of the hood and roof visible, facing along the track.
export function CarBody({ body, orange = false }: { body: Loadout["car"]; orange?: boolean }) {
  const id = useId().replaceAll(":", "");
  const paint = (name: string) => `url(#${id}-${name})`;
  const light = orange ? "#ffe0a1" : "#b1d7ff";
  const color = orange ? "#f28a24" : "#367ee9";
  const dark = orange ? "#783013" : "#13367f";

  return <g data-body={body} strokeLinejoin="round" strokeLinecap="round">
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

    {body === "octane" && <>
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

    </>}

    {body === "fennec" && <>
      <path d="M-37 12-30 18H31L40 11 33 5H-30Z" fill="#101923" />
      <path d="M-36 9-38-5-32-18-25-22H0L7-19 18-8 35-6 41-1 42 11 37 16H-32Z" fill={paint("body")} stroke={dark} strokeWidth=".9" />
      {/* Squared hatch, short hood and a broad roof spoiler. */}
      <path d="M-32-18-25-22H0L7-19-23-19-34-6-38-5Z" fill={paint("top")} />
      <path d="M-36-20-28-24-21-22-29-18Z" fill={paint("top")} stroke={dark} strokeWidth=".6" />
      <path d="m-36-20 7 2 1 3-8-2Z" fill="#162330" />
      <path d="M-26-17H-16V-7H-31Z" fill={paint("glass")} stroke="#182431" strokeWidth=".9" />
      <path d="M-13-17H-2L11-6-13-7Z" fill={paint("glass")} stroke="#182431" strokeWidth=".9" />
      <path d="m1-18 6 .5 13 11-6 1Z" fill={paint("glass")} stroke="#142132" strokeWidth=".9" />
      <path d="M-25-16H-3L7-8M5-16l10 8" fill="none" stroke="#b5d6ec" strokeWidth=".5" opacity=".55" />
      <path d="m18-7 6-3 13 4 4 5-24-2Z" fill={paint("top")} stroke={dark} strokeWidth=".6" />
      <path d="m21-7 12 2 5 3" fill="none" stroke={light} strokeWidth=".65" />
      <path d="M-34-3-15-4 14-2 37 1" fill="none" stroke={light} strokeWidth=".7" />
      <path d="m-16-3 2 15H14L16 0" fill="none" stroke={dark} strokeWidth=".7" />
      <path d="m-19-2 3 1 5 13-3 .4Z" fill="#16212d" stroke="#6b808f" strokeWidth=".4" />
      <path d="M-10 9H16V12H-9Z" fill="#1b2834" />
      <path d="M-13 15H17L19 17H-13Z" fill={paint("top")} stroke={dark} strokeWidth=".5" />
      <path d="M-9-.7H-4" stroke={paint("metal")} strokeWidth=".9" />
      <path d="m12-5 3-1 3 1-1 2-4-.2Z" fill="#131f29" stroke="#6a7d8c" strokeWidth=".45" />
      <path d="M-37-6-34-7-35-1-38 0Z" fill="#dd583a" stroke="#552523" strokeWidth=".6" />
      <path d="m34 0 7 1 .2 4-7-1Z" fill="#0d1a25" stroke="#8195a2" strokeWidth=".5" />
      <path d="m35 1 4.8 .5v1.8L35 3Z" fill="#ecfaff" />
      <path d="m32 5 7 1m-7 1 7 1" stroke="#172938" strokeWidth=".75" />
      <path d="M-38 10-32 11M35 12l7-1" stroke="#121d26" strokeWidth="3" />
      <path d="M-36 13Q-35 1-26 1T-15 14M15 14Q15 1 26 1T37 14" fill="none" stroke="#182530" strokeWidth="3.5" />
      <path d="M-36 7Q-26-7-16 6M16 6Q26-6 36 7" fill="none" stroke={light} strokeWidth=".75" opacity=".8" />
    </>}

    {body === "dominus" && <>
      <path d="M-45 10-37 19H39L49 13 44 5H-39Z" fill="#0e1823" />
      {/* Long muscle-car hood, low cabin and raised rear wing. */}
      <path d="M-40-2V-9M-31-4-29-10" stroke={paint("metal")} strokeWidth="1.4" />
      <path d="M-47-10-43-13-24-12-25-9Z" fill={paint("top")} stroke="#152434" strokeWidth=".7" />
      <path d="M-45-13-42-14-42-9-45-8Z" fill={color} stroke={dark} strokeWidth=".6" />
      <path d="M-46 4-39-4-23-6-14-15 3-17 10-13 20-4 43-2 49 4 48 13 38 17H-39L-46 12Z" fill={paint("body")} stroke={dark} strokeWidth=".9" />
      <path d="M-23-6-14-15 3-17 10-13-12-13Z" fill={paint("top")} />
      <path d="M-19-5-11-12H-5V-4Z M-2-12H7L17-3-2-4Z" fill={paint("glass")} stroke="#14212d" strokeWidth=".8" />
      <path d="m9-13 5 1 12 8-6 1Z" fill={paint("glass")} stroke="#14212d" strokeWidth=".8" />
      <path d="M-9-11H6L13-6m1-5 7 5" fill="none" stroke="#a8c9df" strokeWidth=".5" opacity=".65" />
      <path d="m20-3 9-3 15 4 5 6-23-2Z" fill={paint("top")} stroke={dark} strokeWidth=".55" />
      <path d="m26-3 13 2m-11 2 13 2" stroke={light} strokeWidth=".65" />
      <path d="m30-1 5 .6-1 1.5-5-.5Z" fill="#142331" />
      <path d="m22-4 2-5m2 5 2-4m-1-1 1-4m3 4 1-3" stroke="#182734" strokeWidth="2.1" />
      <path d="m22-4 2-5m2 5 2-4m-1-1 1-4m3 4 1-3" stroke={paint("metal")} strokeWidth="1.2" />
      <path d="M-41 0-24-2 17 0 41 5" fill="none" stroke={light} strokeWidth=".7" />
      <path d="m-16 2 30 .8-4 4-24 4Z" fill={dark} stroke="#152538" strokeWidth=".6" />
      <path d="m-13 3 24 .6-2 2.3-20 3Z" fill={paint("top")} />
      <path d="M-12-1-11 13H13L17 2M-7 0h4" fill="none" stroke={dark} strokeWidth=".65" />
      <path d="M-17 14H17L19 17H-20Z" fill="#14212e" stroke="#70848d" strokeWidth=".45" />
      <path d="M-43 13-41 5-34 1-27 2-19 7-18 14M20 14 21 5 28 1H35L42 5 43 14" fill="none" stroke="#101e2a" strokeWidth="2.5" />
      <path d="M-42 3-34-.5-26 .5M22 3 28-.5 36 .5" fill="none" stroke={light} strokeWidth=".65" />
      <path d="m43 4 6-.2-.5 8-6 .5Z" fill="#10202c" stroke={paint("metal")} strokeWidth=".75" />
      <ellipse cx="45" cy="6" rx="1.4" ry="1.65" fill="#f0fdff" />
      <ellipse cx="44.7" cy="10" rx="1.4" ry="1.65" fill="#e6f7ff" />
      <path d="M47 6h2m-2 2h2m-2 2h2" stroke="#a7b9bf" strokeWidth=".5" />
      <path d="m41 14 9-.5-1.5 2-8 1Z" fill="#0c1721" stroke="#687e8d" strokeWidth=".5" />
      <path d="M-45 3-40 2v2l-5 1Z" fill="#df5136" />
    </>}

    {body === "merc" && <>
      <path d="M-36 13-29 19H32L42 10H-36Z" fill="#111b25" />
      {/* Tall panel van, angular wheel arches and upright armored grille. */}
      <path d="M-38 12-39-21-35-27-9-29 10-28 28-17 36-6 41 0 40 13 33 17H-31Z" fill={paint("body")} stroke={dark} strokeWidth="1" />
      <path d="M-39-21-35-27-9-29 10-28 15-24-32-24Z" fill={paint("top")} />
      <path d="m-32-23 23-.4 1 17-27 1Z" fill={paint("body")} stroke={dark} strokeWidth=".5" />
      <path d="M-3-24 9-24 23-12-3-13Z" fill={paint("glass")} stroke="#1a2731" strokeWidth="1" />
      <path d="m12-25 5 2 14 14-6-2Z" fill={paint("glass")} stroke="#142330" strokeWidth=".9" />
      <path d="m-1-22 9 .2 10 8m0-7 9 10" fill="none" stroke="#b5d9ea" strokeWidth=".6" opacity=".6" />
      <path d="M-36-3-10-5 26-9 35-3" fill="none" stroke={light} strokeWidth="1.4" />
      <path d="M-34 7H30" stroke={dark} strokeWidth="2.2" />
      <path d="M-33 6H29" stroke={light} strokeWidth="1.4" opacity=".8" />
      <path d="M-6-24V13H18L26-9M-1-9H4" fill="none" stroke={dark} strokeWidth=".75" />
      <path d="M-1-9H4" stroke={paint("metal")} strokeWidth="1" />
      <path d="m24-13 4 .5 1 3-4-.6Z" fill="#162330" stroke="#8899a1" strokeWidth=".5" />
      <path d="M-38-17h2v8h-2Z" fill="#dc4d39" stroke="#5b2526" strokeWidth=".5" />
      <path d="m-35-27 1-3 2 .2-.2 2.4Z" fill={paint("top")} />
      <path d="M-37 15-35 4-30-.5H-20L-14 4-12 16M15 16 18 3 22-1H32L37 4 39 14" fill="none" stroke="#192733" strokeWidth="3.5" />
      <path d="M-37 9-34 2-30-1.5H-20L-15 3M17 8 20 1 23-2H32L37 3" fill="none" stroke="#9badb4" strokeWidth=".7" />
      <path d="M-12 14H14V17H-12Z" fill="#15232e" stroke="#6a7b86" strokeWidth=".6" />
      <path d="m33-5 7 4v8l-7-2Z" fill={paint("metal")} stroke="#22333e" strokeWidth=".7" />
      <path d="m35-3 .2 6m1.7-5 .2 5.6m1.7-4.6 .2 5" stroke="#192b39" strokeWidth=".8" />
      <path d="m30-6 2 .5 .5 7-2-.3Z" fill="#101e2a" stroke="#80929c" strokeWidth=".6" />
      <path d="m30.4-5 1.2 .3v2l-1.1-.3Zm.2 3.7 1.2 .3v2l-1.1-.3Z" fill="#eafcff" />
      <path d="m33 7 8 1v6l-8 1Z" fill={paint("body")} stroke={dark} strokeWidth=".7" />
      <path d="m34 7 2 .3v7l-2 .3Z" fill="#a9bfc9" />
      <path d="m38 9 3 .6-.2 2-2.8-.4Z" fill="#13232f" />
      <path d="m35 15 8-1-.5 2-7.5 1Z" fill="#15222c" stroke="#78919e" strokeWidth=".6" />
      <ellipse cx="38" cy="12.5" rx="1.5" ry="1.6" fill="#172632" stroke={paint("metal")} strokeWidth=".8" />
    </>}

    {(body === "dominus" ? [-30, 31] : [-26, 26]).map((x) => <CarWheel key={x} x={x} paint={paint} rugged={body === "octane" || body === "merc"} />)}
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
