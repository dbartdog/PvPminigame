import type { Axis, ToyInput } from '@pvp/sim';

const LEFT = ['ArrowLeft', 'KeyA'];
const RIGHT = ['ArrowRight', 'KeyD'];
const UP = ['ArrowUp', 'KeyW'];
const DOWN = ['ArrowDown', 'KeyS'];

function anyPressed(pressed: ReadonlySet<string>, keys: readonly string[]): boolean {
  return keys.some((key) => pressed.has(key));
}

function axis(pressed: ReadonlySet<string>, negative: string[], positive: string[]): Axis {
  return ((anyPressed(pressed, positive) ? 1 : 0) -
    (anyPressed(pressed, negative) ? 1 : 0)) as Axis;
}

export function toyInputFromKeys(pressed: ReadonlySet<string>): ToyInput {
  return { x: axis(pressed, LEFT, RIGHT), y: axis(pressed, UP, DOWN) };
}
