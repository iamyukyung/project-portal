/**
 * The player's live ground position and heading.
 *
 * Published once per frame by Player and read by the minimap's own animation
 * loop. Deliberately a plain mutable object outside React: the minimap has to
 * track the character every frame, and routing that through state would
 * re-render the UI tree 60 times a second.
 */
export const playerTransform = { x: 0, z: 0, facing: Math.PI };

export function publishPlayerTransform(x: number, z: number, facing: number) {
  playerTransform.x = x;
  playerTransform.z = z;
  playerTransform.facing = facing;
}
