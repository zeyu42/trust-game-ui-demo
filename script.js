const TOTAL_ROUNDS = 10;
const PAYOFF_BOTH = 75;
const PAYOFF_SOLO = 100;
const NEUTRAL_COLOR = '#808080';
const WAIT_COLOR = '#2b2b2b';
const WAIT_DURATION_MS = 1000;
const PARTNER_DOOR_NAMES = ['Door A', 'Door B'];
const PLAYER_DOOR_NAMES = ['Door C', 'Door D'];
const DOOR_COLOR_POOL = ['#503D3F', '#8C1C13', '#2A9D8F', '#264653', '#E76F51', '#457B9D', '#6A4C93'];

const elements = {
  panels: document.querySelectorAll('.panel'),
  intakeForm: document.getElementById('intake-form'),
  welcomeForm: document.getElementById('welcome-form'),
  beginGame: document.getElementById('begin-game'),
  instructionContinue: document.getElementById('instruction-continue'),
  instructionProgress: document.getElementById('instruction-progress'),
  resultToast: document.getElementById('result-toast'),
  roundCounter: document.getElementById('round-counter'),
  playerDoorVisual: document.getElementById('player-door-visual'),
  messageOptions: document.getElementById('message-options'),
  choiceOptions: document.getElementById('choice-options'),
  partnerSuggestion: document.getElementById('partner-suggestion'),
  messageStep: document.getElementById('message-step'),
  choiceStep: document.getElementById('choice-step'),
  messageForm: document.getElementById('message-form'),
  choiceForm: document.getElementById('choice-form'),
  feedbackPanel: document.getElementById('feedback-panel'),
  roundHistory: document.getElementById('round-history'),
  playerTotal: document.getElementById('player-total'),
  surveyForm: document.getElementById('survey-form'),
  genderSelect: document.getElementById('gender-select'),
  genderSelfLabel: document.getElementById('gender-self-label'),
  finalSummary: document.getElementById('final-summary'),
  detailedResults: document.getElementById('detailed-results'),
  restartButton: document.getElementById('restart'),
  waitOverlay: document.getElementById('wait-overlay'),
  waitText: document.getElementById('wait-text'),
};

const state = {
  config: null,
  currentRound: 0,
  history: [],
  treatmentApplied: false,
  roundContext: null,
  pendingMessageChoice: null,
  baseBackgroundColor: NEUTRAL_COLOR,
  isWaiting: false,
  isChoiceStep: false,
  instructionSequence: [],
  currentInstructionIndex: 0,
  resultToastTimer: null,
};

const showPanel = (id) => {
  elements.panels.forEach((panel) => {
    panel.classList.toggle('active', panel.id === id);
  });
};

const shuffle = (list) => list
  .map((item) => ({ item, sort: Math.random() }))
  .sort((a, b) => a.sort - b.sort)
  .map(({ item }) => item);

const pickDoorColors = () => shuffle(DOOR_COLOR_POOL).slice(0, 2);

const buildDoorSet = (names) => {
  const colors = pickDoorColors();
  return names.map((name, index) => ({ name, color: colors[index % colors.length] }));
};

const getAlternateDoor = (doors, doorName) => {
  const alternative = doors.find((door) => door.name !== doorName);
  return alternative ? alternative.name : doorName;
};

const formatCurrency = (amount) => `${amount} Units`;

const updateBodyBackground = () => {
  const targetColor = state.isWaiting ? WAIT_COLOR : state.baseBackgroundColor;
  document.body.style.backgroundColor = targetColor;
};

const setBaseBackground = (color) => {
  state.baseBackgroundColor = color;
  updateBodyBackground();
};

const hideResultToast = () => {
  if (!elements.resultToast) return;
  elements.resultToast.classList.remove('visible', 'correct', 'incorrect');
};

const showResultToast = (message, isCorrect) => {
  if (!elements.resultToast) return;
  if (state.resultToastTimer) {
    clearTimeout(state.resultToastTimer);
    state.resultToastTimer = null;
  }
  elements.resultToast.textContent = message;
  elements.resultToast.classList.remove('correct', 'incorrect');
  elements.resultToast.classList.add(isCorrect ? 'correct' : 'incorrect', 'visible');
  state.resultToastTimer = setTimeout(() => {
    hideResultToast();
    state.resultToastTimer = null;
  }, 2400);
};

const buildBadge = (text, isPositive) => `<span class="badge ${isPositive ? 'success' : 'error'}">${text}</span>`;

const showWaitScreen = (message, callback) => {
  state.isWaiting = true;
  elements.waitText.textContent = message;
  elements.waitOverlay.classList.add('visible');
  updateBodyBackground();

  setTimeout(() => {
    state.isWaiting = false;
    elements.waitOverlay.classList.remove('visible');
    updateBodyBackground();
    if (typeof callback === 'function') {
      callback();
    }
  }, WAIT_DURATION_MS);
};

const calculatePayoffs = (playerCorrect, partnerCorrect) => {
  if (playerCorrect && partnerCorrect) {
    return { playerPayoff: PAYOFF_BOTH, partnerPayoff: PAYOFF_BOTH };
  }
  if (playerCorrect && !partnerCorrect) {
    return { playerPayoff: PAYOFF_SOLO, partnerPayoff: 0 };
  }
  if (!playerCorrect && partnerCorrect) {
    return { playerPayoff: 0, partnerPayoff: PAYOFF_SOLO };
  }
  return { playerPayoff: 0, partnerPayoff: 0 };
};

const updateTotalsDisplay = () => {
  const totals = state.history.reduce((acc, round) => {
    acc.player += round.playerPayoff;
    return acc;
  }, { player: 0 });

  if (!state.config) {
    elements.playerTotal.textContent = formatCurrency(0);
    return;
  }

  if (state.config.feedbackMode === 'with') {
    elements.playerTotal.textContent = formatCurrency(totals.player);
  } else {
    elements.playerTotal.textContent = 'Hidden';
  }
};

const createRoundContext = (roundNumber) => {
  const playerDoors = buildDoorSet(PLAYER_DOOR_NAMES);
  const partnerDoors = buildDoorSet(PARTNER_DOOR_NAMES);
  const playerCorrectDoor = playerDoors[Math.floor(Math.random() * playerDoors.length)].name;
  const partnerCorrectDoor = partnerDoors[Math.floor(Math.random() * partnerDoors.length)].name;
  const partnerTellsTruth = Math.random() < 0.65;
  const partnerFollowsSuggestion = Math.random() < 0.6;
  const partnerSuggestion = partnerTellsTruth
    ? playerCorrectDoor
    : getAlternateDoor(playerDoors, playerCorrectDoor);

  return {
    roundNumber,
    playerDoors,
    partnerDoors,
    playerCorrectDoor,
    partnerCorrectDoor,
    partnerSuggestion,
    partnerFollowsSuggestion,
  };
};

const renderDoorVisual = () => {
  const round = state.roundContext;
  if (!round) return;
  const usePlayerDoors = state.isChoiceStep;
  const doorSet = usePlayerDoors ? round.playerDoors : round.partnerDoors;

  const doorHTML = doorSet.map((door) => {
    let labelText = '';
    if (usePlayerDoors && door.name === round.partnerSuggestion) {
      labelText = '↑ Your partner\'s suggestion';
    } else if (!usePlayerDoors && door.name === round.partnerCorrectDoor) {
      labelText = '↑ Correct for your partner';
    }
    return `
      <div class="door-card">
        <div class="door-frame">
          <div class="door-panel">
            <div class="door-knob"></div>
          </div>
        </div>
        <div class="door-name">${door.name}</div>
        <div class="door-label">${labelText}</div>
      </div>
    `;
  }).join('');
  elements.playerDoorVisual.innerHTML = doorHTML;
};

const renderMessageOptions = (round) => {
  elements.messageOptions.innerHTML = '';
  round.partnerDoors.forEach((door, index) => {
    const option = document.createElement('label');
    option.innerHTML = `
      <input type="radio" name="message-choice" value="${door.name}" ${index === 0 ? 'required' : ''}>
      Suggest ${door.name} ${door.name === round.partnerCorrectDoor ? '<span class="arrow-note">← Correct for your partner</span>' : ''}
    `;
    elements.messageOptions.appendChild(option);
  });
};

const renderChoiceOptions = (round) => {
  elements.choiceOptions.innerHTML = '';
  PLAYER_DOOR_NAMES.forEach((doorName, index) => {
    const isSuggested = doorName === round.partnerSuggestion;
    const label = document.createElement('label');
    label.innerHTML = `
      <input type="radio" name="door-choice" value="${doorName}" ${index === 0 ? 'required' : ''}>
      Open ${doorName} ${isSuggested ? '<span class="arrow-note">← Your partner\'s suggestion</span>' : ''}
    `;
    elements.choiceOptions.appendChild(label);
  });
};

const showMessageStep = () => {
  state.isChoiceStep = false;
  elements.messageStep.classList.remove('hidden');
  elements.choiceStep.classList.add('hidden');
  elements.partnerSuggestion.textContent = '';
  elements.messageForm.reset();
  renderDoorVisual();
};

const showChoiceStep = () => {
  const round = state.roundContext;
  state.isChoiceStep = true;
  elements.partnerSuggestion.textContent = `Your partner suggests you enter ${round.partnerSuggestion}.`;
  elements.choiceForm.reset();
  elements.messageStep.classList.add('hidden');
  elements.choiceStep.classList.remove('hidden');
  renderDoorVisual();
};

const renderRound = (round) => {
  elements.roundCounter.textContent = round.roundNumber;
  renderMessageOptions(round);
  renderChoiceOptions(round);
  showMessageStep();
};

const updateFeedbackPanel = (outcome) => {
  if (state.config.feedbackMode === 'with') {
    elements.feedbackPanel.classList.remove('muted');
    const badge = buildBadge(outcome.playerChoseCorrect ? 'Correct door' : 'Wrong door', outcome.playerChoseCorrect);
    elements.feedbackPanel.innerHTML = `Round ${outcome.roundNumber}: You opened <strong>${outcome.playerDoorChoice}</strong> ${badge} and earned ${formatCurrency(outcome.playerPayoff)}.`;
  } else {
    elements.feedbackPanel.classList.add('muted');
    elements.feedbackPanel.textContent = 'Round recorded. Payoffs will be shown after the survey.';
  }
};

const prependHistoryEntry = (outcome) => {
  const item = document.createElement('li');
  if (state.config.feedbackMode === 'with') {
    const truthBadge = buildBadge(outcome.toldTruth ? 'Correct tip' : 'Wrong tip', outcome.toldTruth);
    const doorBadge = buildBadge(outcome.playerChoseCorrect ? 'Correct door' : 'Wrong door', outcome.playerChoseCorrect);
    item.innerHTML = `
      <strong>Round ${outcome.roundNumber}</strong>
      <span>Suggested: ${outcome.playerMessage} ${truthBadge}</span>
      <span>Opened: ${outcome.playerDoorChoice} ${doorBadge} (<b>${outcome.playerDoorChoice === outcome.partnerSuggestion ? 'Followed' : 'Didn\'t follow'}</b> partner suggestion)</span>
      <span>Payoff: ${formatCurrency(outcome.playerPayoff)}</span>
    `;
  } else {
    item.textContent = `Round ${outcome.roundNumber} completed (result hidden).`;
  }
  elements.roundHistory.prepend(item);
};

const maybeApplyTreatment = (roundNumber) => {
  if (!state.config) return;
  if (state.treatmentApplied) return;
  if (state.config.treatmentRound == null) return;
  if (roundNumber === state.config.treatmentRound) {
    state.treatmentApplied = true;
    setBaseBackground(state.config.treatmentColor || '#FF0000');
  }
};

const resetHistoryUI = () => {
  elements.roundHistory.innerHTML = '';
  elements.feedbackPanel.classList.add('muted');
  elements.feedbackPanel.textContent = 'Results will appear here.';
};

const getInstructionSteps = () => Array.from(document.querySelectorAll('.instruction-step'));

const computeInstructionSequence = () => {
  const allSteps = getInstructionSteps();
  return allSteps.filter((step) => {
    const condition = step.dataset.condition || 'all';
    if (condition === 'all') return true;
    if (condition === 'feedback-with') return state.config?.feedbackMode === 'with';
    if (condition === 'feedback-without') return state.config?.feedbackMode === 'without';
    return false;
  });
};

const refreshInstructionStep = () => {
  const steps = state.instructionSequence;
  steps.forEach((step, index) => {
    step.classList.toggle('hidden', index !== state.currentInstructionIndex);
  });

  if (elements.instructionProgress) {
    if (steps.length > 0) {
      elements.instructionProgress.textContent = `Screen ${state.currentInstructionIndex + 1} of ${steps.length}`;
    } else {
      elements.instructionProgress.textContent = '';
    }
  }

  const onLastStep = steps.length > 0 && state.currentInstructionIndex === steps.length - 1;
  if (elements.instructionContinue) {
    elements.instructionContinue.classList.toggle('hidden', onLastStep || steps.length === 0);
  }
  if (elements.beginGame) {
    elements.beginGame.classList.toggle('hidden', !onLastStep);
  }
};

const prepareInstructionSequence = () => {
  const allSteps = getInstructionSteps();
  allSteps.forEach((step) => step.classList.add('hidden'));

  state.instructionSequence = computeInstructionSequence();
  state.currentInstructionIndex = 0;

  refreshInstructionStep();
};

const advanceInstructionStep = () => {
  if (!state.instructionSequence || state.instructionSequence.length === 0) return;
  if (state.currentInstructionIndex >= state.instructionSequence.length - 1) return;
  state.currentInstructionIndex += 1;
  refreshInstructionStep();
};

const startGame = () => {
  state.history = [];
  state.currentRound = 1;
  state.treatmentApplied = false;
  state.pendingMessageChoice = null;
  state.isChoiceStep = false;
  state.roundContext = createRoundContext(state.currentRound);
  setBaseBackground(NEUTRAL_COLOR);
  resetHistoryUI();
  updateTotalsDisplay();
  renderRound(state.roundContext);
  showPanel('game-screen');
};

const completeRound = (playerMessage, playerDoorChoice) => {
  const round = state.roundContext;
  const toldTruth = playerMessage === round.partnerCorrectDoor;
  const playerChoseCorrect = playerDoorChoice === round.playerCorrectDoor;
  const partnerFollowedSuggestion = round.partnerFollowsSuggestion;
  const partnerDoorChoice = partnerFollowedSuggestion
    ? playerMessage
    : getAlternateDoor(round.partnerDoors, playerMessage);
  const partnerChoseCorrect = partnerDoorChoice === round.partnerCorrectDoor;
  const payoff = calculatePayoffs(playerChoseCorrect, partnerChoseCorrect);

  const outcome = {
    roundNumber: round.roundNumber,
    playerDoorChoice,
    playerChoseCorrect,
    partnerDoorChoice,
    partnerChoseCorrect,
    partnerFollowedSuggestion,
    partnerSuggestion: round.partnerSuggestion,
    toldTruth,
    playerMessage,
    playerPayoff: payoff.playerPayoff,
    partnerPayoff: payoff.partnerPayoff,
  };

  state.history.push(outcome);
  updateFeedbackPanel(outcome);
  if (state.config?.feedbackMode === 'with') {
    const toastMessage = outcome.playerChoseCorrect
      ? `Correct! ${outcome.playerDoorChoice} had the prize.`
      : `Wrong door: ${outcome.playerDoorChoice} missed the prize.`;
    showResultToast(toastMessage, outcome.playerChoseCorrect);
  }
  prependHistoryEntry(outcome);
  updateTotalsDisplay();
  state.pendingMessageChoice = null;

  maybeApplyTreatment(state.currentRound);

  if (state.currentRound >= TOTAL_ROUNDS) {
    showPanel('survey-screen');
    return;
  }

  state.currentRound += 1;
  state.roundContext = createRoundContext(state.currentRound);
  state.isChoiceStep = false;
  renderRound(state.roundContext);
};

const buildResultsTable = () => {
  const table = document.createElement('table');
  table.innerHTML = `
    <thead>
      <tr>
        <th>Round</th>
        <th>Suggested prize door</th>
        <th>Your door</th>
        <th>Partner door</th>
        <th>Your payoff</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement('tbody');
  state.history.forEach((round) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${round.roundNumber}</td>
      <td>${round.toldTruth ? 'Yes' : 'No'}</td>
      <td>${round.playerDoorChoice} (${round.playerChoseCorrect ? 'correct' : 'wrong'})</td>
      <td>${round.partnerDoorChoice} (${round.partnerChoseCorrect ? 'correct' : 'wrong'})</td>
      <td>${formatCurrency(round.playerPayoff)}</td>
    `;
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  return table;
};

const renderResults = () => {
  const totals = state.history.reduce((acc, round) => {
    acc.player += round.playerPayoff;
    return acc;
  }, { player: 0 });

  // const treatmentText = state.config.treatmentRound == null
  //   ? 'The background color never changed (control condition).'
  //   : `The background switched to ${state.config.treatmentColor} after round ${state.config.treatmentRound}.`;

  const feedbackText = state.config.feedbackMode === 'with'
    ? 'You saw feedback after each round.'
    : 'This was the without-feedback condition, so results are shown only now.';

  elements.finalSummary.textContent = `${feedbackText} You earned ${formatCurrency(totals.player)} in total.`;

  elements.detailedResults.innerHTML = '';
  elements.detailedResults.appendChild(buildResultsTable());
};

const resetDemo = () => {
  state.config = null;
  state.history = [];
  state.currentRound = 0;
  state.treatmentApplied = false;
  state.roundContext = null;
  state.pendingMessageChoice = null;
  state.isWaiting = false;
  state.isChoiceStep = false;
  state.instructionSequence = [];
  state.currentInstructionIndex = 0;
  elements.welcomeForm.reset();
  elements.intakeForm.reset();
  elements.surveyForm.reset();
  elements.detailedResults.innerHTML = '';
  elements.finalSummary.textContent = '';
  elements.waitOverlay.classList.remove('visible');
  hideResultToast();
  if (state.resultToastTimer) {
    clearTimeout(state.resultToastTimer);
    state.resultToastTimer = null;
  }
  setBaseBackground(NEUTRAL_COLOR);
  resetHistoryUI();
  updateTotalsDisplay();
  if (elements.beginGame) {
    elements.beginGame.classList.add('hidden');
  }
  if (elements.instructionContinue) {
    elements.instructionContinue.classList.remove('hidden');
  }
  const allInstructionSteps = getInstructionSteps();
  allInstructionSteps.forEach((step, index) => {
    step.classList.toggle('hidden', index !== 0);
  });
  if (elements.instructionProgress) {
    const alwaysSteps = getInstructionSteps().filter((step) => (step.dataset.condition || 'all') === 'all');
    elements.instructionProgress.textContent = alwaysSteps.length > 0
      ? `Screen 1 of ${alwaysSteps.length}`
      : '';
  }
  showPanel('welcome-screen');
};

// Event listeners

elements.intakeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  showPanel('instruction-screen');
});

elements.welcomeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const formData = new FormData(event.target);
  const feedbackMode = formData.get('feedback');
  if (!feedbackMode) return;
  const treatmentRoundValue = formData.get('treatmentRound');
  state.config = {
    feedbackMode,
    treatmentRound: treatmentRoundValue === 'never' ? null : Number(treatmentRoundValue),
    treatmentColor: formData.get('treatmentColor') || '#FF0000',
  };
  state.treatmentApplied = false;
  setBaseBackground(NEUTRAL_COLOR);
  prepareInstructionSequence();
  showPanel('intake-screen');
});

elements.beginGame.addEventListener('click', () => {
  if (!state.config) return;
  startGame();
});

if (elements.instructionContinue) {
  elements.instructionContinue.addEventListener('click', () => {
    advanceInstructionStep();
  });
}

elements.genderSelect.addEventListener('change', (event) => {
  const shouldShow = event.target.value === 'self-describe';
  elements.genderSelfLabel.classList.toggle('hidden', !shouldShow);
  elements.genderSelfLabel.querySelector('input').required = shouldShow;
});

elements.surveyForm.addEventListener('submit', (event) => {
  event.preventDefault();
  renderResults();
  showPanel('results-screen');
});

elements.messageForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const selection = elements.messageForm.querySelector('input[name="message-choice"]:checked');
  if (!selection) return;
  state.pendingMessageChoice = selection.value;
  showWaitScreen('Waiting for your partner...', () => {
    showChoiceStep();
  });
});

elements.choiceForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!state.pendingMessageChoice) return;
  const doorChoice = elements.choiceForm.querySelector('input[name="door-choice"]:checked');
  if (!doorChoice) return;
  showWaitScreen('Processing round results...', () => {
    completeRound(state.pendingMessageChoice, doorChoice.value);
  });
});

elements.restartButton.addEventListener('click', () => {
  resetDemo();
});

// Initialize
resetDemo();
