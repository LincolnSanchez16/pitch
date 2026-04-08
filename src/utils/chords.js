export const TRAINER_CONFIG = {
  totalRounds: 10,
  playbackDuration: 2.8,
  rootMidiRange: {
    min: 48,
    max: 59,
  },
}

export const CHORD_TYPES = [
  { id: 'major', label: 'Major', shortLabel: 'maj', intervals: [0, 4, 7] },
  { id: 'minor', label: 'Minor', shortLabel: 'min', intervals: [0, 3, 7] },
  { id: 'maj7', label: 'Major 7', shortLabel: 'maj7', intervals: [0, 4, 7, 11] },
  { id: 'dom7', label: 'Dominant 7', shortLabel: '7', intervals: [0, 4, 7, 10] },
  { id: 'min7', label: 'Minor 7', shortLabel: 'min7', intervals: [0, 3, 7, 10] },
  { id: 'add6', label: 'Add 6', shortLabel: 'add6', intervals: [0, 4, 7, 9] },
  { id: 'add2', label: 'Add 2', shortLabel: 'add2', intervals: [0, 2, 4, 7] },
  { id: 'sus2', label: 'Sus 2', shortLabel: 'sus2', intervals: [0, 2, 7] },
  { id: 'sus4', label: 'Sus 4', shortLabel: 'sus4', intervals: [0, 5, 7] },
  { id: 'power5', label: 'Power 5', shortLabel: '5', intervals: [0, 7, 12] },
  { id: 'dim', label: 'Diminished', shortLabel: 'dim', intervals: [0, 3, 6] },
  { id: 'aug', label: 'Augmented', shortLabel: 'aug', intervals: [0, 4, 8] },
]

export const TRAINER_DIFFICULTIES = {
  easy: {
    label: 'Easy',
    chordTypeIds: ['major', 'minor', 'power5', 'sus2', 'sus4'],
  },
  medium: {
    label: 'Medium',
    chordTypeIds: ['major', 'minor', 'power5', 'sus2', 'sus4', 'add2', 'add6', 'maj7', 'dom7'],
  },
  hard: {
    label: 'Hard',
    chordTypeIds: CHORD_TYPES.map((type) => type.id),
  },
  custom: {
    label: 'Custom',
    chordTypeIds: [],
  },
}

const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B']

let nextTrainerRoundId = 1

export function getChordTypeById(chordTypeId) {
  return CHORD_TYPES.find((type) => type.id === chordTypeId) ?? CHORD_TYPES[0]
}

export function getTrainerPool(difficulty, customChordTypeIds = []) {
  if (difficulty === 'custom') {
    const deduped = Array.from(new Set(customChordTypeIds))
    return deduped.length ? deduped : TRAINER_DIFFICULTIES.medium.chordTypeIds
  }

  return TRAINER_DIFFICULTIES[difficulty]?.chordTypeIds ?? TRAINER_DIFFICULTIES.easy.chordTypeIds
}

export function createTrainerRound({ roundNumber, difficulty, customChordTypeIds = [] }) {
  const pool = getTrainerPool(difficulty, customChordTypeIds)
  const chordTypeId = pool[Math.floor(Math.random() * pool.length)]
  const rootMidi = randomIntInclusive(
    TRAINER_CONFIG.rootMidiRange.min,
    TRAINER_CONFIG.rootMidiRange.max,
  )

  return {
    id: nextTrainerRoundId++,
    roundNumber,
    difficulty,
    pool,
    chordTypeId,
    rootMidi,
    rootLabel: midiToPitchClass(rootMidi),
    notes: buildChordNotes(rootMidi, chordTypeId),
  }
}

export function buildChordNotes(rootMidi, chordTypeId) {
  const chordType = getChordTypeById(chordTypeId)
  return chordType.intervals.map((interval) => midiToNote(rootMidi + interval))
}

export function midiToNote(midi) {
  const pitchClass = midiToPitchClass(midi)
  const octave = Math.floor(midi / 12) - 1
  return `${pitchClass}${octave}`
}

export function midiToPitchClass(midi) {
  return NOTE_NAMES[((midi % 12) + 12) % 12]
}

function randomIntInclusive(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
