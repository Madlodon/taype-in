import { useContext, type ComponentProps } from "react";
import { CarBall as CurrentBall } from "../../components/car-ball";
import { SpriteStyle } from "./arena-preview-car";

// The arena still owns position, spin, shadows, contacts and shots.
export function CarBall(props: ComponentProps<typeof CurrentBall>) {
  const sprites = useContext(SpriteStyle);
  if (!sprites) return <CurrentBall {...props} />;
  // The rendered sphere occupies 1.8 / 2.4 of the image; keep the current 16-unit radius.
  const size = 32 * 2.4 / 1.8;
  return <g data-sprite-ball={props.ball} transform={props.centered ? undefined : "translate(65 -2)"}>
    <image href={`assets/arena-preview/field-ball-${props.ball}.png`} x={-size / 2} y={-size / 2} width={size} height={size} />
  </g>;
}
