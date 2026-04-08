import { Component, useCallback, useEffect, useRef, useState } from 'react'
import './App.css'
import { ChordTrainerStage } from './components/ChordTrainerStage'
import { FocusModeStage } from './components/FocusModeStage'
import { GameplayStage } from './components/GameplayStage'
import { PerfectPitchStage } from './components/PerfectPitchStage'
import SoftAurora from './components/SoftAurora'
import ShinyText from './components/ShinyText'
import { useToneEngine } from './hooks/useToneEngine'
import {
  CHORD_TYPES,
  TRAINER_CONFIG,
  TRAINER_DIFFICULTIES,
  createTrainerRound,
  getTrainerPool,
} from './utils/chords'
import { FOCUS_EFFECTS, FOCUS_PRESETS } from './utils/focus'
import { NOTE_TRAINER_CONFIG, createNoteTrainerRound } from './utils/notes'
import {
  GAME_CONFIG,
  MODE_META,
  PLAYER_META,
  clampFrequency,
  createRoundState,
  frequencyToSliderValue,
  getPlayoffStake,
  sliderValueToFrequency,
} from './utils/game'
import { resolveRound } from './utils/scoring'

const DEFAULT_MODE = 'solo'
const DEFAULT_TRAINER_DIFFICULTY = 'easy'
const DEFAULT_CUSTOM_CHORD_TYPES = TRAINER_DIFFICULTIES.medium.chordTypeIds
const CHORD_TYPE_MAP = Object.fromEntries(
  CHORD_TYPES.map((chordType) => [chordType.id, chordType]),
)

function createInitialGameState() {
  return {
    view: 'setup',
    mode: DEFAULT_MODE,
    scores: {
      p1: 0,
      p2: 0,
    },
    roundNumber: 0,
    isPlayoff: false,
    playoffCycle: 1,
    playoffRoundIndex: 0,
    history: [],
    lastResult: null,
    round: null,
    trainerDifficulty: DEFAULT_TRAINER_DIFFICULTY,
    trainerCustomTypeIds: DEFAULT_CUSTOM_CHORD_TYPES,
    trainerRound: null,
    trainerStreak: 0,
    trainerBestStreak: 0,
    lastTrainerResult: null,
    noteRound: null,
    noteStreak: 0,
    noteBestStreak: 0,
    lastNoteResult: null,
    focusPresetId: 'steady',
    focusEffects: [],
    focusLevels: {
      binaural: 0.82,
      pad: 0.78,
      noise: 0.54,
      rain: 0.58,
      rainTarp: 0.4,
      birds: 0.42,
      wind: 0.36,
      thunder: 0.46,
      seaside: 0.56,
      fireplace: 0.32,
    },
    focusElapsedMs: 0,
    focusIsPlaying: false,
    focusEditing: false,
    focusPanelOpen: false,
  }
}

function AppContent() {
  const [selectedMode, setSelectedMode] = useState(DEFAULT_MODE)
  const [pendingMode, setPendingMode] = useState(null)
  const [selectedTrainerDifficulty, setSelectedTrainerDifficulty] = useState(
    DEFAULT_TRAINER_DIFFICULTY,
  )
  const [selectedCustomChordTypeIds, setSelectedCustomChordTypeIds] = useState(
    DEFAULT_CUSTOM_CHORD_TYPES,
  )
  const [game, setGame] = useState(createInitialGameState)
  const [memoryTimeLeft, setMemoryTimeLeft] = useState(GAME_CONFIG.targetDurationMs / 1000)

  const autoplayTimerRef = useRef(null)
  const memoryIntervalRef = useRef(null)
  const memoryTimeoutRef = useRef(null)
  const dragStateRef = useRef(null)
  const liveSelectionRef = useRef(GAME_CONFIG.defaultFrequency)
  const focusStartedAtRef = useRef(null)
  const focusElapsedBaseRef = useRef(0)
  const focusLevelsRef = useRef(createInitialGameState().focusLevels)

  const previewRoundId = game.round?.id ?? null
  const previewPhase = game.round?.phase ?? null
  const previewPlayerId = game.round?.activePlayer ?? null
  const trainerRound = game.trainerRound
  const noteRound = game.noteRound
  const isPitchGame = game.mode === 'solo' || game.mode === 'duo'
  const isChordTrainer = game.mode === 'trainer'
  const isNoteTrainer = game.mode === 'perfectPitch'
  const isFocusMode = game.mode === 'focus'

  const {
    audioReady,
    audioNotice,
    isPreviewPlaying,
    unlockAudio,
    startAmbient,
    stopAmbient,
    playTargetTone,
    startPreview,
    updatePreview,
    stopPreview,
    playChord,
    stopChord,
    playNote,
    stopNote,
    startFocusSession,
    updateFocusLevels,
    stopFocus,
    stopAll,
  } = useToneEngine()

  const clearQueuedTarget = useCallback(() => {
    if (autoplayTimerRef.current) {
      window.clearTimeout(autoplayTimerRef.current)
      autoplayTimerRef.current = null
    }
  }, [])

  const clearMemoryTimers = useCallback(() => {
    if (memoryIntervalRef.current) {
      window.clearInterval(memoryIntervalRef.current)
      memoryIntervalRef.current = null
    }

    if (memoryTimeoutRef.current) {
      window.clearTimeout(memoryTimeoutRef.current)
      memoryTimeoutRef.current = null
    }
  }, [])

  const queueTargetPlayback = useCallback((frequency) => {
    clearQueuedTarget()
    autoplayTimerRef.current = window.setTimeout(() => {
      void playTargetTone(frequency)
    }, 180)
  }, [clearQueuedTarget, playTargetTone])

  const handleSetupWakeAudio = useCallback(async () => {
    if (game.view !== 'setup') {
      return
    }

    await unlockAudio()
    await startAmbient()
  }, [game.view, startAmbient, unlockAudio])

  useEffect(() => {
    return () => {
      clearQueuedTarget()
      clearMemoryTimers()
      stopAmbient()
      stopAll()
    }
  }, [clearMemoryTimers, clearQueuedTarget, stopAmbient, stopAll])

  useEffect(() => {
    if (game.view !== 'setup') {
      stopAmbient()
      return undefined
    }

    if (audioReady) {
      void startAmbient()
      return undefined
    }

    const unlockLandingAudio = async () => {
      await unlockAudio()
      await startAmbient()
    }

    window.addEventListener('pointerdown', unlockLandingAudio, { passive: true })
    window.addEventListener('keydown', unlockLandingAudio)

    return () => {
      window.removeEventListener('pointerdown', unlockLandingAudio)
      window.removeEventListener('keydown', unlockLandingAudio)
    }
  }, [audioReady, game.view, startAmbient, stopAmbient, unlockAudio])

  useEffect(() => {
    if (
      game.view !== 'guessing' ||
      !isPitchGame ||
      !game.round ||
      game.round.phase !== 'memorize'
    ) {
      clearMemoryTimers()
      return undefined
    }

    const startedAt = performance.now()
    queueTargetPlayback(game.round.targetFrequency)

    memoryIntervalRef.current = window.setInterval(() => {
      const elapsed = performance.now() - startedAt
      const remainingMs = Math.max(0, GAME_CONFIG.targetDurationMs - elapsed)
      setMemoryTimeLeft(remainingMs / 1000)
    }, 40)

    memoryTimeoutRef.current = window.setTimeout(() => {
      clearMemoryTimers()
      setMemoryTimeLeft(0)
      const turnStartedAt = performance.now()
      setGame((current) => {
        if (!current.round || current.round.id !== game.round.id) {
          return current
        }

        return {
          ...current,
          round: {
            ...current.round,
            phase: 'guess',
            guessStartedAt: {
              ...current.round.guessStartedAt,
              [current.round.activePlayer]: turnStartedAt,
            },
          },
        }
      })
    }, GAME_CONFIG.targetDurationMs)

    return () => {
      clearMemoryTimers()
    }
  }, [clearMemoryTimers, game.round, game.view, isPitchGame, queueTargetPlayback])

  useEffect(() => {
    if (
      game.view !== 'guessing' ||
      !isPitchGame ||
      !previewRoundId ||
      previewPhase !== 'guess'
    ) {
      stopPreview()
      return undefined
    }

    void startPreview(liveSelectionRef.current)

    return () => {
      stopPreview()
    }
  }, [
    game.view,
    isPitchGame,
    previewPhase,
    previewPlayerId,
    previewRoundId,
    startPreview,
    stopPreview,
  ])

  useEffect(() => {
    if (!isChordTrainer || game.view !== 'trainer' || !trainerRound) {
      stopChord()
      return undefined
    }

    void playChord(trainerRound.notes, {
      duration: TRAINER_CONFIG.playbackDuration,
    })

    return () => {
      stopChord()
    }
  }, [game.view, isChordTrainer, playChord, stopChord, trainerRound])

  useEffect(() => {
    if (!isNoteTrainer || game.view !== 'noteTrainer' || !noteRound) {
      stopNote()
      return undefined
    }

    void playNote(noteRound.targetNote, {
      duration: NOTE_TRAINER_CONFIG.playbackDuration,
    })

    return () => {
      stopNote()
    }
  }, [game.view, isNoteTrainer, noteRound, playNote, stopNote])

  useEffect(() => {
    if (!isFocusMode || game.view !== 'focus' || !game.focusIsPlaying) {
      return undefined
    }

    focusStartedAtRef.current = performance.now()

    const intervalId = window.setInterval(() => {
      const elapsed = performance.now() - focusStartedAtRef.current + focusElapsedBaseRef.current

      setGame((current) => {
        if (current.view !== 'focus' || !current.focusIsPlaying) {
          return current
        }

        return {
          ...current,
          focusElapsedMs: elapsed,
        }
      })
    }, 100)

    return () => {
      window.clearInterval(intervalId)
    }
  }, [game.focusIsPlaying, game.view, isFocusMode])

  useEffect(() => {
    if (!isFocusMode || game.view !== 'focus') {
      stopFocus()
      return undefined
    }

    let cancelled = false

    const syncFocusAudio = async () => {
      await unlockAudio()

      if (cancelled) {
        return
      }

      await startFocusSession(game.focusPresetId, game.focusEffects, focusLevelsRef.current)
    }

    void syncFocusAudio()

    return () => {
      cancelled = true
    }
  }, [
    game.focusEffects,
    game.focusPresetId,
    game.view,
    isFocusMode,
    startFocusSession,
    stopFocus,
    unlockAudio,
  ])

  useEffect(() => {
    focusLevelsRef.current = game.focusLevels
  }, [game.focusLevels])

  const beginPitchGame = useCallback((mode) => {
    const firstRound = createRoundState({
      mode,
      roundNumber: 1,
    })

    stopAmbient()
    stopFocus()
    stopAll()
    clearMemoryTimers()
    setMemoryTimeLeft(GAME_CONFIG.targetDurationMs / 1000)
    setGame({
      ...createInitialGameState(),
      view: 'guessing',
      mode,
      roundNumber: 1,
      round: {
        ...firstRound,
        phase: 'memorize',
      },
    })
  }, [clearMemoryTimers, stopAmbient, stopFocus, stopAll])

  const beginTrainerGame = useCallback((difficulty, customChordTypeIds) => {
    const pool = getTrainerPool(difficulty, customChordTypeIds)
    const firstRound = createTrainerRound({
      roundNumber: 1,
      difficulty,
      customChordTypeIds: pool,
    })

    stopAmbient()
    stopFocus()
    stopAll()
    clearMemoryTimers()

    setGame({
      ...createInitialGameState(),
      view: 'trainer',
      mode: 'trainer',
      roundNumber: 1,
      trainerDifficulty: difficulty,
      trainerCustomTypeIds: pool,
      trainerRound: firstRound,
    })
  }, [clearMemoryTimers, stopAmbient, stopFocus, stopAll])

  const beginNoteTrainerGame = useCallback(() => {
    const firstRound = createNoteTrainerRound({
      roundNumber: 1,
    })

    stopAmbient()
    stopFocus()
    stopAll()
    clearMemoryTimers()

    setGame({
      ...createInitialGameState(),
      view: 'noteTrainer',
      mode: 'perfectPitch',
      roundNumber: 1,
      noteRound: firstRound,
    })
  }, [clearMemoryTimers, stopAmbient, stopFocus, stopAll])

  const beginFocusMode = useCallback(() => {
    stopAmbient()
    stopFocus()
    stopAll()
    clearMemoryTimers()
    focusStartedAtRef.current = null
    focusElapsedBaseRef.current = 0

    setGame({
      ...createInitialGameState(),
      view: 'focus',
      mode: 'focus',
    })
  }, [clearMemoryTimers, stopAmbient, stopFocus, stopAll])

  const handleStartGame = async () => {
    await unlockAudio()

    if ((pendingMode ?? selectedMode) === 'trainer') {
      beginTrainerGame(selectedTrainerDifficulty, selectedCustomChordTypeIds)
      return
    }

    if ((pendingMode ?? selectedMode) === 'perfectPitch') {
      beginNoteTrainerGame()
      return
    }

    if ((pendingMode ?? selectedMode) === 'focus') {
      beginFocusMode()
      return
    }

    beginPitchGame(pendingMode ?? selectedMode)
  }

  const handleSelectionChange = (playerId, nextFrequency) => {
    const clampedFrequency = clampFrequency(nextFrequency)

    setGame((current) => {
      if (!current.round) {
        return current
      }

      return {
        ...current,
        round: {
          ...current.round,
          selections: {
            ...current.round.selections,
            [playerId]: clampedFrequency,
          },
        },
      }
    })

    if (game.round?.activePlayer === playerId && isPreviewPlaying) {
      updatePreview(clampedFrequency)
    }
  }

  const handleStagePointerDown = async (event) => {
    if (game.view !== 'guessing' || !isPitchGame || game.round?.phase !== 'guess') {
      return
    }

    await unlockAudio()

    const currentValue = frequencyToSliderValue(
      game.round.selections[game.round.activePlayer],
    )

    dragStateRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startValue: currentValue,
    }

    event.currentTarget.setPointerCapture?.(event.pointerId)
  }

  const handleStagePointerMove = (event) => {
    if (
      !isPitchGame ||
      !dragStateRef.current ||
      dragStateRef.current.pointerId !== event.pointerId
    ) {
      return
    }

    const deltaY = event.clientY - dragStateRef.current.startY
    const nextSliderValue = Math.max(
      0,
      Math.min(
        GAME_CONFIG.sliderResolution,
        dragStateRef.current.startValue - deltaY * 1.35,
      ),
    )

    handleSelectionChange(
      game.round.activePlayer,
      sliderValueToFrequency(nextSliderValue),
    )
  }

  const handleStagePointerUp = (event) => {
    if (dragStateRef.current?.pointerId !== event.pointerId) {
      return
    }

    dragStateRef.current = null
    event.currentTarget.releasePointerCapture?.(event.pointerId)
  }

  const handleSubmitGuess = () => {
    if (!game.round || !isPitchGame) {
      return
    }

    stopPreview()

    const activePlayerId = game.round.activePlayer
    const activeGuess = game.round.selections[activePlayerId]
    const activeResponseTime = game.round.guessStartedAt[activePlayerId] == null
      ? null
      : Number(
        ((performance.now() - game.round.guessStartedAt[activePlayerId]) / 1000).toFixed(2),
      )

    if (game.mode === 'duo' && activePlayerId === 'p1') {
      setGame((current) => {
        if (!current.round) {
          return current
        }

        return {
          ...current,
          round: {
            ...current.round,
            guesses: {
              ...current.round.guesses,
              p1: activeGuess,
            },
            responseTimes: {
              ...current.round.responseTimes,
              p1: activeResponseTime,
            },
            activePlayer: 'p2',
            phase: 'memorize',
          },
        }
      })
      setMemoryTimeLeft(GAME_CONFIG.targetDurationMs / 1000)
      return
    }

    const guesses = {
      ...game.round.guesses,
      [activePlayerId]: activeGuess,
    }
    const responseTimes = {
      ...game.round.responseTimes,
      [activePlayerId]: activeResponseTime,
    }

    const roundResolution = resolveRound({
      mode: game.mode,
      targetFrequency: game.round.targetFrequency,
      guesses,
      responseTimes,
      isPlayoff: game.isPlayoff,
      playoffStake: getPlayoffStake(game.playoffRoundIndex),
    })

    const updatedScores = {
      p1: game.scores.p1 + roundResolution.scoreDelta.p1,
      p2: game.scores.p2 + roundResolution.scoreDelta.p2,
    }

    const roundRecord = {
      ...roundResolution,
      kind: 'pitch',
      mode: game.mode,
      roundNumber: game.roundNumber,
      isPlayoff: game.isPlayoff,
      playoffCycle: game.playoffCycle,
      playoffRoundIndex: game.playoffRoundIndex,
      label: getStageRoundLabel({
        roundNumber: game.roundNumber,
        isPlayoff: game.isPlayoff,
        playoffCycle: game.playoffCycle,
        playoffRoundIndex: game.playoffRoundIndex,
      }),
      scoreAfter: updatedScores,
      targetFrequency: game.round.targetFrequency,
      responseTimes,
    }

    setGame((current) => ({
      ...current,
      view: 'roundResult',
      scores: updatedScores,
      history: [...current.history, roundRecord],
      lastResult: roundRecord,
      round: {
        ...current.round,
        guesses,
        responseTimes,
      },
    }))
  }

  const handleReplayTrainerChord = async () => {
    await unlockAudio()

    const notes = game.trainerRound?.notes ?? game.lastTrainerResult?.notes

    if (!notes?.length) {
      return
    }

    void playChord(notes, {
      duration: TRAINER_CONFIG.playbackDuration,
    })
  }

  const handleTrainerChoice = async (selectedChoiceId) => {
    if (game.view !== 'trainer' || !game.trainerRound) {
      return
    }

    await unlockAudio()
    stopChord()

    const correct = selectedChoiceId === game.trainerRound.chordTypeId
    const nextScore = game.scores.p1 + (correct ? 1 : 0)
    const nextStreak = correct ? game.trainerStreak + 1 : 0
    const nextBestStreak = Math.max(game.trainerBestStreak, nextStreak)

    const result = {
      kind: 'trainer',
      roundNumber: game.roundNumber,
      difficulty: game.trainerDifficulty,
      selectedChoiceId,
      correctChoiceId: game.trainerRound.chordTypeId,
      correct,
      rootLabel: game.trainerRound.rootLabel,
      notes: game.trainerRound.notes,
      scoreAfter: nextScore,
      streakAfter: nextStreak,
      bestStreakAfter: nextBestStreak,
    }

    setGame((current) => ({
      ...current,
      view: 'trainerResult',
      scores: {
        p1: nextScore,
        p2: 0,
      },
      history: [...current.history, result],
      lastTrainerResult: result,
      trainerStreak: nextStreak,
      trainerBestStreak: nextBestStreak,
    }))
  }

  const handleReplayNote = async () => {
    await unlockAudio()

    const note = game.noteRound?.targetNote ?? game.lastNoteResult?.correctChoiceId

    if (!note) {
      return
    }

    void playNote(note, {
      duration: NOTE_TRAINER_CONFIG.playbackDuration,
    })
  }

  const handleNoteChoice = async (selectedChoiceId) => {
    if (game.view !== 'noteTrainer' || !game.noteRound) {
      return
    }

    await unlockAudio()
    stopNote()

    const correct = selectedChoiceId === game.noteRound.targetNote
    const nextScore = game.scores.p1 + (correct ? 1 : 0)
    const nextStreak = correct ? game.noteStreak + 1 : 0
    const nextBestStreak = Math.max(game.noteBestStreak, nextStreak)

    const result = {
      kind: 'perfectPitch',
      roundNumber: game.roundNumber,
      selectedChoiceId,
      correctChoiceId: game.noteRound.targetNote,
      correct,
      scoreAfter: nextScore,
      streakAfter: nextStreak,
      bestStreakAfter: nextBestStreak,
    }

    setGame((current) => ({
      ...current,
      view: 'noteTrainerResult',
      scores: {
        p1: nextScore,
        p2: 0,
      },
      history: [...current.history, result],
      lastNoteResult: result,
      noteStreak: nextStreak,
      noteBestStreak: nextBestStreak,
    }))
  }

  const handleSelectFocusPreset = (presetId) => {
    setGame((current) => ({
      ...current,
      focusPresetId: presetId,
    }))
  }

  const handleToggleFocusEffect = (effectId) => {
    const nextEffects = game.focusEffects.includes(effectId)
      ? game.focusEffects.filter((entry) => entry !== effectId)
      : [...game.focusEffects, effectId]

    setGame((current) => ({
      ...current,
      focusEffects: nextEffects,
    }))
  }

  const handleAdjustFocusLevel = (channel, value) => {
    const nextLevels = {
      ...game.focusLevels,
      [channel]: value,
    }

    focusLevelsRef.current = nextLevels

    setGame((current) => ({
      ...current,
      focusLevels: {
        ...current.focusLevels,
        [channel]: value,
      },
    }))

    updateFocusLevels(nextLevels)
  }

  const handleToggleFocusPanel = (open) => {
    setGame((current) => ({
      ...current,
      focusPanelOpen: open,
    }))
  }

  const handleStartFocusSession = async () => {
    await unlockAudio()

    setGame((current) => {
      if (current.focusIsPlaying) {
        return {
          ...current,
          focusEditing: false,
          focusPanelOpen: false,
        }
      }

      focusStartedAtRef.current = performance.now()
      focusElapsedBaseRef.current = current.focusElapsedMs

      return {
        ...current,
        focusIsPlaying: true,
        focusEditing: false,
        focusPanelOpen: false,
      }
    })
  }

  const handleEditFocusSession = () => {
    setGame((current) => ({
      ...current,
      focusEditing: true,
      focusPanelOpen: false,
    }))
  }

  const handleEndFocusSession = () => {
    focusStartedAtRef.current = null
    focusElapsedBaseRef.current = 0
    stopFocus()
    setGame((current) => ({
      ...current,
      focusIsPlaying: false,
      focusEditing: false,
      focusElapsedMs: 0,
      focusPanelOpen: false,
    }))
  }

  const handleAdvance = () => {
    clearQueuedTarget()
    clearMemoryTimers()
    stopAll()

    if (isChordTrainer) {
      if (game.roundNumber >= TRAINER_CONFIG.totalRounds) {
        setGame((current) => ({
          ...current,
          view: 'final',
        }))
        return
      }

      const nextRoundNumber = game.roundNumber + 1
      const nextRound = createTrainerRound({
        roundNumber: nextRoundNumber,
        difficulty: game.trainerDifficulty,
        customChordTypeIds: game.trainerCustomTypeIds,
      })

      setGame((current) => ({
        ...current,
        view: 'trainer',
        roundNumber: nextRoundNumber,
        trainerRound: nextRound,
        lastTrainerResult: null,
      }))
      return
    }

    if (isNoteTrainer) {
      if (game.roundNumber >= NOTE_TRAINER_CONFIG.totalRounds) {
        setGame((current) => ({
          ...current,
          view: 'final',
        }))
        return
      }

      const nextRoundNumber = game.roundNumber + 1
      const nextRound = createNoteTrainerRound({
        roundNumber: nextRoundNumber,
        previousTargetNote: game.noteRound?.targetNote ?? game.lastNoteResult?.correctChoiceId ?? null,
      })

      setGame((current) => ({
        ...current,
        view: 'noteTrainer',
        roundNumber: nextRoundNumber,
        noteRound: nextRound,
        lastNoteResult: null,
      }))
      return
    }

    if (isFocusMode) {
      return
    }

    if (!game.lastResult) {
      return
    }

    if (game.isPlayoff) {
      if (game.lastResult.playoffAutoWinId || game.lastResult.playoffWinnerId) {
        setGame((current) => ({
          ...current,
          view: 'final',
        }))
        return
      }

      let nextPlayoffRoundIndex = game.playoffRoundIndex + 1
      let nextPlayoffCycle = game.playoffCycle

      if (nextPlayoffRoundIndex >= GAME_CONFIG.playoffStakes.length) {
        nextPlayoffRoundIndex = 0
        nextPlayoffCycle += 1
      }

      const nextRound = createRoundState({
        mode: game.mode,
        roundNumber: game.roundNumber,
        isPlayoff: true,
        playoffCycle: nextPlayoffCycle,
        playoffRoundIndex: nextPlayoffRoundIndex,
      })

      setGame((current) => ({
        ...current,
        view: 'guessing',
        playoffCycle: nextPlayoffCycle,
        playoffRoundIndex: nextPlayoffRoundIndex,
        round: {
          ...nextRound,
          phase: 'memorize',
        },
      }))
      setMemoryTimeLeft(GAME_CONFIG.targetDurationMs / 1000)
      return
    }

    if (game.roundNumber < GAME_CONFIG.totalRounds) {
      const nextRoundNumber = game.roundNumber + 1
      const nextRound = createRoundState({
        mode: game.mode,
        roundNumber: nextRoundNumber,
      })

      setGame((current) => ({
        ...current,
        view: 'guessing',
        roundNumber: nextRoundNumber,
        round: {
          ...nextRound,
          phase: 'memorize',
        },
      }))
      setMemoryTimeLeft(GAME_CONFIG.targetDurationMs / 1000)
      return
    }

    if (game.mode === 'solo') {
      setGame((current) => ({
        ...current,
        view: 'final',
      }))
      return
    }

    if (game.scores.p1 === game.scores.p2) {
      const firstPlayoffRound = createRoundState({
        mode: game.mode,
        roundNumber: game.roundNumber,
        isPlayoff: true,
        playoffCycle: 1,
        playoffRoundIndex: 0,
      })

      setGame((current) => ({
        ...current,
        view: 'guessing',
        isPlayoff: true,
        playoffCycle: 1,
        playoffRoundIndex: 0,
        round: {
          ...firstPlayoffRound,
          phase: 'memorize',
        },
      }))
      setMemoryTimeLeft(GAME_CONFIG.targetDurationMs / 1000)
      return
    }

    setGame((current) => ({
      ...current,
      view: 'final',
    }))
  }

  const handleRestartSameMode = async () => {
    await unlockAudio()
    setPendingMode(null)

    if (isChordTrainer) {
      beginTrainerGame(game.trainerDifficulty, game.trainerCustomTypeIds)
      return
    }

    if (isNoteTrainer) {
      beginNoteTrainerGame()
      return
    }

    if (isFocusMode) {
      beginFocusMode()
      return
    }

    beginPitchGame(game.mode)
  }

  const handleReturnHome = () => {
    clearQueuedTarget()
    clearMemoryTimers()
    focusStartedAtRef.current = null
    focusElapsedBaseRef.current = 0
    stopFocus()
    stopAll()
    setSelectedMode(game.mode)
    setPendingMode(null)
    setGame(createInitialGameState())
  }

  const toggleCustomChordType = (chordTypeId) => {
    setSelectedCustomChordTypeIds((current) => {
      if (current.includes(chordTypeId)) {
        if (current.length === 1) {
          return current
        }

        return current.filter((entry) => entry !== chordTypeId)
      }

      return [...current, chordTypeId]
    })
  }

  const activePlayerId = game.round?.activePlayer ?? 'p1'
  const activePlayerMeta = PLAYER_META[activePlayerId]
  const activeSelection = game.round?.selections[activePlayerId] ?? GAME_CONFIG.defaultFrequency

  useEffect(() => {
    liveSelectionRef.current = activeSelection
  }, [activeSelection])

  const roundLabel = game.round
    ? getStageRoundLabel({
      roundNumber: game.roundNumber,
      isPlayoff: game.isPlayoff,
      playoffCycle: game.playoffCycle,
      playoffRoundIndex: game.playoffRoundIndex,
    })
    : null

  const trainerRoundLabel = `${game.roundNumber}/${TRAINER_CONFIG.totalRounds}`
  const noteTrainerRoundLabel = `${game.roundNumber}/${NOTE_TRAINER_CONFIG.totalRounds}`
  const finalSummary = buildFinalSummary(game)
  const resultFocusPlayerId = getResultFocusPlayerId(game)

  return (
    <main
      className="app-shell"
      onPointerDown={game.view === 'setup' ? () => void handleSetupWakeAudio() : undefined}
      onKeyDown={game.view === 'setup' ? () => void handleSetupWakeAudio() : undefined}
    >
      <div className="background-field" aria-hidden="true">
        <SoftAurora
          speed={0.5}
          scale={1.36}
          brightness={0.78}
          color1="#ffffff"
          color2="#f0a8ff"
          noiseFrequency={2.2}
          noiseAmplitude={0.92}
          bandHeight={0.56}
          bandSpread={0.96}
          octaveDecay={0.1}
          layerOffset={0.14}
          colorSpeed={0.7}
          enableMouseInteraction={false}
          mouseInfluence={0.25}
        />
      </div>

      <section
        className={`game-card view-${game.view}${game.view === 'focus' && game.focusIsPlaying && !game.focusEditing ? ' focus-session-active' : ''}`}
      >
        {game.view === 'setup' ? (
          <header className="hero-bar is-setup">
            <div>
              <h1 className="brand-mark">
                <ShinyText
                  text="pitch"
                  speed={2.6}
                  delay={0.2}
                  color="#cfc9c1"
                  shineColor="#ffffff"
                  spread={112}
                  direction="left"
                  yoyo={false}
                  pauseOnHover={false}
                  disabled={false}
                />
              </h1>
            </div>
          </header>
        ) : null}

        {game.view === 'setup' ? (
          <section className="setup-stage">
            <div className="mode-grid" role="radiogroup" aria-label="Game mode">
              {Object.entries(MODE_META).map(([mode, meta]) => (
                <button
                  key={mode}
                  type="button"
                  className={`mode-orb ${pendingMode === mode ? 'is-selected' : ''}`}
                  onClick={() => {
                    void handleSetupWakeAudio()
                    setSelectedMode(mode)
                    setPendingMode(mode)
                  }}
                  aria-pressed={pendingMode === mode}
                  aria-label={meta.label}
                >
                  <span className="mode-orb-core">
                    {mode === 'solo' ? (
                      <SoloIcon />
                    ) : mode === 'duo' ? (
                      <DuoIcon />
                    ) : mode === 'perfectPitch' ? (
                      <PitchIcon />
                    ) : mode === 'focus' ? (
                      <FocusIcon />
                    ) : (
                      <TrainerIcon />
                    )}
                  </span>
                  <span className="mode-label">{meta.label}</span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {game.view === 'guessing' && game.round ? (
          <GameplayStage
            phase={game.round.phase}
            roundLabel={roundLabel}
            playerLabel={game.mode === 'solo' ? '' : activePlayerMeta.label}
            selection={activeSelection}
            timeLeft={memoryTimeLeft}
            helperText={
              game.round.phase === 'memorize'
                ? ''
                : game.mode === 'solo'
                  ? 'Hold and drag anywhere. Up goes higher.'
                  : `${activePlayerMeta.label}. Hold and drag anywhere. Up goes higher. Fastest lock gets +1.`
            }
            onSubmit={handleSubmitGuess}
            onPointerDown={handleStagePointerDown}
            onPointerMove={handleStagePointerMove}
            onPointerUp={handleStagePointerUp}
            onPointerCancel={handleStagePointerUp}
            interactive={game.round.phase === 'guess'}
            amplitude={normalizeWaveAmplitude(activeSelection)}
          />
        ) : null}

        {game.view === 'roundResult' && game.lastResult ? (
          <GameplayStage
            phase="result"
            roundLabel={getStageRoundLabel({
              roundNumber: game.lastResult.roundNumber,
              isPlayoff: game.lastResult.isPlayoff,
              playoffCycle: game.lastResult.playoffCycle,
              playoffRoundIndex: game.lastResult.playoffRoundIndex,
            })}
            playerLabel=""
            targetFrequency={game.lastResult.targetFrequency}
            guessFrequency={game.lastResult.players[resultFocusPlayerId]?.guess ?? activeSelection}
            pointsAwarded={game.lastResult.players[resultFocusPlayerId]?.pointsAwarded ?? 0}
            difference={game.lastResult.players[resultFocusPlayerId]?.difference ?? 0}
            helperText={buildResultHelperText(game, resultFocusPlayerId)}
            onAdvance={handleAdvance}
            amplitude={normalizeWaveAmplitude(game.lastResult.targetFrequency)}
          />
        ) : null}

        {game.view === 'trainer' && game.trainerRound ? (
          <ChordTrainerStage
            phase="prompt"
            roundLabel={trainerRoundLabel}
            difficultyLabel={TRAINER_DIFFICULTIES[game.trainerDifficulty].label}
            choiceIds={game.trainerRound.pool}
            chordTypesById={CHORD_TYPE_MAP}
            score={game.scores.p1}
            streak={game.trainerStreak}
            onReplay={handleReplayTrainerChord}
            onChoose={handleTrainerChoice}
          />
        ) : null}

        {game.view === 'trainerResult' && game.lastTrainerResult ? (
          <ChordTrainerStage
            phase="result"
            roundLabel={trainerRoundLabel}
            difficultyLabel={TRAINER_DIFFICULTIES[game.trainerDifficulty].label}
            choiceIds={game.trainerCustomTypeIds}
            chordTypesById={CHORD_TYPE_MAP}
            selectedChoiceId={game.lastTrainerResult.selectedChoiceId}
            correctChoiceId={game.lastTrainerResult.correctChoiceId}
            rootLabel={game.lastTrainerResult.rootLabel}
            score={game.lastTrainerResult.scoreAfter}
            streak={game.lastTrainerResult.streakAfter}
            onReplay={handleReplayTrainerChord}
            onAdvance={handleAdvance}
          />
        ) : null}

        {game.view === 'noteTrainer' && game.noteRound ? (
          <PerfectPitchStage
            phase="prompt"
            roundLabel={noteTrainerRoundLabel}
            choices={game.noteRound.choices}
            score={game.scores.p1}
            streak={game.noteStreak}
            onReplay={handleReplayNote}
            onChoose={handleNoteChoice}
          />
        ) : null}

        {game.view === 'noteTrainerResult' && game.lastNoteResult ? (
          <PerfectPitchStage
            phase="result"
            roundLabel={noteTrainerRoundLabel}
            choices={game.noteRound?.choices ?? []}
            score={game.lastNoteResult.scoreAfter}
            streak={game.lastNoteResult.streakAfter}
            selectedChoiceId={game.lastNoteResult.selectedChoiceId}
            correctChoiceId={game.lastNoteResult.correctChoiceId}
            onReplay={handleReplayNote}
            onAdvance={handleAdvance}
          />
        ) : null}

        {game.view === 'focus' ? (
          <FocusModeStage
            presetId={game.focusPresetId}
            presets={FOCUS_PRESETS}
            effects={FOCUS_EFFECTS}
            activeEffects={game.focusEffects}
            levels={game.focusLevels}
            elapsedMs={game.focusElapsedMs}
            isPlaying={game.focusIsPlaying}
            isEditing={game.focusEditing}
            panelOpen={game.focusPanelOpen}
            onTogglePanel={handleToggleFocusPanel}
            onSelectPreset={handleSelectFocusPreset}
            onToggleEffect={handleToggleFocusEffect}
            onAdjustLevel={handleAdjustFocusLevel}
            onStartSession={handleStartFocusSession}
            onEndSession={handleEndFocusSession}
            onHome={handleReturnHome}
          />
        ) : null}

        {game.view === 'final' ? (
          <section className="final-panel">
            <div className="console-header">
              <span className="section-kicker">
                {isChordTrainer || isNoteTrainer ? 'Trainer Complete' : 'Game Complete'}
              </span>
              <p className="console-prompt">{finalSummary.headline}</p>
              <p className="console-status">{finalSummary.copy}</p>
            </div>

            <div className="final-score-grid">
              <article className="score-tile is-large">
                <span className="score-label">
                  {isChordTrainer || isNoteTrainer ? 'Correct' : 'Final Score'}
                </span>
                <strong>
                  {isChordTrainer
                    ? `${game.scores.p1}/${TRAINER_CONFIG.totalRounds}`
                    : isNoteTrainer
                      ? `${game.scores.p1}/${NOTE_TRAINER_CONFIG.totalRounds}`
                    : game.mode === 'solo'
                      ? `${game.scores.p1} pts`
                      : `${game.scores.p1} - ${game.scores.p2}`}
                </strong>
              </article>

              <article className="score-tile">
                <span className="score-label">{finalSummary.statOneLabel}</span>
                <strong>{finalSummary.statOneValue}</strong>
              </article>

              <article className="score-tile">
                <span className="score-label">{finalSummary.statTwoLabel}</span>
                <strong>{finalSummary.statTwoValue}</strong>
              </article>
            </div>

            <div className="setup-actions">
              <button type="button" className="primary-button" onClick={handleRestartSameMode}>
                Play Again
              </button>
              <button type="button" className="secondary-button" onClick={handleReturnHome}>
                Home
              </button>
            </div>
          </section>
        ) : null}
      </section>

      {game.view === 'focus' && game.focusIsPlaying && !game.focusEditing && game.focusPanelOpen ? (
        <div className="modal-backdrop focus-modal-backdrop" onClick={() => handleToggleFocusPanel(false)}>
          <div className="confirm-modal focus-session-modal" onClick={(event) => event.stopPropagation()}>
            <p className="confirm-label">Session</p>
            <p className="console-prompt">Keep the clock running, change the room when you need to.</p>
            <div className="trainer-actions focus-actions">
              <button type="button" className="secondary-button trainer-replay" onClick={handleEditFocusSession}>
                Edit Sound
              </button>
              <button type="button" className="primary-button focus-toggle" onClick={handleEndFocusSession}>
                End Session
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {game.view === 'setup' && pendingMode ? (
        <div className="modal-backdrop" role="presentation" onClick={() => setPendingMode(null)}>
          <div
            className="confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-title"
            onClick={(event) => event.stopPropagation()}
          >
            <p className="confirm-label">{MODE_META[pendingMode].label}</p>
            <h2 id="confirm-title">
              {pendingMode === 'trainer' || pendingMode === 'perfectPitch' || pendingMode === 'focus'
                ? 'Start trainer?'
                : 'Start game?'}
            </h2>
            <p className="status-copy">
              {buildPendingCopy(pendingMode, selectedTrainerDifficulty)}
            </p>

            {pendingMode === 'trainer' ? (
              <div className="trainer-config">
                <div className="trainer-difficulty-row">
                  {Object.entries(TRAINER_DIFFICULTIES).map(([difficultyId, difficulty]) => (
                    <button
                      key={difficultyId}
                      type="button"
                      className={`trainer-pill ${
                        selectedTrainerDifficulty === difficultyId ? 'is-active' : ''
                      }`}
                      onClick={() => setSelectedTrainerDifficulty(difficultyId)}
                    >
                      {difficulty.label}
                    </button>
                  ))}
                </div>

                {selectedTrainerDifficulty === 'custom' ? (
                  <div className="trainer-custom-grid">
                    {CHORD_TYPES.map((chordType) => (
                      <button
                        key={chordType.id}
                        type="button"
                        className={`trainer-chip ${
                          selectedCustomChordTypeIds.includes(chordType.id) ? 'is-active' : ''
                        }`}
                        onClick={() => toggleCustomChordType(chordType.id)}
                      >
                        {chordType.label}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <div className="setup-actions">
              <button type="button" className="primary-button" onClick={handleStartGame}>
                Confirm
              </button>
              <button
                type="button"
                className="ghost-button"
                onClick={() => setPendingMode(null)}
              >
                Cancel
              </button>
            </div>
            {audioNotice && !audioReady ? <p className="audio-note">{audioNotice}</p> : null}
          </div>
        </div>
      ) : null}
    </main>
  )
}

class AppErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      errorMessage: '',
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message ?? 'Unknown error',
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('pitch runtime error', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <main className="app-shell">
          <section className="game-card">
            <header className="hero-bar">
              <h1 className="brand-mark">pitch</h1>
            </header>
            <section className="final-panel">
              <div className="console-header">
                <span className="section-kicker">Reload Needed</span>
                <p className="console-prompt">Something broke while loading the game.</p>
                <p className="console-status">
                  Refresh the page and try again. If it happens again, I need to inspect
                  that exact transition.
                </p>
                <p className="console-status">{this.state.errorMessage}</p>
              </div>
            </section>
          </section>
        </main>
      )
    }

    return this.props.children
  }
}

function SoloIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mode-icon" aria-hidden="true">
      <path
        d="M12 12.75a4.25 4.25 0 1 0-4.25-4.25A4.25 4.25 0 0 0 12 12.75Zm0 2.5c-4.18 0-7 2.14-7 4.1 0 .64.52 1.15 1.16 1.15h11.68c.64 0 1.16-.51 1.16-1.15 0-1.96-2.82-4.1-7-4.1Z"
        fill="currentColor"
      />
    </svg>
  )
}

function DuoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mode-icon" aria-hidden="true">
      <path
        d="M8.1 11.4a3.3 3.3 0 1 0-3.3-3.3 3.3 3.3 0 0 0 3.3 3.3Zm7.8 0a3.3 3.3 0 1 0-3.3-3.3 3.3 3.3 0 0 0 3.3 3.3ZM8.1 13.3c-2.98 0-5.35 1.5-5.35 3.45 0 .57.46 1.02 1.03 1.02h4.38a4.8 4.8 0 0 1 2.38-3.9 7.2 7.2 0 0 0-2.45-.57Zm7.8 0a7.2 7.2 0 0 0-2.45.57 4.8 4.8 0 0 1 2.38 3.9h4.37c.57 0 1.03-.45 1.03-1.02 0-1.95-2.37-3.45-5.33-3.45ZM12 14.2c-2.9 0-4.95 1.45-4.95 3.45 0 .63.5 1.14 1.14 1.14h7.62c.63 0 1.14-.51 1.14-1.14 0-2-2.05-3.45-4.95-3.45Zm0-1.35a3.52 3.52 0 1 0-3.52-3.52A3.52 3.52 0 0 0 12 12.85Z"
        fill="currentColor"
      />
    </svg>
  )
}

function TrainerIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mode-icon" aria-hidden="true">
      <path
        d="M4.75 6.5a1.75 1.75 0 0 1 3.5 0v11a1.75 1.75 0 0 1-3.5 0Zm5.5-2.5a1.75 1.75 0 1 1 3.5 0v16a1.75 1.75 0 1 1-3.5 0Zm5.5 4.25a1.75 1.75 0 1 1 3.5 0v7.5a1.75 1.75 0 1 1-3.5 0Z"
        fill="currentColor"
      />
    </svg>
  )
}

function PitchIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mode-icon" aria-hidden="true">
      <path
        d="M12 3.25a3.75 3.75 0 0 0-3.75 3.75v6.7a4.75 4.75 0 1 0 7.5 0V7A3.75 3.75 0 0 0 12 3.25Zm-1.25 3.6a1.25 1.25 0 1 1 2.5 0v7.58l.45.32a2.25 2.25 0 1 1-3.4 1.93c0-.74.36-1.43.95-1.85l.5-.35Z"
        fill="currentColor"
      />
    </svg>
  )
}

function FocusIcon() {
  return (
    <svg viewBox="0 0 24 24" className="mode-icon" aria-hidden="true">
      <path
        d="M12 3.5c2.07 2.15 3.1 4.24 3.1 6.27 0 2.6-1.59 4.35-3.1 5.75-1.52-1.4-3.1-3.15-3.1-5.75 0-2.03 1.03-4.12 3.1-6.27Zm0 13.3c3.97 0 7.2 1.38 7.2 3.08 0 .57-.46 1.02-1.03 1.02H5.83c-.57 0-1.03-.45-1.03-1.02 0-1.7 3.23-3.08 7.2-3.08Z"
        fill="currentColor"
      />
    </svg>
  )
}

function buildPendingCopy(pendingMode, selectedTrainerDifficulty) {
  if (pendingMode === 'solo') {
    return 'Five tones. One player. Pure memory.'
  }

  if (pendingMode === 'duo') {
    return 'Take turns matching the same tone across five rounds.'
  }

  if (pendingMode === 'perfectPitch') {
    return 'Two octaves. Every note. Ten rounds to see how close your ear really is.'
  }

  if (pendingMode === 'focus') {
    return 'An evidence-informed focus bed with binaural offsets, low carriers, and a timer.'
  }

  return `${TRAINER_DIFFICULTIES[selectedTrainerDifficulty].label} set. Ten chords. Instant feedback.`
}

function buildFinalSummary(game) {
  if (game.mode === 'trainer') {
    const wrongAnswers = TRAINER_CONFIG.totalRounds - game.scores.p1

    return {
      headline: 'Chord session wrapped.',
      copy: `You cleared ${TRAINER_CONFIG.totalRounds} rounds and named ${game.scores.p1} structures correctly.`,
      statOneLabel: 'Best Streak',
      statOneValue: game.trainerBestStreak,
      statTwoLabel: 'Misses',
      statTwoValue: wrongAnswers,
    }
  }

  if (game.mode === 'perfectPitch') {
    const wrongAnswers = NOTE_TRAINER_CONFIG.totalRounds - game.scores.p1

    return {
      headline: 'Note session wrapped.',
      copy: `You named ${game.scores.p1} notes correctly across ${NOTE_TRAINER_CONFIG.totalRounds} rounds.`,
      statOneLabel: 'Best Streak',
      statOneValue: game.noteBestStreak,
      statTwoLabel: 'Misses',
      statTwoValue: wrongAnswers,
    }
  }

  const perfectHits = game.history.reduce(
    (total, round) =>
      total +
      Object.values(round.players).filter((player) => player?.perfect).length,
    0,
  )

  const closeHits = game.history.reduce(
    (total, round) =>
      total +
      Object.values(round.players).filter(
        (player) => player && player.withinFive && !player.perfect,
      ).length,
    0,
  )

  if (game.mode === 'solo') {
    return {
      headline: 'Solo session wrapped.',
      copy: `You finished all ${GAME_CONFIG.totalRounds} rounds with ${game.scores.p1} total points.`,
      statOneLabel: 'Perfect Hits',
      statOneValue: perfectHits,
      statTwoLabel: 'Within 5 Hz',
      statTwoValue: closeHits,
    }
  }

  const winnerId = game.scores.p1 === game.scores.p2
    ? null
    : game.scores.p1 > game.scores.p2
      ? 'p1'
      : 'p2'
  const playoffFinish = game.history.find(
    (round) => round.playoffAutoWinId || round.playoffWinnerId,
  )

  if (!winnerId) {
    return {
      headline: 'The match finished tied.',
      copy: 'Both players stayed level all the way through the current results set.',
      statOneLabel: 'Perfect Hits',
      statOneValue: perfectHits,
      statTwoLabel: 'Within 5 Hz',
      statTwoValue: closeHits,
    }
  }

  return {
    headline: `${PLAYER_META[winnerId].label} wins.`,
    copy: playoffFinish?.playoffAutoWinId
      ? `${PLAYER_META[winnerId].label} closed the game with a perfect 10.0 playoff hit.`
      : `${PLAYER_META[winnerId].label} finished ahead after ${game.history.length} scored rounds.`,
    statOneLabel: 'Perfect Hits',
    statOneValue: perfectHits,
    statTwoLabel: 'Within 5 Hz',
    statTwoValue: closeHits,
  }
}

function normalizeWaveAmplitude(frequency) {
  const min = Math.log(GAME_CONFIG.frequencyRange.min)
  const max = Math.log(GAME_CONFIG.frequencyRange.max)
  const clamped = Math.min(
    GAME_CONFIG.frequencyRange.max,
    Math.max(GAME_CONFIG.frequencyRange.min, frequency),
  )

  return (Math.log(clamped) - min) / (max - min)
}

function getStageRoundLabel({
  roundNumber,
  isPlayoff,
  playoffCycle,
  playoffRoundIndex,
}) {
  if (isPlayoff) {
    return `p${playoffCycle}.${playoffRoundIndex + 1}`
  }

  return `${roundNumber}/${GAME_CONFIG.totalRounds}`
}

function getResultFocusPlayerId(game) {
  if (game.mode === 'solo' || !game.lastResult) {
    return 'p1'
  }

  const p1Points = game.lastResult.players.p1?.pointsAwarded ?? 0
  const p2Points = game.lastResult.players.p2?.pointsAwarded ?? 0

  if (p1Points === p2Points) {
    const p1Diff = game.lastResult.players.p1?.difference ?? Number.POSITIVE_INFINITY
    const p2Diff = game.lastResult.players.p2?.difference ?? Number.POSITIVE_INFINITY
    return p1Diff <= p2Diff ? 'p1' : 'p2'
  }

  return p1Points > p2Points ? 'p1' : 'p2'
}

function buildResultHelperText(game, focusPlayerId) {
  if (!game.lastResult) {
    return ''
  }

  const focusPlayer = game.lastResult.players[focusPlayerId]

  if (game.mode === 'solo') {
    if (focusPlayer.perfect) {
      return 'Perfect hit.'
    }

    if (focusPlayer.withinFive) {
      return 'Inside five hertz.'
    }

    return 'Outside the scoring window.'
  }

  const otherPlayerId = focusPlayerId === 'p1' ? 'p2' : 'p1'
  const otherPlayer = game.lastResult.players[otherPlayerId]
  const focusLead =
    focusPlayer.pointsAwarded === otherPlayer.pointsAwarded
      ? 'Dead even.'
      : focusPlayer.pointsAwarded > otherPlayer.pointsAwarded
        ? `${PLAYER_META[focusPlayerId].label} took it.`
        : `${PLAYER_META[otherPlayerId].label} took it.`
  const responseTimes = game.lastResult.responseTimes
  const responseText = buildResponseSummary(responseTimes)

  return `${focusLead} ${PLAYER_META[otherPlayerId].label}: ${otherPlayer.guess.toFixed(2)} Hz.${responseText ? ` ${responseText}` : ''}`
}

function buildResponseSummary(responseTimes) {
  if (!responseTimes?.p1 || !responseTimes?.p2) {
    return ''
  }

  const difference = Math.abs(responseTimes.p1 - responseTimes.p2)

  if (difference <= 0.05) {
    return 'Speed bonus tied.'
  }

  return responseTimes.p1 < responseTimes.p2
    ? `Player 1 locked faster in ${responseTimes.p1.toFixed(2)}s.`
    : `Player 2 locked faster in ${responseTimes.p2.toFixed(2)}s.`
}

export default function App() {
  return (
    <AppErrorBoundary>
      <AppContent />
    </AppErrorBoundary>
  )
}
