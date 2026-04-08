import { GAME_CONFIG, frequencyToSliderValue, sliderValueToFrequency } from '../utils/game'

export function GuessConsole({
  playerLabel,
  prompt,
  statusText,
  selection,
  onSelectionChange,
  onPreviewToggle,
  onTargetReplay,
  onStopAudio,
  onSubmit,
  isPreviewPlaying,
  isTargetPlaying,
  audioNotice,
  submitLabel,
  isPlayoff,
  playoffStake,
}) {
  return (
    <section className="console-panel">
      <div className="console-header">
        <span className="section-kicker">{playerLabel}</span>
        <p className="console-prompt">{prompt}</p>
        {statusText ? <p className="console-status">{statusText}</p> : null}
      </div>

      <div className="control-strip">
        <button type="button" className="secondary-button" onClick={onTargetReplay}>
          {isTargetPlaying ? 'Replaying Target...' : 'Replay Target Tone'}
        </button>

        <button type="button" className="ghost-button" onClick={onStopAudio}>
          Stop All Audio
        </button>
      </div>

      <div className="frequency-display">
        <span className="display-label">Current Guess</span>
        <strong>{selection} Hz</strong>
        <span className="display-subcopy">
          {isPlayoff
            ? `Playoff stake is +${playoffStake} for the round winner.`
            : 'Use the slider to get as close to the hidden tone as you can.'}
        </span>
      </div>

      <div className="slider-wrap">
        <label className="field-label" htmlFor="frequency-slider">
          Frequency slider
        </label>
        <input
          id="frequency-slider"
          className="frequency-slider"
          type="range"
          min="0"
          max={GAME_CONFIG.sliderResolution}
          step="1"
          value={frequencyToSliderValue(selection)}
          onChange={(event) =>
            onSelectionChange(sliderValueToFrequency(Number(event.target.value)))
          }
        />

        <div className="slider-scale" aria-hidden="true">
          <span>{GAME_CONFIG.frequencyRange.min} Hz</span>
          <span>Slide to match</span>
          <span>{GAME_CONFIG.frequencyRange.max} Hz</span>
        </div>
      </div>

      <div className="control-strip">
        <button type="button" className="primary-button" onClick={onPreviewToggle}>
          {isPreviewPlaying ? 'Stop Guess Tone' : 'Play Guess Tone'}
        </button>

        <button type="button" className="accent-button" onClick={onSubmit}>
          {submitLabel}
        </button>
      </div>

      {audioNotice ? <p className="audio-note">{audioNotice}</p> : null}
    </section>
  )
}
