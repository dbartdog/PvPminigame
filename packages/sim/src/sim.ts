export type PlayerIndex = 0 | 1;
export type Winner = PlayerIndex | 'draw';
export type PlayerInputs<Input> = readonly [Input, Input];

/**
 * The contract every game implements. All three functions must be pure, and State must be plain
 * data: prediction and reconciliation restore a saved state and replay inputs from it, so anything
 * kept outside State would desync client and server. Randomness therefore lives in State too, as
 * an RngState.
 */
export interface Sim<State, Input> {
  init(seed: number): State;
  step(state: State, inputs: PlayerInputs<Input>, tick: number): State;
  isOver(state: State): Winner | null;
}
