import { GAME_CONFIG, PLAYER_META, getPlayoffStake } from '../utils/game'

export function Scoreboard({
  mode,
  scores,
  roundLabel,
  isPlayoff,
  playoffCycle,
  playoffRoundIndex,
}) {
  return (
    <section className="scoreboard">
      <div className="section-heading">
        <span className="section-kicker">Match Status</span>
        <h2>{roundLabel}</h2>
      </div>

      <div className="score-row">
        <article className="score-tile">
          <span className="score-label">
            {mode === 'solo' ? 'Total Score' : PLAYER_META.p1.label}
          </span>
          <strong>{scores.p1}</strong>
        </article>

        {mode === 'duo' ? (
          <article className="score-tile">
            <span className="score-label">{PLAYER_META.p2.label}</span>
            <strong>{scores.p2}</strong>
          </article>
        ) : null}

        <article className="score-tile">
          <span className="score-label">Format</span>
          <strong>{mode === 'solo' ? 'Solo' : 'Two Player'}</strong>
        </article>

        <article className="score-tile">
          <span className="score-label">Rounds</span>
          <strong>{GAME_CONFIG.totalRounds}</strong>
        </article>
      </div>

      {isPlayoff ? (
        <div className="playoff-banner">
          <span>Playoff cycle {playoffCycle}</span>
          <strong>Round stake: +{getPlayoffStake(playoffRoundIndex)}</strong>
        </div>
      ) : null}
    </section>
  )
}
