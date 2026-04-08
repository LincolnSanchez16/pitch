import { GAME_CONFIG } from '../utils/game'

export function RulesPanel({ compact = false }) {
  return (
    <details className={`rules-panel ${compact ? 'is-compact' : ''}`}>
      <summary>{compact ? 'Quick Rules' : 'How To Play'}</summary>

      <div className="rules-content">
        <p>
          Hear the hidden target tone, shape your own live preview, and submit the closest
          frequency you can.
        </p>

        <ul>
          <li>Main game lasts {GAME_CONFIG.totalRounds} rounds.</li>
          <li>Within 1 Hz scores a perfect 10.0 event.</li>
          <li>Within 5 Hz scores +3.</li>
          <li>In two-player rounds, the closest guess earns +1. Tied closeness gives both +1.</li>
          <li>Two-player ties after round five trigger escalating playoff stakes.</li>
          <li>In playoffs, a within-1 Hz hit ends the game immediately.</li>
        </ul>
      </div>
    </details>
  )
}
