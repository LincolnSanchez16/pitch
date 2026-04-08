import { WaveColumn } from './WaveColumn'

export function GameplayStage({
  phase,
  roundLabel,
  playerLabel,
  selection,
  targetFrequency,
  guessFrequency,
  pointsAwarded,
  difference,
  timeLeft,
  helperText,
  onAdvance,
  onSubmit,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  interactive = false,
  amplitude = 0.5,
}) {
  return (
    <section
      className={`stage-shell phase-${phase} ${interactive ? 'is-interactive' : ''}`}
      onPointerDown={interactive ? onPointerDown : undefined}
      onPointerMove={interactive ? onPointerMove : undefined}
      onPointerUp={interactive ? onPointerUp : undefined}
      onPointerCancel={interactive ? onPointerCancel : undefined}
    >
      <div className="stage-corner stage-left">{roundLabel}</div>
      {playerLabel ? <div className="stage-corner stage-right">{playerLabel}</div> : null}

      <WaveColumn amplitude={amplitude} intensity={1} subtle={phase === 'result'} />

      {phase === 'memorize' ? (
        <div className="stage-countdown">
          <strong>{formatTimer(timeLeft)}</strong>
          <span>Seconds to remember</span>
        </div>
      ) : null}

      {phase === 'guess' ? (
        <>
          <p className="stage-helper is-guess">{helperText}</p>

          <div className="stage-footer">
            <div className="stage-frequency-readout">
              <strong>{selection.toFixed(2)}</strong>
              <span>Hz</span>
            </div>

            <button
              type="button"
              className="stage-arrow"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                onSubmit()
              }}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>

        </>
      ) : null}

      {phase === 'result' ? (
        <>
          <div className="stage-result-meta">
            <strong>{pointsAwarded > 0 ? `+${pointsAwarded}` : '0'}</strong>
            <span>Round points</span>
            <p>{helperText}</p>
          </div>

          <div className="stage-footer is-result">
            <div className="stage-result-stack">
              <span className="stage-result-label">Target</span>
              <div className="stage-frequency-readout is-muted">
                <strong>{targetFrequency.toFixed(2)}</strong>
                <span>Hz</span>
              </div>

              <div className="stage-frequency-readout">
                <strong>{guessFrequency.toFixed(2)}</strong>
                <span>Hz</span>
              </div>

              <p className="stage-helper is-result">
                {difference.toFixed(2)} Hz away
              </p>
            </div>

            <button
              type="button"
              className="stage-arrow"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={onAdvance}
            >
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </>
      ) : null}
    </section>
  )
}

function formatTimer(timeLeft) {
  const seconds = Math.max(0, timeLeft)
  return String(Math.ceil(seconds)).padStart(2, '0')
}
