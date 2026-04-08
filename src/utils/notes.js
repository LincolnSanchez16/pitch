import { midiToNote } from './chords'

export const NOTE_TRAINER_CONFIG = {
  totalRounds: 10,
  playbackDuration: 2.2,
  midiRange: {
    min: 48,
    max: 71,
  },
}

export const NOTE_POOL = Array.from(
  { length: NOTE_TRAINER_CONFIG.midiRange.max - NOTE_TRAINER_CONFIG.midiRange.min + 1 },
  (_, index) => NOTE_TRAINER_CONFIG.midiRange.min + index,
).map((midi) => ({
  midi,
  id: midiToNote(midi),
  label: midiToNote(midi),
}))

let nextNoteTrainerRoundId = 1

export function createNoteTrainerRound({ roundNumber, previousTargetNote = null }) {
  const pool =
    previousTargetNote == null
      ? NOTE_POOL
      : NOTE_POOL.filter((note) => note.id !== previousTargetNote)
  const target = pool[Math.floor(Math.random() * pool.length)]

  return {
    id: nextNoteTrainerRoundId++,
    roundNumber,
    targetMidi: target.midi,
    targetNote: target.id,
    choices: NOTE_POOL,
  }
}
