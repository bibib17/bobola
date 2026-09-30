/**
 * State Machine & Turn Manager Simultan BolaBola
 * Mengelola siklus fase Planning (12s), Lock-In, Resolution Phase (3.8s), dan Sudden Death.
 */
export class TurnManager {
  constructor({
    gameMode = 'SOLO', // 'SOLO' | 'LOCAL_2P' | 'ONLINE'
    onPhaseChange,
    onTurnChange,
    onTimerUpdate
  } = {}) {
    this.gameMode = gameMode;
    this.phase = 'LOBBY'; // 'LOBBY' | 'PLANNING' | 'RESOLUTION' | 'GOAL' | 'SUDDEN_DEATH' | 'GAMEOVER'
    this.turn = 1;
    this.maxTurns = 90;
    this.planningDuration = 12.0;
    this.planningTimer = this.planningDuration;
    this.resolutionDuration = 3.8;
    this.resolutionTimer = 0;
    this.isSuddenDeath = false;

    this.onPhaseChange = onPhaseChange || (() => {});
    this.onTurnChange = onTurnChange || (() => {});
    this.onTimerUpdate = onTimerUpdate || (() => {});
  }

  setMode(mode) {
    this.gameMode = mode;
  }

  setLobby() {
    this.phase = 'LOBBY';
    this.planningTimer = this.planningDuration;
    this.onPhaseChange(this.phase);
  }

  startPlanning() {
    this.phase = 'PLANNING';
    this.planningTimer = this.planningDuration;
    this.onPhaseChange(this.phase);
    this.onTimerUpdate(this.planningTimer, this.planningDuration);
  }

  startResolution(duration = 3.8) {
    this.phase = 'RESOLUTION';
    this.resolutionDuration = duration;
    this.resolutionTimer = duration;
    this.onPhaseChange(this.phase);
  }

  setGoalPhase() {
    this.phase = 'GOAL';
    this.onPhaseChange(this.phase);
  }

  setGameOver() {
    this.phase = 'GAMEOVER';
    this.onPhaseChange(this.phase);
  }

  checkTurnProgression(scoreRed, scoreBlue, targetScore = 3) {
    if (scoreRed >= targetScore || scoreBlue >= targetScore) {
      this.setGameOver();
      return { status: 'GAMEOVER', winner: scoreRed >= targetScore ? 'RED' : 'BLUE' };
    }

    if (this.turn >= this.maxTurns) {
      if (scoreRed === scoreBlue) {
        // Mode Sudden Death: Seri di turn 90
        this.isSuddenDeath = true;
        this.phase = 'SUDDEN_DEATH';
        this.onPhaseChange('SUDDEN_DEATH');
        return { status: 'SUDDEN_DEATH' };
      } else {
        this.setGameOver();
        return { status: 'GAMEOVER', winner: scoreRed > scoreBlue ? 'RED' : 'BLUE' };
      }
    }

    this.turn++;
    this.onTurnChange(this.turn, this.maxTurns);
    this.startPlanning();
    return { status: 'CONTINUE' };
  }

  update(dt, onTimerTick) {
    if (this.phase === 'LOBBY' || this.phase === 'GAMEOVER') {
      return 'IDLE';
    }

    if (this.phase === 'PLANNING') {
      const prevSec = Math.ceil(this.planningTimer);
      this.planningTimer -= dt;
      const curSec = Math.ceil(this.planningTimer);

      if (curSec !== prevSec && curSec <= 3 && curSec > 0) {
        if (onTimerTick) onTimerTick(curSec);
      }

      this.onTimerUpdate(Math.max(0, this.planningTimer), this.planningDuration);

      if (this.planningTimer <= 0) {
        return 'TIMEOUT';
      }
    } else if (this.phase === 'RESOLUTION') {
      this.resolutionTimer -= dt;
      if (this.resolutionTimer <= 0) {
        return 'RESOLUTION_END';
      }
    }

    return 'RUNNING';
  }

  reset() {
    this.phase = 'PLANNING';
    this.turn = 1;
    this.isSuddenDeath = false;
    this.planningTimer = this.planningDuration;
    this.onTurnChange(this.turn, this.maxTurns);
    this.onPhaseChange(this.phase);
  }
}
