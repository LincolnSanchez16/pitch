export function ChordTrainerStage({
  roundLabel,
  difficultyLabel,
  phase,
  choiceIds,
  chordTypesById,
  selectedChoiceId,
  correctChoiceId,
  rootLabel,
  score,
  streak,
  onReplay,
  onChoose,
  onAdvance,
}) {
  return (
    <section className={`trainer-shell phase-${phase}`}>
      <div className="stage-corner stage-left">{roundLabel}</div>
      <div className="stage-corner stage-right">{difficultyLabel}</div>

      {phase === 'prompt' ? (
        <div className="trainer-body">
          <div className="trainer-head">
            <p className="trainer-kicker">Chord Trainer</p>
            <h2 className="trainer-title">Which structure did you hear?</h2>
            <p className="trainer-copy">
              Replay the chord as much as you need, then lock one answer.
            </p>
          </div>

          <div className="trainer-actions">
            <button type="button" className="secondary-button trainer-replay" onClick={onReplay}>
              Replay Chord
            </button>
          </div>

          <div className="trainer-choice-grid" role="list" aria-label="Chord choices">
            {choiceIds.map((choiceId) => (
              <button
                key={choiceId}
                type="button"
                className="trainer-choice"
                onClick={() => onChoose(choiceId)}
              >
                {chordTypesById[choiceId]?.label ?? choiceId}
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
            <h2 className="trainer-title">
              {chordTypesById[correctChoiceId]?.label}
            </h2>
            <p className="trainer-copy">
              Root: {rootLabel}. You picked {chordTypesById[selectedChoiceId]?.label ?? 'nothing'}.
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
