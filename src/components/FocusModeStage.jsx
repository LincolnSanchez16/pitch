export function FocusModeStage({
  presetId,
  presets,
  effects,
  activeEffects,
  levels,
  elapsedMs,
  isPlaying,
  isEditing,
  panelOpen,
  onTogglePanel,
  onSelectPreset,
  onToggleEffect,
  onAdjustLevel,
  onStartSession,
  onEndSession,
  onHome,
}) {
  const formattedElapsed = formatStopwatch(elapsedMs)
  const isSetupView = !isPlaying || isEditing

  return (
    isSetupView ? (
      <section className="trainer-shell focus-shell">
        <div className="stage-corner stage-left">Focus</div>
        <div className="stage-corner stage-right">Headphones Recommended</div>

        <div className="focus-canvas">
        <div className="focus-copy">
          <h2 className="trainer-title">Set the room, then stay in it.</h2>
        </div>

          <div className="trainer-actions focus-actions is-setup">
            <button type="button" className="primary-button focus-toggle" onClick={onStartSession}>
              {isPlaying ? 'Continue Session' : 'Start Session'}
            </button>
            {isPlaying ? (
              <button type="button" className="secondary-button trainer-replay" onClick={onEndSession}>
                End Session
              </button>
            ) : (
              <button type="button" className="secondary-button trainer-replay" onClick={onHome}>
                Home
              </button>
            )}
          </div>

          <div className="focus-group">
            <p className="focus-label">Preset</p>
            <div className="trainer-difficulty-row">
              {Object.values(presets).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  className={`trainer-pill ${preset.id === presetId ? 'is-active' : ''}`}
                  onClick={() => onSelectPreset(preset.id)}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="focus-group">
            <p className="focus-label">Layers</p>
            <div className="focus-effects-grid">
              {effects.map((effect) => (
                <button
                  key={effect.id}
                  type="button"
                  className={`trainer-chip ${activeEffects.includes(effect.id) ? 'is-active' : ''}`}
                  onClick={() => onToggleEffect(effect.id)}
                >
                  {effect.label}
                </button>
              ))}
            </div>
          </div>

          <div className="focus-group">
            <p className="focus-label">Levels</p>
            <div className="focus-sliders">
              <VolumeRow
                label="Binaural"
                value={levels.binaural}
                onChange={(value) => onAdjustLevel('binaural', value)}
              />
              <VolumeRow
                label="Pad"
                value={levels.pad}
                onChange={(value) => onAdjustLevel('pad', value)}
              />
              <VolumeRow
                label="Noise Bed"
                value={levels.noise}
                onChange={(value) => onAdjustLevel('noise', value)}
              />
              {effects.map((effect) => (
                <VolumeRow
                  key={effect.id}
                  label={effect.label}
                  value={levels[effect.id] ?? 0}
                  disabled={!activeEffects.includes(effect.id)}
                  onChange={(value) => onAdjustLevel(effect.id, value)}
                />
              ))}
            </div>
          </div>
        </div>
      </section>
    ) : (
      <section className="focus-session-shell is-visible">
        <div className="focus-session">
          <div className={`focus-stopwatch-shell is-visible ${panelOpen ? 'is-open' : ''}`}>
            <button
              type="button"
              className="focus-stopwatch"
              onClick={() => onTogglePanel(!panelOpen)}
              aria-expanded={panelOpen}
            >
              <span className="focus-stopwatch-label">time spent</span>
              <strong key={formattedElapsed} className="focus-stopwatch-value">
                {formattedElapsed}
              </strong>
            </button>
          </div>
        </div>
      </section>
    )
  )
}

function VolumeRow({ label, value, onChange, disabled = false }) {
  return (
    <label className={`focus-slider-row ${disabled ? 'is-disabled' : ''}`}>
      <span>{label}</span>
      <input
        type="range"
        min="0"
        max="100"
        value={Math.round(value * 100)}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value) / 100)}
      />
    </label>
  )
}

function formatStopwatch(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
