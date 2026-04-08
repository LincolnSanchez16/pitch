import SoftAurora from './SoftAurora'

export function WaveColumn({ amplitude = 0.5, subtle = false }) {
  const stripWidth = Math.round((subtle ? 88 : 98) + amplitude * (subtle ? 42 : 92))
  const brightness = subtle ? 0.48 + amplitude * 0.16 : 0.82 + amplitude * 0.44
  const scale = subtle ? 1.16 + amplitude * 0.28 : 1.08 + amplitude * 0.42
  const noiseAmplitude = subtle ? 0.72 + amplitude * 0.2 : 1 + amplitude * 0.5
  const bandSpread = subtle ? 1.12 + amplitude * 0.18 : 1.18 + amplitude * 0.54
  const bandHeight = subtle ? 0.52 + amplitude * 0.06 : 0.46 + amplitude * 0.16
  const colorSpeed = subtle ? 0.48 : 0.62

  return (
    <div className={`wave-column ${subtle ? 'is-subtle' : ''}`} aria-hidden="true">
      <div
        className="wave-column-strip"
        style={{
          '--wave-strip-width': `${stripWidth}px`,
          '--wave-strip-opacity': subtle ? 0.68 : 0.98,
        }}
      >
        <div className="wave-column-aurora">
          <SoftAurora
            speed={0.58}
            scale={scale}
            brightness={brightness}
            color1="#f7f7f7"
            color2="#e100ff"
            noiseFrequency={2.5}
            noiseAmplitude={noiseAmplitude}
            bandHeight={bandHeight}
            bandSpread={bandSpread}
            octaveDecay={0.1}
            layerOffset={0.72}
            colorSpeed={colorSpeed}
            enableMouseInteraction={false}
            mouseInfluence={0.25}
            vertical
          />
        </div>
      </div>
    </div>
  )
}
