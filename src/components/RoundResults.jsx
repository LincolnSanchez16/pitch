import { PLAYER_META } from '../utils/game'

export function RoundResults({ result, mode, onContinue, continueLabel }) {
  const playerIds = mode === 'solo' ? ['p1'] : ['p1', 'p2']

  return (
    <section className="results-panel">
      <div className="console-header">
        <span className="section-kicker">{result.label}</span>
        <p className="console-prompt">{getResultHeadline(result, mode)}</p>
      </div>

      <div className="result-summary">
        <article className="summary-chip">
          <span className="summary-label">Target</span>
          <strong>{result.targetFrequency} Hz</strong>
        </article>

        <article className="summary-chip">
          <span className="summary-label">Outcome</span>
          <strong>{result.summary}</strong>
        </article>
      </div>

      <div className="result-grid">
        {playerIds.map((playerId) => {
          const player = result.players[playerId]

          return (
            <article key={playerId} className="player-result-card">
              <div className="player-result-top">
                <span className="section-kicker">{PLAYER_META[playerId].label}</span>
                <strong>+{player.pointsAwarded} pts</strong>
              </div>

              <div className="player-stats">
                <div>
                  <span className="stat-label">Guess</span>
                  <strong>{player.guess} Hz</strong>
                </div>
                <div>
                  <span className="stat-label">Off By</span>
                  <strong>{player.difference} Hz</strong>
                </div>
              </div>

              <div className="reason-list">
                {player.reasons.map((reason) => (
                  <span key={reason} className="reason-pill">
                    {reason}
                  </span>
                ))}
              </div>
            </article>
          )
        })}
      </div>

      <div className="result-summary">
        <article className="summary-chip">
          <span className="summary-label">Scoreboard</span>
          <strong>
            {mode === 'solo'
              ? `${result.scoreAfter.p1} pts`
              : `${result.scoreAfter.p1} - ${result.scoreAfter.p2}`}
          </strong>
        </article>
      </div>

      <div className="setup-actions">
        <button type="button" className="primary-button" onClick={onContinue}>
          {continueLabel}
        </button>
      </div>
    </section>
  )
}

function getResultHeadline(result, mode) {
  if (result.playoffAutoWinId) {
    return `${PLAYER_META[result.playoffAutoWinId].label} hit a perfect 10.0 and wins instantly.`
  }

  if (result.playoffWinnerId) {
    return `${PLAYER_META[result.playoffWinnerId].label} takes the playoff round.`
  }

  if (mode === 'solo') {
    return 'Round scored.'
  }

  return 'Round resolved.'
}
