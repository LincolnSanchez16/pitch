import { useEffect, useRef } from 'react'
import sineWavesScriptUrl from 'sine-waves/sine-waves.js?url'
import { GAME_CONFIG } from '../utils/game'

let sineWavesLoader = null

export function HertzWaveBackground({ frequency = 440, color = '#111111' }) {
  const canvasRef = useRef(null)
  const instanceRef = useRef(null)
  const initialFrequencyRef = useRef(frequency)
  const isDisabledRef = useRef(false)

  useEffect(() => {
    if (isDisabledRef.current) {
      return undefined
    }

    let isCancelled = false

    const setup = async () => {
      try {
        const canvas = canvasRef.current

        if (!canvas) {
          return
        }

        const SineWaves = await ensureSineWaves()

        if (isCancelled || !SineWaves) {
          return
        }

        const instance = new SineWaves({
          el: canvas,
          speed: mapSpeed(initialFrequencyRef.current),
          rotate: 0,
          ease: 'SineInOut',
          wavesWidth: '110%',
          width() {
            return window.innerWidth
          },
          height() {
            return window.innerHeight
          },
          waves: buildWaves(initialFrequencyRef.current, color),
        })

        instanceRef.current = instance
      } catch (error) {
        console.error('HertzWaveBackground setup failed', error)
        isDisabledRef.current = true
      }
    }

    void setup()

    return () => {
      isCancelled = true

      if (instanceRef.current) {
        instanceRef.current.running = false
        instanceRef.current = null
      }
    }
  }, [color])

  useEffect(() => {
    if (isDisabledRef.current) {
      return
    }

    const instance = instanceRef.current

    if (!instance) {
      return
    }

    try {
      const nextWaves = buildWaves(frequency, color)
      instance.options.speed = mapSpeed(frequency)
      instance.waves = nextWaves
      instance.update?.()
    } catch (error) {
      console.error('HertzWaveBackground update failed', error)
      isDisabledRef.current = true
    }
  }, [color, frequency])

  return <canvas ref={canvasRef} className="wave-background-canvas" />
}

async function ensureSineWaves() {
  if (typeof window === 'undefined') {
    return null
  }

  if (window.SineWaves) {
    return window.SineWaves
  }

  if (!sineWavesLoader) {
    sineWavesLoader = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = sineWavesScriptUrl
      script.async = true
      script.onload = () => resolve(window.SineWaves ?? null)
      script.onerror = () => reject(new Error('Failed to load sine-waves script'))
      document.head.appendChild(script)
    })
  }

  return sineWavesLoader
}

function buildWaves(frequency, color) {
  const normalized = normalizeFrequency(frequency)
  const baseAmplitude = 96 + normalized * 118
  const baseWavelength = 900 - normalized * 420
  const baseSegment = 11 - normalized * 2.5
  const palette = [
    'rgba(104, 55, 247, 0.44)',
    'rgba(148, 92, 244, 0.42)',
    'rgba(226, 136, 235, 0.4)',
    'rgba(174, 156, 244, 0.38)',
    'rgba(87, 58, 254, 0.3)',
    toRgba(color, 0.14),
  ]

  return [0, 1, 2, 3, 4, 5].map((index) => ({
    timeModifier: 0.2 + index * 0.04,
    lineWidth: 4.2 + index * 0.72,
    amplitude: baseAmplitude + index * 22,
    wavelength: Math.max(220, baseWavelength - index * 62),
    segmentLength: Math.max(4, baseSegment),
    strokeStyle: palette[index % palette.length],
    type: 'Sine',
  }))
}

function normalizeFrequency(frequency) {
  const min = Math.log(GAME_CONFIG.frequencyRange.min)
  const max = Math.log(GAME_CONFIG.frequencyRange.max)
  const clamped = Math.min(
    GAME_CONFIG.frequencyRange.max,
    Math.max(GAME_CONFIG.frequencyRange.min, frequency),
  )

  return (Math.log(clamped) - min) / (max - min)
}

function mapSpeed(frequency) {
  return 0.7 + normalizeFrequency(frequency) * 0.7
}

function toRgba(hex, alpha) {
  const normalized = hex.replace('#', '')
  const r = Number.parseInt(normalized.slice(0, 2), 16)
  const g = Number.parseInt(normalized.slice(2, 4), 16)
  const b = Number.parseInt(normalized.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
