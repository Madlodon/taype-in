import type { Loadout } from "@/lib/garage-items";

// Blender textures come from the garage artwork; the parent still owns spin and flight.
export function CarBall({ ball, centered = false }: { ball: Loadout["ball"]; centered?: boolean }) {
  // A radius-.9 sphere occupies 1.8 / 2.4 of the rendered tile: retain radius 16.
  const size = 32 * 2.4 / 1.8;
  return <g transform={centered ? undefined : "translate(65 -2)"} data-ball={ball} data-item={ball === "none" ? undefined : ball}>
    <image href={`/sprites/balls/${ball}.png`} x={-size / 2} y={-size / 2} width={size} height={size} />
  </g>;
}
