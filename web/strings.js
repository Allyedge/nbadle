export const UI = {
  btnGuessIdle: 'Guess',
  btnGuessSelected: name => `Guess: ${name}`,
  btnHintAvailable: 'Hint',
  btnHintGameOver: 'Hint',

  toastAlreadyGuessed: 'Already guessed that player!',
  toastFailedPlayers: 'Failed to load players — is the API running?',
  toastFailedGuess: 'Failed to fetch player data. Try again.',
  toastHintNoTeammates: 'No more teammates to hint with.',
  toastHintClose: 'You are close — every column has been solved at least once.',

  placeholderLoading: 'Loading...',
  placeholderSearch: 'Search for an NBA player...',
  titleGameOver: 'Game over',

  difficultyEasyLabel: 'Easy',
  difficultyHardLabel: 'Hard',

  resultWinHeadline: 'NICE!',
  resultLoseHeadline: 'GAME OVER',
  resultWinSub: n => `You got it in ${n} ${n === 1 ? 'guess' : 'guesses'}`,
  resultLoseSub: 'The answer was',
};
