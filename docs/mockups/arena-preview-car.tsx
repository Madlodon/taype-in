import { createContext, useContext, type ComponentProps } from "react";
import { FieldCar as PreviousCar } from "./previous-field-car";
import { FieldCar as BlenderCar } from "../../components/field-car";

export const SpriteStyle = createContext(false);

// Comparison only: the app always uses the production Blender component.
export function FieldCar(props: ComponentProps<typeof BlenderCar>) {
  const sprites = useContext(SpriteStyle);
  return sprites ? <g data-sprite-car=""><BlenderCar {...props} /></g> : <PreviousCar {...props} />;
}
