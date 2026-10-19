import { createContext, useContext, type ComponentProps } from "react";
import { FieldCar as CurrentCar } from "../../components/field-car";
import { project } from "../../lib/stadium-track";

export const SpriteStyle = createContext(false);

// This replacement is wired only by the standalone preview build.
export function FieldCar(props: ComponentProps<typeof CurrentCar>) {
  const sprites = useContext(SpriteStyle);
  if (!sprites) return <CurrentCar {...props} />;
  const { pose, orange, stadium, scale = .45 } = props;
  const at = project(pose.x, pose.y, 0, stadium);
  const frame = ((Math.round(pose.heading / (Math.PI * 2) * 32) % 32) + 32) % 32;
  // A 12-world-unit orthographic tile, matched to the diorama's 198-unit camera.
  const size = 12 * 1400 / 198 * scale;
  return <g data-sprite-car="" data-heading={frame}>
    {/* Keep the current exhaust and contact shadow; replace only the body. */}
    <g className="sprite-exhaust"><CurrentCar {...props} /></g>
    <svg x={at.x - size / 2} y={at.y - size / 2} width={size} height={size}
      viewBox={`${frame % 8 * 128} ${Math.floor(frame / 8) * 128} 128 128`} overflow="hidden">
      <image href={`assets/arena-preview/field-${orange ? "orange" : "blue"}.png`} width="1024" height="512" />
    </svg>
  </g>;
}
