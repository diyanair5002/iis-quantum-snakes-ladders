  const N = 64;
  const CELL_PX = 64;
  const ladders = [{f: 2, t: 21}, {f: 10, t: 44}, {f: 27, t: 51}];
  const snakes = [{f: 42, dir: 'T'}, {f: 35, dir: 'R'}, {f: 14, dir: 'L'}];
  // Keep the 1/64 baseline teal while probabilities below 1% stay in the purple range.
  const viridisStops = [
    {position: 0, color: [68, 1, 84]},
    {position: 0.2, color: [72, 35, 116]},
    {position: 0.234, color: [33, 145, 140]},
    {position: 0.42, color: [53, 183, 121]},
    {position: 0.72, color: [181, 222, 43]},
    {position: 1, color: [253, 231, 37]}
  ];

  let amplitudes = new Array(N).fill(1 / Math.sqrt(N));
  let subStep = 0;
  let iterations = 0;
  let timer = null;
  let selectedSquareIndex = 42;
  let pendingProposal = null;
  let overlayGeometry = null;
  let inferenceRequestId = 0;

  function switchTab(id) {
    if (id === 'intro' && timer) {
      clearInterval(timer);
      timer = null;
      document.getElementById('play-btn').textContent = 'Play Algorithm';
    }
    document.querySelectorAll('.view').forEach(view => view.classList.remove('active'));
    document.querySelectorAll('.nav-btn').forEach(button => button.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelector(`[onclick="switchTab('${id}')"]`).classList.add('active');
    if (id === 'app') {
      render();
      drawSnakes();
      initK6();
    }
  }

  function probabilityColor(probability) {
    const perceptualProbability = Math.pow(Math.max(0, Math.min(1, probability)), 0.35);
    const upperIndex = viridisStops.findIndex(stop => stop.position >= perceptualProbability);
    const lower = viridisStops[Math.max(0, upperIndex - 1)];
    const upper = viridisStops[upperIndex < 0 ? viridisStops.length - 1 : upperIndex];
    const amount = upper.position === lower.position
      ? 0
      : (perceptualProbability - lower.position) / (upper.position - lower.position);
    const rgb = lower.color.map((channel, index) =>
      Math.round(channel + (upper.color[index] - channel) * amount)
    );
    return `rgb(${rgb.join(', ')})`;
  }

  function formatProbability(probability) {
    return `${(probability * 100).toFixed(4).replace(/\.?0+$/, '')}%`;
  }

  function basisKet(index) {
    return `|${index.toString(2).padStart(6, '0')}⟩`;
  }

  function updateFocalDetails() {
    const amplitude = amplitudes[selectedSquareIndex];
    document.getElementById('focal-square').textContent =
      `${selectedSquareIndex + 1} / ${basisKet(selectedSquareIndex)}`;
    document.getElementById('focal-amplitude').textContent =
      `${amplitude < 0 ? '−' : '+'}${Math.abs(amplitude).toFixed(6)}`;
    document.getElementById('focal-probability').textContent =
      formatProbability(amplitude * amplitude);
    document.getElementById('focal-phase').textContent = amplitude < 0 ? 'Negative' : 'Positive';
  }

  function render() {
    const grid = document.getElementById('grid');
    const target = Number(document.getElementById('target-slider').value) - 1;
    grid.replaceChildren();
    amplitudes.forEach((amplitude, index) => {
      const probability = amplitude * amplitude;
      const cell = document.createElement('div');
      const row = Math.floor(index / 8);
      const rgb = probabilityColor(probability);
      cell.className = `cell${index === selectedSquareIndex ? ' selected' : ''}`;
      cell.style.order = (7 - row) * 8 + (row % 2 === 0 ? index % 8 : 7 - (index % 8));
      cell.style.backgroundColor = rgb;
      cell.style.color = probability > 0.42 ? '#0f172a' : '#fff';
      cell.tabIndex = 0;
      cell.setAttribute('role', 'button');
      cell.setAttribute(
        'aria-label',
        `Square ${index + 1}, basis ${index.toString(2).padStart(6, '0')}, amplitude ${amplitude.toFixed(6)}, probability ${formatProbability(probability)}`
      );
      cell.title = `Amplitude: ${amplitude.toFixed(6)} | Probability: ${formatProbability(probability)}`;
      const squareLabel = document.createElement('span');
      squareLabel.className = 'cell-square';
      squareLabel.textContent = String(index + 1);
      const badge = document.createElement('span');
      badge.className = 'cell-badge';
      badge.textContent = `${amplitude < 0 ? '−' : '+'}${(probability * 100).toFixed(1)}%`;
      cell.append(squareLabel, badge);

      const selectCell = () => {
        selectedSquareIndex = index;
        render();
      };
      cell.addEventListener('click', selectCell);
      cell.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          selectCell();
        }
      });
      if (subStep === 1 && index === target) {
        cell.style.boxShadow = 'inset 0 0 0 3px #fde725';
      }
      grid.appendChild(cell);
    });

    const qubitRow = document.getElementById('qubit-row');
    qubitRow.replaceChildren();
    selectedSquareIndex.toString(2).padStart(6, '0').split('').forEach((bit, index) => {
      const qubit = document.createElement('div');
      qubit.className = `qubit-node${bit === '1' ? ' active' : ''}`;
      qubit.textContent = `Q${index}`;
      qubitRow.appendChild(qubit);
    });

    const mean = amplitudes.reduce((sum, amplitude) => sum + amplitude, 0) / N;
    document.getElementById('mean-ui').textContent = `${mean < 0 ? '−' : '+'}${Math.abs(mean).toFixed(6)}`;
    document.getElementById('prob-ui').textContent = formatProbability(amplitudes[target] ** 2);
    document.getElementById('iter-ui').textContent = String(iterations);
    document.getElementById('peak-warning').classList.toggle('visible', iterations >= 6);
    updateFocalDetails();
  }

  function runStep(step, targetIndex = Number(document.getElementById('target-slider').value) - 1) {
    const noise = Number(document.getElementById('noise-slider').value) / 100;
    const selectedStep = step || (subStep === 0 ? 'oracle' : 'diffusion');
    if (selectedStep === 'oracle') {
      amplitudes[targetIndex] *= -1;
      document.getElementById('op-tag').textContent = 'Phase Oracle';
      document.getElementById('op-desc').textContent = 'Target marked by phase inversion; probability is unchanged.';
      subStep = 1;
    } else if (selectedStep === 'diffusion') {
      const original = amplitudes;
      const mean = original.reduce((sum, amplitude) => sum + amplitude, 0) / N;
      amplitudes = original.map(amplitude => 2 * mean - amplitude);
      if (noise > 0) {
        const couplingFraction = noise * 0.08;
        ladders.forEach(ladder => {
          const sourceIndex = ladder.f - 1;
          const destinationIndex = ladder.t - 1;
          const transfer = amplitudes[sourceIndex] * couplingFraction;
          amplitudes[sourceIndex] -= transfer;
          amplitudes[destinationIndex] += transfer;
        });
        const snakeDamping = 1 - noise * 0.15;
        snakes.forEach(snake => {
          const sourceIndex = snake.f - 1;
          amplitudes[sourceIndex] *= snakeDamping;
        });
        const norm = Math.sqrt(amplitudes.reduce((sum, amplitude) => sum + amplitude * amplitude, 0));
        if (norm === 0 || !Number.isFinite(norm)) {
          throw new Error('Noisy diffusion produced an invalid state vector.');
        }
        amplitudes = amplitudes.map(amplitude => amplitude / norm);
      }
      iterations++;
      document.getElementById('op-tag').textContent = 'Diffusion Operator';
      document.getElementById('op-desc').textContent = noise === 0
        ? 'Ideal Grover diffusion: exact inversion about the mean, with no added coupling or damping.'
        : 'Noisy mode: Grover diffusion, ladder coupling, and snake damping applied; state renormalized.';
      subStep = 0;
    } else {
      throw new Error(`Unsupported proposed step: ${step}`);
    }
    render();
    if (selectedStep === 'diffusion' && !pendingProposal && [6, 7].includes(iterations)) {
      const coachingMessage = iterations === 6
        ? 'Iteration 6 reached the ~99.7% optimal peak; further steps over-rotate probability downward.'
        : 'Iteration 7 has over-rotated past the optimal peak, so target probability is falling.';
      showMessage(coachingMessage, ['Reset to Superposition']);
    }
  }

  function initK6() {
    const svg = document.getElementById('k6-svg');
    if (!svg) return;
    svg.replaceChildren();
    const nodes = [];
    for (let index = 0; index < 6; index++) {
      const angle = (index / 6) * Math.PI * 2;
      nodes.push({x: 60 + Math.cos(angle) * 45, y: 60 + Math.sin(angle) * 45});
    }
    nodes.forEach((node, index) => {
      nodes.forEach((other, otherIndex) => {
        if (index < otherIndex) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('x1', node.x);
          line.setAttribute('y1', node.y);
          line.setAttribute('x2', other.x);
          line.setAttribute('y2', other.y);
          line.setAttribute('stroke', 'var(--v-mid)');
          line.setAttribute('stroke-width', '0.5');
          line.setAttribute('opacity', '0.4');
          svg.appendChild(line);
        }
      });
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);
      circle.setAttribute('r', '5');
      circle.setAttribute('fill', '#0f172a');
      svg.appendChild(circle);
    });
  }

  function drawSnakes() {
    const svg = document.getElementById('overlay');
    svg.replaceChildren();
    const offset = 24;
    const getPos = index => {
      const row = Math.floor(index / 8);
      const column = index % 8;
      const screenColumn = row % 2 === 0 ? column : 7 - column;
      const screenRow = 7 - row;
      return {
        x: screenColumn * CELL_PX + CELL_PX / 2 + offset,
        y: screenRow * CELL_PX + CELL_PX / 2 + offset
      };
    };
    overlayGeometry = getPos;

    const noise = Number(document.getElementById('noise-slider').value);
    if (noise > 0) {
      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML = '<linearGradient id="snakeGrad"><stop offset="0%" stop-color="var(--snake)" stop-opacity="0.9"/><stop offset="100%" stop-color="var(--snake)" stop-opacity="0.25"/></linearGradient>';
      svg.appendChild(defs);

      ladders.forEach(ladder => {
        const start = getPos(ladder.f - 1);
        const end = getPos(ladder.t - 1);
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${start.x} ${start.y} L ${end.x} ${end.y}`);
        path.setAttribute('stroke', 'var(--v-super)');
        path.setAttribute('stroke-width', '4');
        path.setAttribute('stroke-dasharray', '6,6');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      });

      snakes.forEach(snake => {
        const start = getPos(snake.f - 1);
        let endX, endY, controlX, controlY;
        if (snake.dir === 'T') {
          endX = start.x - 30; endY = -10; controlX = start.x; controlY = start.y - 80;
        } else if (snake.dir === 'R') {
          endX = 570; endY = start.y + 30; controlX = start.x + 80; controlY = start.y;
        } else {
          endX = -10; endY = start.y - 30; controlX = start.x - 80; controlY = start.y;
        }
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${start.x} ${start.y} Q ${controlX} ${controlY} ${endX} ${endY}`);
        path.setAttribute('stroke', 'url(#snakeGrad)');
        path.setAttribute('stroke-width', '5');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-linecap', 'round');
        svg.appendChild(path);
      });
    }

    if (pendingProposal && overlayGeometry) {
      const point = getPos(pendingProposal.index);
      const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      ring.setAttribute('cx', point.x);
      ring.setAttribute('cy', point.y);
      ring.setAttribute('r', '28');
      ring.setAttribute('fill', 'none');
      ring.setAttribute('stroke', '#22d3ee');
      ring.setAttribute('stroke-width', '4');
      ring.setAttribute('stroke-dasharray', '7,5');
      svg.appendChild(ring);
    }
  }

  function showMessage(message, recoveryActions = [], isProposal = false) {
    const messageElement = document.getElementById('copilot-message');
    messageElement.textContent = message;
    messageElement.classList.add('visible');
    messageElement.classList.toggle('proposal', isProposal);
    messageElement.classList.remove('checking');
    messageElement.classList.remove('fresh');
    void messageElement.offsetWidth;
    messageElement.classList.add('fresh');
    const proposalBanner = document.getElementById('proposal-banner');
    proposalBanner.classList.toggle('visible', isProposal);
    document.getElementById('proposal-banner-text').textContent = isProposal ? message : '';
    const recoveryContainer = document.getElementById('recovery-chips');
    recoveryContainer.replaceChildren();
    recoveryActions.forEach(action => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'recovery-chip';
      chip.textContent = action;
      chip.addEventListener('click', () => handleRecovery(action));
      recoveryContainer.appendChild(chip);
    });
  }

  function showQueryReceipt(prompt) {
    const receipt = document.getElementById('copilot-query-echo');
    receipt.textContent = `You asked: "${prompt}"`;
    receipt.hidden = false;
  }

  function clearQueryReceipt() {
    const receipt = document.getElementById('copilot-query-echo');
    receipt.textContent = '';
    receipt.hidden = true;
  }

  function renderJsonInspector(payload) {
  document.getElementById('json-mode').textContent = 'Simulated Local Router';
  document.getElementById('json-payload').textContent = JSON.stringify(payload, null, 2);
}

  function routeInference(prompt) {
    const normalized = prompt.toLowerCase();
    const targetSquare = Number(document.getElementById('target-slider').value);
    const targetProbability = (amplitudes[targetSquare - 1] ** 2 * 100).toFixed(1);
    const isOverview = /\bwhat is grover\b|\bhow does grover\b|\bexplain the algorithm\b|\bhow does this board work\b|\bwhy 6 iterations\b|\boverview\b/.test(normalized);
    if (isOverview) {
      return {
        focus_square: null,
        concept_identified: 'grover_overview',
        explanation_text: `Grover's search targets square ${targetSquare}, currently ${targetProbability}%; six oracle-diffusion cycles can amplify it toward 99.7% using wave interference.`,
        visual_action: 'none',
        next_step: 'none',
        suggested_chips: [
          '1. Explain Oracle Phase Flip',
          '2. Run Diffusion Step',
          '3. Reset Simulation'
        ]
      };
    }

    const simulationTopics = /\b(oracle|phase|target|square|tile|diffusion|amplif\w*|probabilit\w*|amplitud\w*|quantum|grover|board|ladder|snake|state|interference|marked|hardware|decoheren\w*|noise)\b/.test(normalized);
    const explicitOutOfScope = /\b(equation|homework|trivia|weather|sports|news|translate|recipe|capital|president|celebrity)\b/.test(normalized);
    const outOfScope = explicitOutOfScope || !simulationTopics;
    if (outOfScope) {
      return {
        focus_square: null,
        concept_identified: 'out_of_scope',
        explanation_text: "I can explain this simulation, but I can't solve external equations or answer general trivia.",
        visual_action: 'none',
        next_step: 'none',
        suggested_chips: ['Explain Oracle Phase Flip', 'Highlight Target Square', 'Reset Simulation']
      };
    }

    const squareMatch = normalized.match(/\b(?:square|tile)\s*(\d{1,2})\b/);
    const requestedSquare = squareMatch ? Number(squareMatch[1]) : null;
    const focusSquare = requestedSquare !== null && requestedSquare >= 1 && requestedSquare <= N
      ? requestedSquare
      : selectedSquareIndex + 1;
    const focusIdx = focusSquare - 1;
    const pFocus = (amplitudes[focusIdx] ** 2 * 100).toFixed(1);
    const signFocus = amplitudes[focusIdx] < 0 ? '−' : '+';
    const mean = (amplitudes.reduce((sum, amplitude) => sum + amplitude, 0) / N).toFixed(3);
    const noise = Number(document.getElementById('noise-slider').value);
    const pTarget = (amplitudes[targetSquare - 1] ** 2 * 100).toFixed(1);
    const isDecoherenceQuestion = /\b(decoheren\w*|noise)\b/.test(normalized);
    const isDiffusionQuestion = /\b(diffusion|amplif|interference)\b/.test(normalized);
    const phaseExplanation =
      `Square ${focusSquare} is ${signFocus}${pFocus}% at cycle ${iterations}; oracle flips its phase, not probability. Mean ${mean}; target ${targetSquare}: ${pTarget}%; noise ${noise}%.`;
    const diffusionExplanation = iterations >= 6
      ? `Cycle ${iterations}: square ${focusSquare} is ${signFocus}${pFocus}%; mean ${mean}; target ${targetSquare}: ${pTarget}%; noise ${noise}%. Cycle 6 reached ~99.7%; more diffusion over-rotates downward.`
      : `Cycle ${iterations}: square ${focusSquare} is ${signFocus}${pFocus}%; diffusion reflects around mean ${mean}; target ${targetSquare}: ${pTarget}%; noise ${noise}%.`;
    const decoherenceExplanation =
      `Cycle ${iterations}: square ${focusSquare} is ${signFocus}${pFocus}%; decoherence ${noise}% ${noise > 0 ? 'activates ladder coupling and snake damping' : 'keeps paths ideally uncoupled'}; mean ${mean}; target ${targetSquare}: ${pTarget}%.`;
    return {
      focus_square: focusSquare,
      concept_identified: isDecoherenceQuestion ? 'decoherence_effect' : isDiffusionQuestion ? 'diffusion_amplification' : 'oracle_phase_invariance',
      explanation_text: isDecoherenceQuestion ? decoherenceExplanation : isDiffusionQuestion ? diffusionExplanation : phaseExplanation,
      visual_action: 'ghost_highlight',
      next_step: isDiffusionQuestion ? 'diffusion' : subStep === 0 ? 'oracle' : 'diffusion',
      suggested_chips: []
    };
  }

  function validateInference(payload) {
    const keys = [
      'focus_square', 'concept_identified', 'explanation_text',
      'visual_action', 'next_step', 'suggested_chips'
    ];
    if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
        Object.keys(payload).length !== keys.length ||
        !keys.every(key => Object.prototype.hasOwnProperty.call(payload, key))) {
      throw new TypeError('Copilot response does not match the required JSON schema.');
    }
    const validConcepts = ['oracle_phase_invariance', 'diffusion_amplification', 'decoherence_effect', 'grover_overview', 'out_of_scope'];
    const validActions = ['ghost_highlight', 'none'];
    const validSteps = ['oracle', 'diffusion', 'none'];
    const wordCount = typeof payload.explanation_text === 'string'
      ? payload.explanation_text.trim().split(/\s+/).filter(Boolean).length
      : Infinity;
    if ((payload.focus_square !== null &&
         (!Number.isInteger(payload.focus_square) ||
          payload.focus_square - 1 < 0 || payload.focus_square - 1 > 63)) ||
        !validConcepts.includes(payload.concept_identified) ||
        !validActions.includes(payload.visual_action) ||
        !validSteps.includes(payload.next_step) ||
        wordCount > 30 ||
        !Array.isArray(payload.suggested_chips) ||
        !payload.suggested_chips.every(chip => typeof chip === 'string')) {
      throw new RangeError('Copilot response contains invalid fields or an out-of-bounds square.');
    }
    if (['out_of_scope', 'grover_overview'].includes(payload.concept_identified) &&
        (payload.focus_square !== null || payload.visual_action !== 'none' || payload.next_step !== 'none')) {
      throw new TypeError('Overview and out-of-scope responses must not target or modify the board.');
    }
    if (!['out_of_scope', 'grover_overview'].includes(payload.concept_identified) &&
        (payload.focus_square === null || payload.visual_action !== 'ghost_highlight' ||
         !['oracle', 'diffusion'].includes(payload.next_step))) {
      throw new TypeError('In-scope responses must propose a valid square and simulation step.');
    }
    if (payload.concept_identified === 'grover_overview' &&
        !payload.suggested_chips.includes('1. Explain Oracle Phase Flip')) {
      throw new TypeError('Overview responses must include the expected recovery actions.');
    }
    return {
      ...payload,
      index: payload.focus_square === null ? null : payload.focus_square - 1
    };
  }

  function submitPrompt(prompt) {
    const submittedPrompt = prompt.trim();
    if (!submittedPrompt) return;

    const promptInput = document.getElementById('copilot-prompt');
    promptInput.value = '';
    showQueryReceipt(submittedPrompt);

    const requestId = ++inferenceRequestId;
    pendingProposal = null;
    document.getElementById('copilot-actions').hidden = true;
    drawSnakes();

    const messageElement = document.getElementById('copilot-message');
    messageElement.textContent = 'Checking state…';
    messageElement.classList.add('visible', 'checking');
    messageElement.classList.remove('proposal', 'fresh');
    document.getElementById('proposal-banner').classList.remove('visible');
    document.getElementById('proposal-banner-text').textContent = '';
    document.getElementById('recovery-chips').replaceChildren();
    document.getElementById('copilot-query-echo').scrollIntoView({
      behavior: 'smooth',
      block: 'nearest'
    });

    setTimeout(() => {
      if (requestId !== inferenceRequestId) return;
      const rawResponse = routeInference(submittedPrompt);
      const response = validateInference(rawResponse);
      renderJsonInspector(response);
      if (['out_of_scope', 'grover_overview'].includes(response.concept_identified)) {
        pendingProposal = null;
        document.getElementById('copilot-actions').hidden = true;
        drawSnakes();
        showMessage(response.explanation_text, response.suggested_chips);
        return;
      }

      pendingProposal = response;
      document.getElementById('copilot-actions').hidden = false;
      document.getElementById('recovery-chips').replaceChildren();
      drawSnakes();
      showMessage(response.explanation_text, [], true);
    }, 150);
  }

  function applyProposal() {
    if (!pendingProposal) return;
    const proposal = pendingProposal;
    pendingProposal = null;
    selectedSquareIndex = proposal.index;
    document.getElementById('copilot-actions').hidden = true;
    const coachingMilestone = proposal.next_step === 'diffusion' && [6, 7].includes(iterations + 1);
    runStep(proposal.next_step, proposal.index);
    drawSnakes();
    if (!coachingMilestone) {
      showMessage(`Applied ${proposal.next_step} to square ${proposal.focus_square}.`);
    }
  }

  function dismissProposal() {
    pendingProposal = null;
    document.getElementById('copilot-actions').hidden = true;
    drawSnakes();
    showMessage('Proposal dismissed; the board state is unchanged.');
  }

  function handleRecovery(action) {
    if (action === '1. Explain Oracle Phase Flip' || action === 'Explain Oracle Phase Flip') {
      document.getElementById('copilot-prompt').value = 'Why did the oracle flip the target phase?';
      submitPrompt(document.getElementById('copilot-prompt').value);
    } else if (action === '2. Run Diffusion Step') {
      document.getElementById('copilot-prompt').value = '';
      showQueryReceipt(action);
      const coachingMilestone = [6, 7].includes(iterations + 1);
      runStep('diffusion');
      if (!coachingMilestone) {
        showMessage('Applied one diffusion step to the current state vector.');
      }
    } else if (action === 'Highlight Target Square') {
      selectedSquareIndex = Number(document.getElementById('target-slider').value) - 1;
      render();
      document.getElementById('copilot-prompt').value = 'Highlight the target square';
      submitPrompt(document.getElementById('copilot-prompt').value);
    } else if (action === '3. Reset Simulation' || action === 'Reset Simulation' || action === 'Reset to Superposition') {
      document.getElementById('copilot-prompt').value = '';
      resetApp();
      showQueryReceipt(action);
      document.getElementById('copilot-actions').hidden = true;
      showMessage('The simulation has been reset to an equal superposition.');
    }
  }

  document.getElementById('copilot-form').addEventListener('submit', event => {
    event.preventDefault();
    const prompt = document.getElementById('copilot-prompt').value.trim();
    if (!prompt) return;
    document.getElementById('copilot-prompt').value = '';
    submitPrompt(prompt);
  });
  document.querySelectorAll('.starter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.getElementById('copilot-prompt').value = chip.textContent;
      document.getElementById('copilot-form').requestSubmit();
    });
  });
  document.getElementById('apply-proposal').addEventListener('click', applyProposal);
  document.getElementById('apply-proposal-board').addEventListener('click', applyProposal);
  document.getElementById('dismiss-proposal').addEventListener('click', dismissProposal);
  document.getElementById('dismiss-proposal-board').addEventListener('click', dismissProposal);
  document.getElementById('step-btn').addEventListener('click', () => runStep());
  document.getElementById('reset-btn').addEventListener('click', resetApp);

  document.getElementById('play-btn').addEventListener('click', function() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      this.textContent = 'Play Algorithm';
    } else {
      timer = setInterval(() => runStep(), 1000);
      this.textContent = 'Pause';
    }
  });

  function updateTarget(value) {
    document.getElementById('target-ui').textContent = value;
    selectedSquareIndex = Number(value) - 1;
    resetApp();
  }

  function updateNoise(value) {
    const noise = Number(value);
    document.getElementById('noise-ui').textContent = `${noise}%`;
    document.getElementById('noise-mode').textContent = noise === 0
      ? 'Ideal mode: exact unitary Grover operator.'
      : 'Noisy mode: ladder coupling and snake damping apply on the next diffusion.';
    drawSnakes();
  }

  function resetApp() {
    if (timer) {
      clearInterval(timer);
      timer = null;
      document.getElementById('play-btn').textContent = 'Play Algorithm';
    }
    amplitudes = new Array(N).fill(1 / Math.sqrt(N));
    iterations = 0;
    subStep = 0;
    pendingProposal = null;
    inferenceRequestId++;
    document.getElementById('copilot-actions').hidden = true;
    document.getElementById('proposal-banner').classList.remove('visible');
    clearQueryReceipt();
    render();
    drawSnakes();
    document.getElementById('op-tag').textContent = 'Initial Superposition';
    document.getElementById('op-desc').textContent = 'Hadamard layer: All 64 paths active.';
  }

  window.onload = () => {
    render();
    drawSnakes();
    initK6();
  };

Object.assign(window, { switchTab, updateTarget, updateNoise });
