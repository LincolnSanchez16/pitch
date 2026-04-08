function buildPlayerResult(guess, targetFrequency) {
  const difference = Math.abs(guess - targetFrequency)

  return {
    guess,
    difference,
    pointsAwarded: 0,
    reasons: [],
    perfect: difference <= 1,
    withinFive: difference <= 5,
  }
}

export function resolveRound({
  mode,
  targetFrequency,
  guesses,
  responseTimes = null,
  isPlayoff = false,
  playoffStake = 1,
}) {
  if (mode === 'solo') {
    return scoreSoloRound(targetFrequency, guesses.p1)
  }

  return isPlayoff
    ? scorePlayoffRound(targetFrequency, guesses, playoffStake)
    : scoreVersusRound(targetFrequency, guesses, responseTimes)
}

function scoreSoloRound(targetFrequency, guess) {
  const player = buildPlayerResult(guess, targetFrequency)

  if (player.perfect) {
    player.pointsAwarded = 10
    player.reasons.push('Perfect 10.0: within 1 Hz (+10)')
  } else if (player.withinFive) {
    player.pointsAwarded = 3
    player.reasons.push('Within 5 Hz (+3)')
  } else {
    player.reasons.push('Outside the 5 Hz scoring window')
  }

  return {
    players: {
      p1: player,
    },
    scoreDelta: {
      p1: player.pointsAwarded,
      p2: 0,
    },
    summary: player.perfect
      ? 'Perfect 10.0 landed.'
      : player.withinFive
        ? 'Close hit scored.'
        : 'No round points scored.',
    wasTie: false,
    playoffWinnerId: null,
    playoffAutoWinId: null,
  }
}

function scoreVersusRound(targetFrequency, guesses, responseTimes) {
  const players = {
    p1: buildPlayerResult(guesses.p1, targetFrequency),
    p2: buildPlayerResult(guesses.p2, targetFrequency),
  }

  for (const player of Object.values(players)) {
    if (player.perfect) {
      player.pointsAwarded += 10
      player.reasons.push('Perfect 10.0: within 1 Hz (+10)')
    } else if (player.withinFive) {
      player.pointsAwarded += 3
      player.reasons.push('Within 5 Hz (+3)')
    } else {
      player.reasons.push('No proximity bonus')
    }
  }

  if (players.p1.difference < players.p2.difference) {
    players.p1.pointsAwarded += 1
    players.p1.reasons.push('Closest guess (+1)')
  } else if (players.p2.difference < players.p1.difference) {
    players.p2.pointsAwarded += 1
    players.p2.reasons.push('Closest guess (+1)')
  } else {
    players.p1.pointsAwarded += 1
    players.p2.pointsAwarded += 1
    players.p1.reasons.push('Tied for closest (+1)')
    players.p2.reasons.push('Tied for closest (+1)')
  }

  if (responseTimes?.p1 != null && responseTimes?.p2 != null) {
    const timingGap = Math.abs(responseTimes.p1 - responseTimes.p2)

    if (timingGap <= 0.05) {
      players.p1.pointsAwarded += 1
      players.p2.pointsAwarded += 1
      players.p1.reasons.push('Matched response speed (+1)')
      players.p2.reasons.push('Matched response speed (+1)')
    } else if (responseTimes.p1 < responseTimes.p2) {
      players.p1.pointsAwarded += 1
      players.p1.reasons.push('Fastest lock after playback (+1)')
      players.p2.reasons.push('Slower lock: no speed bonus')
    } else {
      players.p2.pointsAwarded += 1
      players.p2.reasons.push('Fastest lock after playback (+1)')
      players.p1.reasons.push('Slower lock: no speed bonus')
    }
  }

  return {
    players,
    scoreDelta: {
      p1: players.p1.pointsAwarded,
      p2: players.p2.pointsAwarded,
    },
    summary:
      players.p1.difference === players.p2.difference
        ? 'Both players were equally close.'
        : players.p1.difference < players.p2.difference
          ? 'Player 1 edged the round.'
          : 'Player 2 edged the round.',
    responseTimes,
    wasTie: players.p1.difference === players.p2.difference,
    playoffWinnerId: null,
    playoffAutoWinId: null,
  }
}

function scorePlayoffRound(targetFrequency, guesses, playoffStake) {
  const players = {
    p1: buildPlayerResult(guesses.p1, targetFrequency),
    p2: buildPlayerResult(guesses.p2, targetFrequency),
  }

  const perfectPlayers = Object.entries(players)
    .filter(([, player]) => player.perfect)
    .map(([playerId]) => playerId)

  if (perfectPlayers.length === 1) {
    const winnerId = perfectPlayers[0]
    players[winnerId].reasons.push('Perfect 10.0: automatic playoff win')
    players[winnerId === 'p1' ? 'p2' : 'p1'].reasons.push('Playoff ended on opponent perfect hit')

    return {
      players,
      scoreDelta: {
        p1: 0,
        p2: 0,
      },
      summary: 'Playoff ended immediately on a perfect 10.0.',
      wasTie: false,
      playoffWinnerId: null,
      playoffAutoWinId: winnerId,
    }
  }

  if (perfectPlayers.length === 2) {
    if (players.p1.difference < players.p2.difference) {
      players.p1.reasons.push('Closer perfect hit: automatic playoff win')
      players.p2.reasons.push('Also perfect, but slightly farther away')

      return {
        players,
        scoreDelta: {
          p1: 0,
          p2: 0,
        },
        summary: 'A closer perfect hit decided the playoff instantly.',
        wasTie: false,
        playoffWinnerId: null,
        playoffAutoWinId: 'p1',
      }
    }

    if (players.p2.difference < players.p1.difference) {
      players.p2.reasons.push('Closer perfect hit: automatic playoff win')
      players.p1.reasons.push('Also perfect, but slightly farther away')

      return {
        players,
        scoreDelta: {
          p1: 0,
          p2: 0,
        },
        summary: 'A closer perfect hit decided the playoff instantly.',
        wasTie: false,
        playoffWinnerId: null,
        playoffAutoWinId: 'p2',
      }
    }
  }

  if (players.p1.difference < players.p2.difference) {
    players.p1.pointsAwarded = playoffStake
    players.p1.reasons.push(`Won playoff round (+${playoffStake})`)
    players.p2.reasons.push('Lost playoff round')

    return {
      players,
      scoreDelta: {
        p1: playoffStake,
        p2: 0,
      },
      summary: 'Player 1 broke the tie.',
      wasTie: false,
      playoffWinnerId: 'p1',
      playoffAutoWinId: null,
    }
  }

  if (players.p2.difference < players.p1.difference) {
    players.p2.pointsAwarded = playoffStake
    players.p2.reasons.push(`Won playoff round (+${playoffStake})`)
    players.p1.reasons.push('Lost playoff round')

    return {
      players,
      scoreDelta: {
        p1: 0,
        p2: playoffStake,
      },
      summary: 'Player 2 broke the tie.',
      wasTie: false,
      playoffWinnerId: 'p2',
      playoffAutoWinId: null,
    }
  }

  players.p1.reasons.push('Playoff round tied: no points awarded')
  players.p2.reasons.push('Playoff round tied: no points awarded')

  return {
    players,
    scoreDelta: {
      p1: 0,
      p2: 0,
    },
    summary: 'Playoff round tied. Stakes escalate next round.',
    wasTie: true,
    playoffWinnerId: null,
    playoffAutoWinId: null,
  }
}
