export function PerfectPitchStage({
  phase,
  roundLabel,
  score,
  streak,
  selectedChoiceId,
  correctChoiceId,
  onReplay,
  onChoose,
  onAdvance,
  choices,
}) {
  return (
    <section className={`trainer-shell phase-${phase}`}>
      <div className="stage-corner stage-left">{roundLabel}</div>
      <div className="stage-corner stage-right">2 Octaves</div>

      {phase === 'prompt' ? (
        <div className="trainer-body">
          <div className="trainer-head">
            <p className="trainer-kicker">Perfect Pitch</p>
            <h2 className="trainer-title">Which note did you hear?</h2>
            <p className="trainer-copy">
              The pool spans two full octaves. Replay the note, then pick the exact pitch.
            </p>
          </div>

          <div className="trainer-actions">
            <button type="button" className="secondary-button trainer-replay" onClick={onReplay}>
              Replay Note
            </button>
          </div>

          <div className="note-choice-grid" role="list" aria-label="Note choices">
            {choices.map((choice) => (
              <button
                key={choice.id}
                type="button"
                className="note-choice"
                onClick={() => onChoose(choice.id)}
              >
                {choice.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {phase === 'result' ? (
        <div className="trainer-body is-result">
          <div className="trainer-head">
            <p className={`trainer-kicker ${selectedChoiceId === correctChoiceId ? 'is-correct' : 'is-wrong'}`}>
              {selectedChoiceId === correctChoiceId ? 'Correct' : 'Not Quite'}
            </p>
            <h2 className="trainer-title">{correctChoiceId}</h2>
            <p className="trainer-copy">
              You picked {selectedChoiceId ?? 'nothing'}.
            </p>
          </div>

          <div className="trainer-result-grid">
            <article className="score-tile">
              <span className="score-label">Score</span>
              <strong>{score}</strong>
            </article>
            <article className="score-tile">
              <span className="score-label">Streak</span>
              <strong>{streak}</strong>
            </article>
          </div>

          <div className="trainer-actions">
            <button type="button" className="secondary-button trainer-replay" onClick={onReplay}>
              Hear It Again
            </button>
            <button type="button" className="stage-arrow" onClick={onAdvance}>
              <span aria-hidden="true">→</span>
            </button>
          </div>
        </div>
      ) : null}
    </section>
  )
}
