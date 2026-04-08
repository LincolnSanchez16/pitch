export const GAME_CONFIG = {
  frequencyRange: {
    min: 80,
    max: 1100,
  },
  totalRounds: 5,
  targetDurationMs: 2000,
  targetVolume: 0.065,
  previewVolume: 0.045,
  sliderResolution: 1000,
  nudgeOptions: [-100, -10, 10, 100],
  playoffStakes: [1, 1, 2, 2, 4],
}

export const MODE_META = {
  solo: {
    label: 'Solo',
    description: 'Five rounds to chase the highest score on your own.',
  },
  duo: {
    label: 'Two Player',
    description: 'Take turns guessing the same tone and battle into playoffs if tied.',
  },
  trainer: {
    label: 'Chord Trainer',
    description: 'Hear a chord, name its structure, and build recognition fast.',
  },
  perfectPitch: {
    label: 'Perfect Pitch',
    description: 'Hear one note and name it across a two-octave pitch field.',
  },
  focus: {
    label: 'Focus Mode',
    description: 'Ambient carriers, noise, and slow modulation for longer work sessions.',
  },
}

export const PLAYER_META = {
  p1: {
    label: 'Player 1',
  },
  p2: {
    label: 'Player 2',
  },
}

const logMin = Math.log(GAME_CONFIG.frequencyRange.min)
const logMax = Math.log(GAME_CONFIG.frequencyRange.max)
const defaultFrequency = clampFrequency(
  Math.round(
    Math.sqrt(GAME_CONFIG.frequencyRange.min * GAME_CONFIG.frequencyRange.max),
  ),
)

let nextRoundId = 1

export function createRoundState({
  mode,
  roundNumber,
  isPlayoff = false,
  playoffCycle = 1,
  playoffRoundIndex = 0,
}) {
  return {
    id: nextRoundId++,
    mode,
    roundNumber,
    isPlayoff,
    playoffCycle,
    playoffRoundIndex,
    targetFrequency: generateTargetFrequency(),
    activePlayer: 'p1',
    guesses: {
      p1: null,
      p2: null,
    },
    responseTimes: {
      p1: null,
      p2: null,
    },
    guessStartedAt: {
      p1: null,
      p2: null,
    },
    selections: {
      p1: defaultFrequency,
      p2: defaultFrequency,
    },
  }
}

export function generateTargetFrequency() {
  return clampFrequency(
    Math.round(Math.exp(logMin + Math.random() * (logMax - logMin))),
  )
}

export function clampFrequency(value) {
  const safeValue = Number.isFinite(value)
    ? value
    : GAME_CONFIG.frequencyRange.min

  const clamped = Math.min(
    GAME_CONFIG.frequencyRange.max,
    Math.max(GAME_CONFIG.frequencyRange.min, safeValue),
  )

  return Number(clamped.toFixed(2))
}

export function frequencyToSliderValue(frequency) {
  const clamped = clampFrequency(frequency)
  const normalized = (Math.log(clamped) - logMin) / (logMax - logMin)
  return Math.round(normalized * GAME_CONFIG.sliderResolution)
}

export function sliderValueToFrequency(sliderValue) {
  const normalized = sliderValue / GAME_CONFIG.sliderResolution
  const frequency = Math.exp(logMin + normalized * (logMax - logMin))
  return clampFrequency(frequency)
}

export function getRoundLabel({
  roundNumber,
  isPlayoff,
  playoffCycle,
  playoffRoundIndex,
}) {
  if (isPlayoff) {
    return `Playoff ${playoffCycle}.${playoffRoundIndex + 1}`
  }

  return `Round ${roundNumber} of ${GAME_CONFIG.totalRounds}`
}

export function getPlayoffStake(playoffRoundIndex) {
  return GAME_CONFIG.playoffStakes[playoffRoundIndex] ?? 1
}

GAME_CONFIG.defaultFrequency = defaultFrequency
