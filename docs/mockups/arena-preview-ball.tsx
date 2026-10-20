import { useContext, type ComponentProps } from "react";
import { CarBall as PreviousBall } from "./previous-car-ball";
import { CarBall as BlenderBall } from "../../components/car-ball";
import { SpriteStyle } from "./arena-preview-car";

export function CarBall(props: ComponentProps<typeof BlenderBall>) {
  const sprites = useContext(SpriteStyle);
  return sprites ? <g data-sprite-ball={props.ball}><BlenderBall {...props} /></g> : <PreviousBall {...props} />;
}
