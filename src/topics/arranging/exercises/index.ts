import type { ArrangingExercise } from '../exerciseTypes';
import { VOICING_EXERCISES } from './voicings';
import { HARMONY_EXERCISES } from './harmony';
import { ORCHESTRATION_EXERCISES } from './orchestration';
import { MELODY_EXERCISES } from './melody';

export const ARRANGING_EXERCISE_LIST: ArrangingExercise[] = [
  ...VOICING_EXERCISES,
  ...HARMONY_EXERCISES,
  ...ORCHESTRATION_EXERCISES,
  ...MELODY_EXERCISES,
];

export const ARRANGING_EXERCISES: Record<string, ArrangingExercise> = Object.fromEntries(
  ARRANGING_EXERCISE_LIST.map((e) => [e.id, e]),
);

export function getArrangingExercise(id: string): ArrangingExercise | undefined {
  return ARRANGING_EXERCISES[id];
}
