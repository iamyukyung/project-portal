/**
 * Screen coordinates to a point on the ground.
 *
 * The touch gesture layer lives in the DOM, outside the Canvas, but picking a
 * destination needs the live camera. A component inside the Canvas registers
 * the picker here and the gesture layer calls it — no duplicated projection
 * maths, and no second scene or raycast pass.
 */
export type GroundHit = { x: number; z: number };
export type GroundPicker = (clientX: number, clientY: number) => GroundHit | null;

let picker: GroundPicker | null = null;

export function setGroundPicker(next: GroundPicker | null) {
  picker = next;
}

/** Returns null when the ray misses the ground, or the scene is not ready. */
export function pickGround(clientX: number, clientY: number): GroundHit | null {
  return picker?.(clientX, clientY) ?? null;
}
