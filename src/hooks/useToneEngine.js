import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import birdsSample from '../assets/focus/birds.mp3'
import fireplaceSample from '../assets/focus/fireplace.mp3'
import rainSample from '../assets/focus/rain.mp3'
import rainTarpSample from '../assets/focus/rain-tarp.mp3'
import seasideSample from '../assets/focus/seaside.mp3'
import thunderSample from '../assets/focus/thunder.mp3'
import windSample from '../assets/focus/wind.mp3'
import { FOCUS_PRESETS } from '../utils/focus'
import { GAME_CONFIG } from '../utils/game'

const AMBIENT_SEQUENCE = [
  ['D4', 'A4', 'E5'],
  ['B3', 'F#4', 'D5'],
  ['G3', 'D4', 'A4'],
  ['A3', 'E4', 'B4'],
  ['D4', 'A4', 'F#5'],
  ['G3', 'D4', 'B4'],
]

const SAMPLE_LIBRARY = {
  birds: birdsSample,
  fireplace: fireplaceSample,
  rain: rainSample,
  rainTarp: rainTarpSample,
  seaside: seasideSample,
  thunder: thunderSample,
  wind: windSample,
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value))
}

function createLoopingAudio(src, volume) {
  const audio = new Audio(src)
  audio.loop = true
  audio.preload = 'auto'
  audio.playsInline = true
  audio.crossOrigin = 'anonymous'
  audio.volume = clamp01(volume)
  return audio
}

async function waitForReverbReady(reverb) {
  if (reverb?.ready && typeof reverb.ready.then === 'function') {
    try {
      await reverb.ready
    } catch {
      // noop
    }
  }
}

function createPolySynth(output, options = {}) {
  return new Tone.PolySynth(Tone.Synth, {
    oscillator: {
      type: options.type ?? 'triangle8',
    },
    envelope: {
      attack: options.attack ?? 1.8,
      decay: options.decay ?? 0.6,
      sustain: options.sustain ?? 0.84,
      release: options.release ?? 4.2,
    },
    volume: options.volume ?? -8,
  }).connect(output)
}

export function useToneEngine() {
  const ambientRef = useRef(null)
  const previewRef = useRef(null)
  const targetRef = useRef(null)
  const chordRef = useRef(null)
  const noteRef = useRef(null)
  const focusRef = useRef(null)
  const targetTimeoutRef = useRef(null)
  const chordTimeoutRef = useRef(null)
  const noteTimeoutRef = useRef(null)

  const [audioReady, setAudioReady] = useState(false)
  const [audioNotice, setAudioNotice] = useState(
    'Tap anywhere to enable sound in your browser.',
  )
  const [isTargetPlaying, setIsTargetPlaying] = useState(false)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)

  const clearTargetTimeout = useCallback(() => {
    if (targetTimeoutRef.current) {
      window.clearTimeout(targetTimeoutRef.current)
      targetTimeoutRef.current = null
    }
  }, [])

  const clearChordTimeout = useCallback(() => {
    if (chordTimeoutRef.current) {
      window.clearTimeout(chordTimeoutRef.current)
      chordTimeoutRef.current = null
    }
  }, [])

  const clearNoteTimeout = useCallback(() => {
    if (noteTimeoutRef.current) {
      window.clearTimeout(noteTimeoutRef.current)
      noteTimeoutRef.current = null
    }
  }, [])

  const unlockAudio = useCallback(async () => {
    try {
      await Tone.start()

      const context = Tone.getContext().rawContext
      if (context?.state === 'suspended') {
        await context.resume()
      }

      setAudioReady(true)
      setAudioNotice('Audio ready.')
    } catch (error) {
      console.error('unlockAudio failed', error)
      setAudioReady(false)
      setAudioNotice('Audio is blocked until the browser receives a direct user interaction.')
    }
  }, [])

  const stopPreview = useCallback(() => {
    if (!previewRef.current) {
      return
    }

    const { oscillator, gain } = previewRef.current
    gain.gain.rampTo(0, 0.06)
    window.setTimeout(() => {
      try {
        oscillator.stop()
      } catch {
        // noop
      }
      oscillator.dispose()
      gain.dispose()
    }, 90)
    previewRef.current = null
    setIsPreviewPlaying(false)
  }, [])

  const disposeTarget = useCallback(() => {
    clearTargetTimeout()
    if (!targetRef.current) {
      setIsTargetPlaying(false)
      return
    }

    const { synth, gain } = targetRef.current
    synth.triggerRelease()
    window.setTimeout(() => {
      synth.dispose()
      gain.dispose()
    }, 220)
    targetRef.current = null
    setIsTargetPlaying(false)
  }, [clearTargetTimeout])

  const stopChord = useCallback(() => {
    clearChordTimeout()
    if (!chordRef.current) {
      return
    }

    const { synth, subSynth, gain } = chordRef.current
    synth.releaseAll()
    subSynth?.releaseAll?.()
    window.setTimeout(() => {
      synth.dispose()
      subSynth?.dispose?.()
      gain.dispose()
    }, 260)
    chordRef.current = null
  }, [clearChordTimeout])

  const stopNote = useCallback(() => {
    clearNoteTimeout()
    if (!noteRef.current) {
      return
    }

    const { synth, gain } = noteRef.current
    synth.releaseAll()
    window.setTimeout(() => {
      synth.dispose()
      gain.dispose()
    }, 240)
    noteRef.current = null
  }, [clearNoteTimeout])

  const stopAll = useCallback(() => {
    stopPreview()
    disposeTarget()
    stopChord()
    stopNote()
  }, [disposeTarget, stopChord, stopNote, stopPreview])

  const stopAmbient = useCallback(() => {
    if (!ambientRef.current) {
      return
    }

    const ambientSession = ambientRef.current
    ambientSession.timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))
    ambientSession.padSynth.releaseAll()
    ambientSession.bassSynth.releaseAll()
    ambientSession.shimmerSynth.releaseAll()
    ambientSession.subSynth.releaseAll()
    ambientRef.current = null

    window.setTimeout(() => {
      ambientSession.padSynth.dispose()
      ambientSession.bassSynth.dispose()
      ambientSession.shimmerSynth.dispose()
      ambientSession.subSynth.dispose()
      ambientSession.padFilter.dispose()
      ambientSession.bassFilter.dispose()
      ambientSession.shimmerFilter.dispose()
      ambientSession.masterFilter.dispose()
      ambientSession.padGain.dispose()
      ambientSession.bassGain.dispose()
      ambientSession.shimmerGain.dispose()
      ambientSession.subGain.dispose()
      ambientSession.subFilter.dispose()
      ambientSession.padMotion.dispose()
      ambientSession.shimmerMotion.dispose()
      ambientSession.chorus.dispose()
      ambientSession.reverb.dispose()
      ambientSession.gain.dispose()
    }, 320)
  }, [])

  const stopFocus = useCallback(() => {
    if (!focusRef.current) {
      return
    }

    const focusSession = focusRef.current
    focusSession.timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId))

    focusSession.padSynth.releaseAll()
    focusSession.shimmerSynth.releaseAll()
    focusSession.droneSynth.releaseAll()

    try {
      focusSession.leftOsc.stop()
      focusSession.rightOsc.stop()
      focusSession.noise.stop()
    } catch {
      // noop
    }

    Object.values(focusSession.samples).forEach((audio) => {
      try {
        audio.pause()
        audio.currentTime = 0
      } catch {
        // noop
      }
    })
    focusRef.current = null

    window.setTimeout(() => {
      focusSession.leftOsc.dispose()
      focusSession.rightOsc.dispose()
      focusSession.leftGain.dispose()
      focusSession.rightGain.dispose()
      focusSession.leftPan.dispose()
      focusSession.rightPan.dispose()
      focusSession.noise.dispose()
      focusSession.noiseFilter.dispose()
      focusSession.noiseGain.dispose()
      focusSession.padSynth.dispose()
      focusSession.shimmerSynth.dispose()
      focusSession.droneSynth.dispose()
      focusSession.padGain.dispose()
      focusSession.shimmerGain.dispose()
      focusSession.droneGain.dispose()
      focusSession.padFilter.dispose()
      focusSession.shimmerFilter.dispose()
      focusSession.droneFilter.dispose()
      focusSession.masterFilter.dispose()
      focusSession.chorus.dispose()
      focusSession.padMotion.dispose()
      focusSession.shimmerMotion.dispose()
      focusSession.reverb.dispose()
      focusSession.delay.dispose()
    }, 320)
  }, [])

  const startAmbient = useCallback(async () => {
    await unlockAudio()

    if (ambientRef.current) {
      return
    }

    const gain = new Tone.Gain(0.72).toDestination()
    const masterFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 3000,
      rolloff: -24,
      Q: 0.2,
    }).connect(gain)
    const chorus = new Tone.Chorus({
      frequency: 0.08,
      delayTime: 4.1,
      depth: 0.23,
      spread: 120,
      wet: 0.2,
    }).start()
    chorus.connect(masterFilter)
    const reverb = new Tone.Reverb({
      decay: 16,
      wet: 0.34,
      preDelay: 0.06,
    }).connect(chorus)
    await waitForReverbReady(reverb)

    const padGain = new Tone.Gain(0.94)
    const padFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 2350,
      rolloff: -24,
      Q: 0.28,
    })
    padGain.connect(padFilter)
    padFilter.connect(reverb)

    const bassGain = new Tone.Gain(1.14)
    const bassFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 400,
      rolloff: -24,
      Q: 0.22,
    })
    bassGain.connect(bassFilter)
    bassFilter.connect(masterFilter)

    const shimmerGain = new Tone.Gain(0.18)
    const shimmerFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 3150,
      rolloff: -24,
      Q: 0.16,
    })
    shimmerGain.connect(shimmerFilter)
    shimmerFilter.connect(reverb)

    const subGain = new Tone.Gain(0.58)
    const subFilter = new Tone.Filter({
      type: 'lowpass',
      frequency: 180,
      rolloff: -24,
      Q: 0.12,
    })
    subGain.connect(subFilter)
    subFilter.connect(masterFilter)

    const padMotion = new Tone.LFO({
      frequency: 0.01,
      min: 1750,
      max: 2520,
    }).start()
    padMotion.connect(padFilter.frequency)

    const shimmerMotion = new Tone.LFO({
      frequency: 0.014,
      min: 2100,
      max: 3200,
    }).start()
    shimmerMotion.connect(shimmerFilter.frequency)

    const padSynth = createPolySynth(padGain, {
      type: 'triangle8',
      attack: 3.2,
      decay: 0.7,
      sustain: 0.94,
      release: 6.2,
      volume: -6,
    })

    const bassSynth = createPolySynth(bassGain, {
      type: 'sine',
      attack: 2.8,
      decay: 0.4,
      sustain: 0.96,
      release: 5.9,
      volume: -7,
    })

    const shimmerSynth = createPolySynth(shimmerGain, {
      type: 'triangle',
      attack: 2.8,
      decay: 0.3,
      sustain: 0.34,
      release: 3.8,
      volume: -18,
    })

    const subSynth = createPolySynth(subGain, {
      type: 'sine',
      attack: 3.2,
      decay: 0.25,
      sustain: 0.98,
      release: 7.2,
      volume: -4,
    })

    const timeouts = []

    const scheduleChord = (index) => {
      if (!ambientRef.current) {
        return
      }

      const chord = AMBIENT_SEQUENCE[index % AMBIENT_SEQUENCE.length]
      const now = Tone.now() + 0.02
      const root = chord[0]
      const bassRoot = Tone.Frequency(root).transpose(-12).toNote()
      const bassFifth = Tone.Frequency(chord[1] ?? root).transpose(-12).toNote()
      const subRoot = Tone.Frequency(root).transpose(-24).toNote()

      padSynth.triggerAttackRelease(chord, 14.5, now, 0.38)
      bassSynth.triggerAttackRelease(
        [bassRoot, bassFifth],
        14.8,
        now,
        0.36,
      )
      subSynth.triggerAttackRelease([subRoot], 16, now + 0.25, 0.3)
      shimmerSynth.triggerAttackRelease(
        [Tone.Frequency(chord[chord.length - 1]).transpose(12).toNote()],
        4.8,
        now + 1.9,
        0.1,
      )

      const timeoutId = window.setTimeout(() => scheduleChord(index + 1), 9200)
      timeouts.push(timeoutId)
    }

    ambientRef.current = {
      bassSynth,
      bassGain,
      bassFilter,
      chorus,
      gain,
      masterFilter,
      padSynth,
      padGain,
      padFilter,
      padMotion,
      reverb,
      shimmerFilter,
      shimmerGain,
      shimmerMotion,
      shimmerSynth,
      subFilter,
      subSynth,
      subGain,
      timeouts,
    }

    scheduleChord(0)
  }, [unlockAudio])

  const updateFocusLevels = useCallback((levels = {}) => {
    if (!focusRef.current) {
      return
    }

    focusRef.current.leftGain.gain.rampTo(0.22 * (levels.binaural ?? 0.82), 0.08)
    focusRef.current.rightGain.gain.rampTo(0.22 * (levels.binaural ?? 0.82), 0.08)
    focusRef.current.noiseGain.gain.rampTo(0.22 * (levels.noise ?? 0.54), 0.08)
    focusRef.current.padGain.gain.rampTo(0.7 * (levels.pad ?? 0.78), 0.08)
    focusRef.current.shimmerGain.gain.rampTo(0.16 * (levels.pad ?? 0.78), 0.08)
    focusRef.current.droneGain.gain.rampTo(0.56 * (levels.pad ?? 0.78), 0.08)

    const sampleVolumes = {
      birds: 0.76 * (levels.birds ?? 0.42),
      fireplace: 0.7 * (levels.fireplace ?? 0.32),
      rain: 0.8 * (levels.rain ?? 0.58),
      rainTarp: 0.8 * (levels.rainTarp ?? 0.4),
      seaside: 0.8 * (levels.seaside ?? 0.56),
      thunder: 0.82 * (levels.thunder ?? 0.46),
      wind: 0.76 * (levels.wind ?? 0.36),
    }

    Object.entries(focusRef.current.samples).forEach(([id, audio]) => {
      audio.volume = clamp01(sampleVolumes[id] ?? 0.5)
    })
  }, [])

  const startFocusSession = useCallback(
    async (presetId, effectIds = [], levels = {}) => {
      await unlockAudio()

      const preset = FOCUS_PRESETS[presetId] ?? FOCUS_PRESETS.steady

      stopAmbient()
      stopFocus()
      stopAll()

      const leftPan = new Tone.Panner(-1).toDestination()
      const rightPan = new Tone.Panner(1).toDestination()
      const leftGain = new Tone.Gain(0.22 * (levels.binaural ?? 0.82)).connect(leftPan)
      const rightGain = new Tone.Gain(0.22 * (levels.binaural ?? 0.82)).connect(rightPan)
      const leftOsc = new Tone.Oscillator(preset.leftHz, 'sine').connect(leftGain)
      const rightOsc = new Tone.Oscillator(preset.rightHz, 'sine').connect(rightGain)

      const masterFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: 3200,
        rolloff: -24,
        Q: 0.22,
      }).toDestination()
      const chorus = new Tone.Chorus({
        frequency: 0.06,
        delayTime: 3.6,
        depth: 0.18,
        spread: 120,
        wet: 0.16,
      }).start()
      chorus.connect(masterFilter)
      const reverb = new Tone.Reverb({
        decay: 18,
        wet: 0.28,
        preDelay: 0.06,
      }).connect(chorus)
      await waitForReverbReady(reverb)
      const delay = new Tone.FeedbackDelay({
        delayTime: '4n',
        feedback: 0.12,
        wet: 0.06,
      }).connect(reverb)

      const padGain = new Tone.Gain(0.7 * (levels.pad ?? 0.78))
      const padFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: Math.min(preset.filterRange[1] + 120, 2500),
        rolloff: -24,
        Q: 0.24,
      })
      padGain.connect(padFilter)
      padFilter.connect(delay)

      const shimmerGain = new Tone.Gain(0.16 * (levels.pad ?? 0.78))
      const shimmerFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: Math.min(preset.filterRange[1] + 700, 3400),
        rolloff: -24,
        Q: 0.16,
      })
      shimmerGain.connect(shimmerFilter)
      shimmerFilter.connect(reverb)

      const droneGain = new Tone.Gain(0.56 * (levels.pad ?? 0.78))
      const droneFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: 250,
        rolloff: -24,
        Q: 0.12,
      })
      droneGain.connect(droneFilter)
      droneFilter.connect(masterFilter)

      const noiseFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: preset.filterRange[1],
        rolloff: -24,
        Q: 0.72,
      }).connect(masterFilter)
      const noiseGain = new Tone.Gain(0.22 * (levels.noise ?? 0.54)).connect(noiseFilter)
      const noise = new Tone.Noise(preset.noiseType).connect(noiseGain)

      const padMotion = new Tone.LFO({
        frequency: 0.01 + preset.beatDrift * 0.0025,
        min: preset.filterRange[0] + 110,
        max: preset.filterRange[1] + 220,
      }).start()
      padMotion.connect(padFilter.frequency)

      const shimmerMotion = new Tone.LFO({
        frequency: 0.014 + preset.beatDrift * 0.002,
        min: Math.max(preset.filterRange[1] - 180, 1650),
        max: Math.min(preset.filterRange[1] + 640, 3200),
      }).start()
      shimmerMotion.connect(shimmerFilter.frequency)

      const padSynth = createPolySynth(padGain, {
        type: 'triangle8',
        attack: 3.1,
        decay: 0.8,
        sustain: 0.94,
        release: 6.2,
        volume: -4,
      })

      const shimmerSynth = createPolySynth(shimmerGain, {
        type: 'triangle',
        attack: 2.4,
        decay: 0.3,
        sustain: 0.28,
        release: 3.2,
        volume: -18,
      })

      const droneSynth = createPolySynth(droneGain, {
        type: 'sine',
        attack: 3.6,
        decay: 0.22,
        sustain: 0.98,
        release: 7.2,
        volume: -4,
      })

      leftOsc.start()
      rightOsc.start()
      noise.start()

      const samples = {}
      const sampleVolumes = {
        birds: 0.76 * (levels.birds ?? 0.42),
        fireplace: 0.7 * (levels.fireplace ?? 0.32),
        rain: 0.8 * (levels.rain ?? 0.58),
        rainTarp: 0.8 * (levels.rainTarp ?? 0.4),
        seaside: 0.8 * (levels.seaside ?? 0.56),
        thunder: 0.82 * (levels.thunder ?? 0.46),
        wind: 0.76 * (levels.wind ?? 0.36),
      }

      effectIds.forEach((effectId) => {
        const src = SAMPLE_LIBRARY[effectId]
        if (!src) {
          return
        }
        const audio = createLoopingAudio(src, sampleVolumes[effectId] ?? 0.5)
        samples[effectId] = audio
        void audio.play().catch(() => {})
      })

      const timeouts = []
      const scheduleStage = (index) => {
        if (!focusRef.current) {
          return
        }

        const stage = preset.progression[index % preset.progression.length]
        const now = Tone.now() + 0.03
        const root = stage.chord[0]
        const fifth = stage.chord[1] ?? root

        padSynth.triggerAttackRelease(
          stage.chord,
          stage.duration + 5.8,
          now,
          0.32 + stage.velocity * 0.28,
        )
        droneSynth.triggerAttackRelease(
          [
            Tone.Frequency(root).transpose(-12).toNote(),
            Tone.Frequency(fifth).transpose(-12).toNote(),
          ],
          stage.duration + 7.2,
          now + 0.12,
          0.28 + stage.velocity * 0.16,
        )
        shimmerSynth.triggerAttackRelease(
          stage.shimmer.map((note) => Tone.Frequency(note).transpose(12).toNote()),
          Math.max(4.4, stage.duration * 0.28),
          now + 2.1,
          0.08 + stage.velocity * 0.05,
        )

        noiseFilter.frequency.rampTo(
          preset.filterRange[0] +
            (preset.filterRange[1] - preset.filterRange[0]) * stage.velocity,
          1.8,
        )

        const timeoutId = window.setTimeout(
          () => scheduleStage(index + 1),
          stage.duration * 1000,
        )
        timeouts.push(timeoutId)
      }

      const schedulePulse = () => {
        if (!focusRef.current) {
          return
        }

        const root = preset.progression[0].chord[0]
        shimmerSynth.triggerAttackRelease(
          [Tone.Frequency(root).transpose(24).toNote()],
          3.6,
          Tone.now() + 0.08,
          0.14,
        )

        const timeoutId = window.setTimeout(schedulePulse, 31000)
        timeouts.push(timeoutId)
      }

      focusRef.current = {
        chorus,
        delay,
        droneFilter,
        droneGain,
        droneSynth,
        leftGain,
        leftOsc,
        leftPan,
        masterFilter,
        noise,
        noiseFilter,
        noiseGain,
        padFilter,
        padGain,
        padMotion,
        padSynth,
        reverb,
        rightGain,
        rightOsc,
        rightPan,
        samples,
        shimmerFilter,
        shimmerGain,
        shimmerMotion,
        shimmerSynth,
        timeouts,
      }

      scheduleStage(0)
      schedulePulse()
    },
    [stopAll, stopAmbient, stopFocus, unlockAudio],
  )

  const playTargetTone = useCallback(
    async (frequency) => {
      await unlockAudio()
      disposeTarget()
      stopPreview()

      const gain = new Tone.Gain(1).toDestination()
      const synth = new Tone.Synth({
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.01,
          decay: 0.04,
          sustain: 0.96,
          release: 0.08,
        },
        volume: -10,
      }).connect(gain)

      synth.triggerAttackRelease(
        frequency,
        GAME_CONFIG.targetDurationMs / 1000,
        Tone.now(),
        GAME_CONFIG.targetVolume * 5,
      )

      targetRef.current = { gain, synth }
      setIsTargetPlaying(true)
      targetTimeoutRef.current = window.setTimeout(() => {
        disposeTarget()
      }, GAME_CONFIG.targetDurationMs + 120)
    },
    [disposeTarget, stopPreview, unlockAudio],
  )

  const startPreview = useCallback(
    async (frequency) => {
      await unlockAudio()

      if (previewRef.current) {
        previewRef.current.oscillator.frequency.rampTo(frequency, 0.04)
        previewRef.current.gain.gain.rampTo(GAME_CONFIG.previewVolume * 8, 0.05)
        setIsPreviewPlaying(true)
        return
      }

      disposeTarget()
      stopPreview()

      const gain = new Tone.Gain(0).toDestination()
      const oscillator = new Tone.Oscillator(frequency, 'sine').connect(gain)
      oscillator.start()
      gain.gain.rampTo(GAME_CONFIG.previewVolume * 8, 0.06)

      previewRef.current = { gain, oscillator }
      setIsPreviewPlaying(true)
    },
    [disposeTarget, stopPreview, unlockAudio],
  )

  const updatePreview = useCallback((frequency) => {
    if (!previewRef.current) {
      return
    }

    previewRef.current.oscillator.frequency.rampTo(frequency, 0.04)
  }, [])

  const playChord = useCallback(
    async (notes, options = {}) => {
      await unlockAudio()
      if (!notes?.length) {
        return
      }

      stopChord()
      stopPreview()
      disposeTarget()

      const duration = options.duration ?? 2.8
      const gain = new Tone.Gain(0.92).toDestination()
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle6' },
        envelope: {
          attack: 0.03,
          decay: 0.25,
          sustain: 0.78,
          release: 1.4,
        },
        volume: -4,
      }).connect(gain)

      const subSynth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sine' },
        envelope: {
          attack: 0.02,
          decay: 0.18,
          sustain: 0.82,
          release: 1.6,
        },
        volume: -5,
      }).connect(gain)

      synth.triggerAttackRelease(notes, duration, Tone.now(), 0.78)
      subSynth.triggerAttackRelease(
        notes.slice(0, 2).map((note) => Tone.Frequency(note).transpose(-12).toNote()),
        duration + 0.3,
        Tone.now(),
        0.68,
      )

      chordRef.current = { gain, subSynth, synth }
      chordTimeoutRef.current = window.setTimeout(() => {
        stopChord()
      }, (duration + 1.8) * 1000)
    },
    [disposeTarget, stopChord, stopPreview, unlockAudio],
  )

  const playNote = useCallback(
    async (note, options = {}) => {
      await unlockAudio()
      if (!note) {
        return
      }

      stopNote()
      stopChord()
      stopPreview()
      disposeTarget()

      const duration = options.duration ?? 2.2
      const gain = new Tone.Gain(0.92).toDestination()
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: {
          attack: 0.02,
          decay: 0.16,
          sustain: 0.86,
          release: 1.3,
        },
        volume: -3,
      }).connect(gain)

      synth.triggerAttackRelease([note], duration, Tone.now(), 0.84)

      noteRef.current = { gain, synth }
      noteTimeoutRef.current = window.setTimeout(() => {
        stopNote()
      }, (duration + 1.5) * 1000)
    },
    [disposeTarget, stopChord, stopNote, stopPreview, unlockAudio],
  )

  useEffect(
    () => () => {
      stopAmbient()
      stopFocus()
      stopAll()
    },
    [stopAll, stopAmbient, stopFocus],
  )

  return {
    audioNotice,
    audioReady,
    isPreviewPlaying,
    isTargetPlaying,
    playChord,
    playNote,
    playTargetTone,
    startAmbient,
    startFocusSession,
    startPreview,
    stopAll,
    stopAmbient,
    stopChord,
    stopFocus,
    stopNote,
    stopPreview,
    unlockAudio,
    updateFocusLevels,
    updatePreview,
  }
}
