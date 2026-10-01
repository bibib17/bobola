import { Character, CHARACTER_DEFS, TEAM_COLORS } from './entities/character.js';
import { spriteManager } from './entities/spriteManager.js';
import { Ball } from './entities/ball.js';
import { PhysicsEngine } from './physics/engine.js';
import { SlingshotController } from './controls/slingshot.js';
import { SoundFX } from './audio/soundFX.js';
import { OrientationManager } from './controls/orientation.js';
import { PWAManager } from './controls/pwaManager.js';
import { MobileUXManager } from './controls/mobileUX.js';
import { NetworkClient } from './network/networkClient.js';
import { TurnManager } from './network/turnManager.js';

export class Game {
  constructor() {
    this.canvas = document.getElementById('game-canvas');
    this.ctx = this.canvas.getContext('2d');

    // Resolusi Virtual Lapangan Meja
    this.VIRTUAL_WIDTH = 960;
    this.VIRTUAL_HEIGHT = 540;
    this.setupCanvasDPI();

    // Modul Audio & Fisika
    this.soundFX = new SoundFX();
    this.physics = new PhysicsEngine({
      width: this.VIRTUAL_WIDTH,
      height: this.VIRTUAL_HEIGHT,
      soundFX: this.soundFX
    });

    // Orientasi Layar, PWA & Mobile UX Manager
    this.orientation = new OrientationManager();
    this.pwa = new PWAManager();
    this.mobileUX = new MobileUXManager({
      soundFX: this.soundFX,
      getGameInstance: () => this
    });

    // Game Mode & Network
    this.gameMode = 'SOLO'; // 'SOLO' | 'LOCAL_2P' | 'ONLINE'
    this.userTeam = 'RED'; // 'RED' | 'BLUE'
    this.userCharKey = 'ZIGGY';
    this.userPlayerName = 'Kamu';
    this.roomId = null;
    this.playerId = null;
    this.hostId = null;
    this.onlineRoomPlayers = [];
    this.isUserReadyInRoom = false;
    this.network = new NetworkClient({
      onMessage: (data) => this.handleNetworkMessage(data),
      onStatusChange: (connected, msg) => this.handleNetworkStatus(connected, msg)
    });

    // Turn Manager
    this.turnManager = new TurnManager({
      gameMode: this.gameMode,
      onPhaseChange: (phase) => this.onPhaseChange(phase),
      onTurnChange: (turn, max) => this.onTurnChange(turn, max),
      onTimerUpdate: (timer, dur) => this.updateTimerBar(timer, dur)
    });

    this.scoreRed = 0;
    this.scoreBlue = 0;
    this.targetScore = 3;

    // Entitas Bidak & Bola
    this.entities = [];
    this.ball = new Ball(this.VIRTUAL_WIDTH / 2, this.VIRTUAL_HEIGHT / 2);

    // Efek Selebrasi & Kamera
    this.confetti = [];
    this.cameraShake = 0;

    // Statistik Pertandingan
    this.matchStats = {
      shotsRed: 0,
      shotsBlue: 0,
      tacklesRed: 0,
      tacklesBlue: 0,
      pickups: 0,
      possessionRed: 50,
      possessionBlue: 50
    };

    // Inisialisasi Karakter Lapangan
    this.initCharacters();

    // Kontrol Slingshot (Default: Arah gerak ditarik langsung dari pemain)
    this.slingshot = new SlingshotController({
      canvas: this.canvas,
      getEntities: () => this.entities,
      soundFX: this.soundFX,
      aimMode: 'DIRECT',
      virtualWidth: this.VIRTUAL_WIDTH,
      virtualHeight: this.VIRTUAL_HEIGHT,
      onAimChange: (char) => this.onUserAim(char),
      onSelectCharacter: (char) => this.selectCharacter(char)
    });

    // Preview Canvas untuk Layar Pemilihan Karakter
    this.previewCanvas = document.getElementById('preview-canvas');
    this.previewCtx = this.previewCanvas ? this.previewCanvas.getContext('2d') : null;
    this.setupPreviewCanvasDPI();
    this.previewChar = new Character({
      charKey: this.userCharKey,
      team: this.userTeam,
      x: 65,
      y: 65,
      isUser: true
    });

    // Bind UI & Event Listeners
    this.bindUI();
    this.renderCharacterSelectionGrid();
    this.updatePreviewCard();
    this.checkUrlRoomParam();

    // Pemuatan Aset Sprite Koin Resolusi Tinggi (Merah & Biru)
    spriteManager.load().then(() => {
      this.renderCharacterSelectionGrid();
      this.updatePreviewCard();
    });

    // Kunci kontrol & set fase awal ke LOBBY saat aplikasi pertama dimuat
    this.turnManager.setLobby();
    this.slingshot.setLock(true);

    // Mulai Loop Game 60 FPS
    this.lastTime = performance.now();
    window.game = this;
    requestAnimationFrame((t) => this.loop(t));
  }

  checkUrlRoomParam() {
    const urlParams = new URLSearchParams(window.location.search);
    const roomParam = urlParams.get('room');
    if (roomParam) {
      this.gameMode = 'ONLINE';
      this.turnManager.setMode('ONLINE');
      const modeOnlineCard = document.getElementById('mode-online');
      const modeSoloCard = document.getElementById('mode-solo');
      if (modeOnlineCard && modeSoloCard) {
        modeSoloCard.classList.remove('active');
        modeOnlineCard.classList.add('active');
      }
      const onlineInputs = document.getElementById('online-room-inputs');
      const inputRoom = document.getElementById('input-room-code');
      if (onlineInputs) onlineInputs.classList.remove('hidden');
      if (inputRoom) inputRoom.value = roomParam.toUpperCase();
      this.network.connect();
    }
  }

  setupCanvasDPI() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = this.VIRTUAL_WIDTH * dpr;
    this.canvas.height = this.VIRTUAL_HEIGHT * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  setupPreviewCanvasDPI() {
    if (!this.previewCanvas || !this.previewCtx) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.previewCanvas.width = 130 * dpr;
    this.previewCanvas.height = 130 * dpr;
    this.previewCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  initCharacters() {
    // 8 Karakter Unik: 4 di Tim Merah, 4 di Tim Biru
    const redKeys = ['ROCCO', 'ZIGGY', 'MILO', 'BORIS'];
    const blueKeys = ['KIKI', 'TRIXIE', 'SPIKE', 'OLLIE'];

    // Jika user memilih tim Biru, tukar posisi roster
    let currentRedKeys = [...redKeys];
    let currentBlueKeys = [...blueKeys];

    if (this.userTeam === 'BLUE') {
      if (!currentBlueKeys.includes(this.userCharKey)) {
        currentBlueKeys[0] = this.userCharKey;
      }
    } else {
      if (!currentRedKeys.includes(this.userCharKey)) {
        currentRedKeys[1] = this.userCharKey;
      }
    }

    const redPositions = [
      { x: 140, y: 270, number: 8, role: 'Bek' },
      { x: 410, y: 270, number: 5, role: 'Striker' },
      { x: 270, y: 155, number: 6, role: 'Sayap' },
      { x: 270, y: 385, number: 7, role: 'Tengah' }
    ];

    const bluePositions = [
      { x: 550, y: 270, number: 3, role: 'Striker' },
      { x: 690, y: 155, number: 1, role: 'Sayap' },
      { x: 690, y: 385, number: 4, role: 'Tengah' },
      { x: 820, y: 270, number: 2, role: 'Bek' }
    ];

    this.entities = [];

    // Buat Tim Merah
    currentRedKeys.forEach((key, idx) => {
      const isUser = this.userTeam === 'RED' && key === this.userCharKey;
      const def = CHARACTER_DEFS[key] || CHARACTER_DEFS.ROCCO;
      const char = new Character({
        charKey: key,
        team: 'RED',
        number: redPositions[idx].number,
        playerName: isUser ? `${def.name} (Kamu)` : def.name,
        x: redPositions[idx].x,
        y: redPositions[idx].y,
        isUser
      });
      this.entities.push(char);
      if (isUser) this.activeUserChar = char;
    });

    // Buat Tim Biru
    currentBlueKeys.forEach((key, idx) => {
      const isUser = this.userTeam === 'BLUE' && key === this.userCharKey;
      const def = CHARACTER_DEFS[key] || CHARACTER_DEFS.KIKI;
      const char = new Character({
        charKey: key,
        team: 'BLUE',
        number: bluePositions[idx].number,
        playerName: isUser ? `${def.name} (Kamu)` : def.name,
        x: bluePositions[idx].x,
        y: bluePositions[idx].y,
        isUser
      });
      this.entities.push(char);
      if (isUser) this.activeUserChar = char;
    });

    if (!this.activeUserChar) {
      this.activeUserChar = this.entities[0];
      this.activeUserChar.isUser = true;
    }

    // Jika mode ONLINE, sinkronkan semua pemain manusia yang terhubung
    if (this.gameMode === 'ONLINE' && this.onlineRoomPlayers.length > 0) {
      this.entities.forEach(char => {
        const onlinePlayer = this.onlineRoomPlayers.find(p => p.charKey === char.charKey && p.team === char.team);
        if (onlinePlayer) {
          const isMe = onlinePlayer.id === this.playerId;
          char.isUser = isMe;
          char.playerName = isMe ? `${onlinePlayer.name} (Kamu)` : onlinePlayer.name;
          if (isMe) this.activeUserChar = char;
        } else {
          char.isUser = false;
        }
      });
    }

    if (this.slingshot) {
      this.slingshot.setSelectedCharacter(this.activeUserChar);
    }
  }

  bindUI() {
    // Mode Cards
    document.querySelectorAll('.mode-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.mode-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        this.gameMode = card.getAttribute('data-mode');
        this.turnManager.setMode(this.gameMode);

        const onlineInputs = document.getElementById('online-room-inputs');
        const soloActionRow = document.getElementById('lobby-action-row-solo');
        if (onlineInputs) {
          if (this.gameMode === 'ONLINE' || this.gameMode === 'ONLINE_1V1') {
            onlineInputs.classList.remove('hidden');
            if (soloActionRow) soloActionRow.classList.add('hidden');
            this.network.connect();
          } else {
            onlineInputs.classList.add('hidden');
            if (soloActionRow) soloActionRow.classList.remove('hidden');
          }
        }
      });
    });

    // Lobby Buttons
    const btnProceed = document.getElementById('btn-proceed-customizer');
    const lobbyScreen = document.getElementById('lobby-screen');
    const charSelectScreen = document.getElementById('character-select-screen');

    if (btnProceed) {
      btnProceed.addEventListener('click', () => {
        if (lobbyScreen) lobbyScreen.classList.add('hidden');
        if (charSelectScreen) charSelectScreen.classList.remove('hidden');
      });
    }

    const btnBackLobby = document.getElementById('btn-back-to-lobby');
    if (btnBackLobby) {
      btnBackLobby.addEventListener('click', () => {
        this.returnToLobby();
      });
    }

    // Team Kit Switcher
    const btnPickRed = document.getElementById('btn-pick-red');
    const btnPickBlue = document.getElementById('btn-pick-blue');
    if (btnPickRed && btnPickBlue) {
      btnPickRed.addEventListener('click', () => {
        this.userTeam = 'RED';
        btnPickRed.classList.add('active');
        btnPickBlue.classList.remove('active');
        this.previewChar.setTeam('RED');
        this.renderCharacterSelectionGrid();
        this.updatePreviewCard();
        this.soundFX.playBoing(1.1);
      });

      btnPickBlue.addEventListener('click', () => {
        this.userTeam = 'BLUE';
        btnPickBlue.classList.add('active');
        btnPickRed.classList.remove('active');
        this.previewChar.setTeam('BLUE');
        this.renderCharacterSelectionGrid();
        this.updatePreviewCard();
        this.soundFX.playBoing(1.1);
      });
    }

    // Start Match Button
    const btnStartMatch = document.getElementById('btn-start-match');
    if (btnStartMatch) {
      btnStartMatch.addEventListener('click', () => {
        if (charSelectScreen) charSelectScreen.classList.add('hidden');
        this.resetMatch();
        this.soundFX.playWhistle();

        if (this.gameMode === 'ONLINE') {
          this.network.requestStartMatch();
        }
      });
    }

    // In-Game Buttons
    const btnReady = document.getElementById('btn-ready');
    const btnMute = document.getElementById('btn-mute');
    const btnStats = document.getElementById('btn-stats');
    const btnSettings = document.getElementById('btn-settings');
    const btnRematch = document.getElementById('btn-rematch');
    const btnEndToMenu = document.getElementById('btn-end-to-menu');
    const btnEmote = document.getElementById('btn-emote');

    if (btnEmote) {
      btnEmote.addEventListener('click', () => {
        this.mobileUX.toggleEmoteBar();
        this.soundFX.triggerHaptic('light');
      });
    }

    if (btnReady) {
      btnReady.addEventListener('click', () => this.toggleUserReady());
    }

    // Klik roster dot di bar bawah untuk langsung memilih koin tersebut
    ['rocco', 'ziggy', 'milo', 'boris', 'kiki', 'trixie', 'spike', 'ollie'].forEach(id => {
      const dot = document.getElementById(`dot-${id}`);
      if (dot) {
        dot.style.cursor = 'pointer';
        dot.addEventListener('click', () => {
          const char = this.entities.find(e => e.def.id === id);
          if (char) {
            this.selectCharacter(char);
            this.soundFX.playBoing(1.2);
          }
        });
      }
    });

    if (btnMute) {
      btnMute.addEventListener('click', () => {
        const isMuted = this.soundFX.toggleMute();
        btnMute.textContent = isMuted ? '🔇' : '🔊';
      });
    }

    if (btnStats) {
      btnStats.addEventListener('click', () => this.toggleStatsModal());
    }

    if (btnSettings) {
      btnSettings.addEventListener('click', () => this.toggleSettingsModal());
    }

    if (btnRematch) {
      btnRematch.addEventListener('click', () => this.resetMatch());
    }

    const btnHome = document.getElementById('btn-home');
    if (btnHome) {
      btnHome.addEventListener('click', () => this.returnToLobby());
    }

    if (btnEndToMenu) {
      btnEndToMenu.addEventListener('click', () => {
        this.returnToLobby();
      });
    }

    // Modal Close Buttons
    const btnCloseStats = document.getElementById('btn-close-stats');
    const btnDismissStats = document.getElementById('btn-dismiss-stats');
    if (btnCloseStats) btnCloseStats.addEventListener('click', () => this.toggleStatsModal(false));
    if (btnDismissStats) btnDismissStats.addEventListener('click', () => this.toggleStatsModal(false));

    const btnCloseSettings = document.getElementById('btn-close-settings');
    const btnResumeGame = document.getElementById('btn-resume-game');
    const btnRestartGame = document.getElementById('btn-restart-game');
    const btnExitLobby = document.getElementById('btn-exit-lobby');

    if (btnCloseSettings) btnCloseSettings.addEventListener('click', () => this.toggleSettingsModal(false));
    if (btnResumeGame) btnResumeGame.addEventListener('click', () => this.toggleSettingsModal(false));
    if (btnRestartGame) btnRestartGame.addEventListener('click', () => {
      this.toggleSettingsModal(false);
      this.resetMatch();
    });
    if (btnExitLobby) btnExitLobby.addEventListener('click', () => {
      this.returnToLobby();
    });

    // Aim Mode Toggles in Settings
    const btnAimSlingshot = document.getElementById('btn-aim-slingshot');
    const btnAimDirect = document.getElementById('btn-aim-direct');
    if (btnAimSlingshot && btnAimDirect) {
      btnAimSlingshot.addEventListener('click', () => {
        btnAimSlingshot.classList.add('active');
        btnAimDirect.classList.remove('active');
        this.slingshot.setAimMode('SLINGSHOT');
      });
      btnAimDirect.addEventListener('click', () => {
        btnAimDirect.classList.add('active');
        btnAimSlingshot.classList.remove('active');
        this.slingshot.setAimMode('DIRECT');
      });
    }

    // Volume Slider
    const sliderVol = document.getElementById('slider-volume');
    if (sliderVol) {
      sliderVol.addEventListener('input', (e) => {
        this.soundFX.setVolume(e.target.value / 100);
      });
    }

    // Sudden Death Banner Button
    const btnStartSD = document.getElementById('btn-start-sudden-death');
    if (btnStartSD) {
      btnStartSD.addEventListener('click', () => {
        const sdBanner = document.getElementById('sudden-death-banner');
        if (sdBanner) sdBanner.classList.add('hidden');
        this.turnManager.startPlanning();
      });
    }

    // Online Room Buttons
    const btnCreateRoom = document.getElementById('btn-create-room');
    const btnJoinRoom = document.getElementById('btn-join-room');
    const btnRandomCode = document.getElementById('btn-random-code');
    const inputPlayer = document.getElementById('input-player-name');
    const inputRoom = document.getElementById('input-room-code');

    if (btnRandomCode && inputRoom) {
      btnRandomCode.addEventListener('click', () => {
        inputRoom.value = 'BOLA' + Math.floor(10 + Math.random() * 89);
        this.soundFX.playBoing(1.2);
      });
    }

    if (btnCreateRoom) {
      btnCreateRoom.addEventListener('click', () => {
        this.userPlayerName = inputPlayer && inputPlayer.value.trim() ? inputPlayer.value.trim() : 'Player 1';
        const code = inputRoom && inputRoom.value.trim() ? inputRoom.value.trim().toUpperCase() : ('BOLA' + Math.floor(10 + Math.random() * 89));
        if (inputRoom) inputRoom.value = code;
        const matchType = this.gameMode === 'ONLINE_1V1' ? '1V1' : 'PARTY';
        this.network.connect();
        this.network.createRoom(code, this.userPlayerName, this.userTeam, this.userCharKey, matchType);
      });
    }

    if (btnJoinRoom) {
      btnJoinRoom.addEventListener('click', () => {
        this.userPlayerName = inputPlayer && inputPlayer.value.trim() ? inputPlayer.value.trim() : 'Player 2';
        const code = inputRoom && inputRoom.value.trim() ? inputRoom.value.trim().toUpperCase() : 'BOLA1';
        const matchType = this.gameMode === 'ONLINE_1V1' ? '1V1' : 'PARTY';
        this.network.connect();
        this.network.joinRoom(code, this.userPlayerName, this.userTeam, this.userCharKey, matchType);
      });
    }

    // Room Lobby Screen Buttons
    const btnRoomCopy = document.getElementById('btn-room-copy-code');
    if (btnRoomCopy) {
      btnRoomCopy.addEventListener('click', () => {
        const roomId = this.roomId || (inputRoom && inputRoom.value ? inputRoom.value.trim().toUpperCase() : 'BOLA1');
        this.mobileUX.shareRoom(roomId);
      });
    }

    const btnRoomJoinRed = document.getElementById('btn-room-join-red');
    if (btnRoomJoinRed) {
      btnRoomJoinRed.addEventListener('click', () => {
        this.userTeam = 'RED';
        this.network.changeTeam('RED', this.userCharKey);
        this.soundFX.playBoing(1.1);
        this.renderRoomLobby();
      });
    }

    const btnRoomJoinBlue = document.getElementById('btn-room-join-blue');
    if (btnRoomJoinBlue) {
      btnRoomJoinBlue.addEventListener('click', () => {
        this.userTeam = 'BLUE';
        this.network.changeTeam('BLUE', this.userCharKey);
        this.soundFX.playBoing(1.1);
        this.renderRoomLobby();
      });
    }

    const btnRoomReady = document.getElementById('btn-room-ready');
    if (btnRoomReady) {
      btnRoomReady.addEventListener('click', () => {
        this.isUserReadyInRoom = !this.isUserReadyInRoom;
        this.network.sendReady(this.isUserReadyInRoom);
        this.soundFX.playBoing(1.2);
        this.renderRoomLobby();
      });
    }

    const btnRoomStart = document.getElementById('btn-room-start');
    if (btnRoomStart) {
      btnRoomStart.addEventListener('click', () => {
        this.network.requestStartMatch();
      });
    }

    const btnRoomLeave = document.getElementById('btn-room-leave');
    if (btnRoomLeave) {
      btnRoomLeave.addEventListener('click', () => {
        this.returnToLobby();
      });
    }

    const btnShareRoom = document.getElementById('btn-share-room');
    if (btnShareRoom) {
      btnShareRoom.addEventListener('click', () => {
        const roomId = this.roomId || (inputRoom && inputRoom.value ? inputRoom.value.trim().toUpperCase() : 'BOLA1');
        this.mobileUX.shareRoom(roomId);
      });
    }

    // Auto-detect ?room=... from URL
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const roomParam = urlParams.get('room');
      if (roomParam) {
        const modeOnlineCard = document.getElementById('mode-online');
        if (modeOnlineCard) modeOnlineCard.click();
        const inputRoomEl = document.getElementById('input-room-code');
        if (inputRoomEl) inputRoomEl.value = roomParam.trim().toUpperCase();
      }
    } catch (e) {}

    // Keyboard Shortcuts (Space: Ready, Tab: Stats, Esc: Settings, M: Mute)
    window.addEventListener('keydown', (e) => {
      if (this.turnManager.phase === 'LOBBY') {
        return; // Jangan buka modal atau ubah state saat berada di halaman utama / lobby
      }
      if (e.code === 'Space') {
        this.toggleUserReady();
        e.preventDefault();
      } else if (e.code === 'Tab') {
        this.toggleStatsModal();
        e.preventDefault();
      } else if (e.code === 'Escape') {
        this.toggleSettingsModal();
        e.preventDefault();
      } else if (e.key === 'm' || e.key === 'M') {
        if (btnMute) btnMute.click();
      }
    });

    // Responsif Resize & Orientasi Layar
    window.addEventListener('resize', () => {
      this.setupCanvasDPI();
      this.setupPreviewCanvasDPI();
    });

    // Preview Canvas Wobble Interactive
    if (this.previewCanvas) {
      const wobblePreview = () => {
        if (this.previewChar && this.previewChar.spring) {
          this.previewChar.spring.applyImpact(Math.random() * Math.PI * 2, 70);
          this.soundFX.playBoing(1.3);
        }
      };
      this.previewCanvas.addEventListener('click', wobblePreview);
      this.previewCanvas.addEventListener('mouseenter', wobblePreview);
    }
  }

  renderCharacterSelectionGrid() {
    const grid = document.getElementById('char-selection-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const keys = Object.keys(CHARACTER_DEFS);

    keys.forEach(key => {
      const def = CHARACTER_DEFS[key];
      const item = document.createElement('div');
      item.className = `char-card-item ${key === this.userCharKey ? 'active' : ''}`;
      item.setAttribute('data-key', key);

      const sprite = spriteManager.getSprite(key, this.userTeam);

      item.innerHTML = `
        <div class="char-avatar-mini" style="border-color: ${def.accentColor}; font-size: 18px; display: flex; align-items: center; justify-content: center; overflow: hidden; padding: 0;">
          ${sprite ? `<canvas class="mini-coin-sprite" width="38" height="38" style="width:38px;height:38px;border-radius:50%;display:block;"></canvas>` : (def.symbol || '⚽')}
        </div>
        <div class="char-meta-mini">
          <span class="name">Koin ${def.name}</span>
          <span class="species">${def.iconName} (${def.role.split('/')[0]})</span>
        </div>
      `;

      if (sprite) {
        const miniCanvas = item.querySelector('.mini-coin-sprite');
        if (miniCanvas) {
          const mCtx = miniCanvas.getContext('2d');
          mCtx.drawImage(sprite, 0, 0, 38, 38);
        }
      }

      item.addEventListener('click', () => {
        document.querySelectorAll('.char-card-item').forEach(c => c.classList.remove('active'));
        item.classList.add('active');
        this.userCharKey = key;
        this.previewChar.setCharDef(key);
        this.updatePreviewCard();
        this.soundFX.playBoing(1.2);
      });

      grid.appendChild(item);
    });
  }

  updatePreviewCard() {
    const def = CHARACTER_DEFS[this.userCharKey];
    if (!def) return;

    const elName = document.getElementById('preview-char-name');
    const elRole = document.getElementById('preview-char-role');
    const elDesc = document.getElementById('preview-char-desc');
    const barSpeed = document.getElementById('bar-speed');
    const barSpring = document.getElementById('bar-spring');
    const barWeight = document.getElementById('bar-weight');

    if (elName) elName.textContent = `Koin ${def.name} (${def.symbol} ${def.iconName})`;
    if (elRole) elRole.textContent = def.role;
    if (elDesc) elDesc.textContent = def.desc;
    if (barSpeed) barSpeed.style.width = `${def.stats.speed}%`;
    if (barSpring) barSpring.style.width = `${def.stats.spring}%`;
    if (barWeight) barWeight.style.width = `${def.stats.weight}%`;
  }

  toggleStatsModal(force) {
    if (this.turnManager.phase === 'LOBBY') return;
    const modal = document.getElementById('stats-modal');
    if (!modal) return;
    const isHidden = modal.classList.contains('hidden');
    const show = force !== undefined ? force : isHidden;

    if (show) {
      this.updateStatsModalContent();
      modal.classList.remove('hidden');
    } else {
      modal.classList.add('hidden');
    }
  }

  updateStatsModalContent() {
    const redScore = document.getElementById('stat-score-red');
    const blueScore = document.getElementById('stat-score-blue');
    const metricShots = document.getElementById('metric-shots');
    const metricTackles = document.getElementById('metric-tackles');
    const metricPickups = document.getElementById('metric-pickups');
    const tbody = document.getElementById('stats-roster-tbody');

    if (redScore) redScore.textContent = this.scoreRed;
    if (blueScore) blueScore.textContent = this.scoreBlue;
    if (metricShots) metricShots.textContent = `${this.matchStats.shotsRed} - ${this.matchStats.shotsBlue}`;
    if (metricTackles) metricTackles.textContent = `${this.matchStats.tacklesRed} - ${this.matchStats.tacklesBlue}`;
    if (metricPickups) metricPickups.textContent = `${this.matchStats.pickups}`;

    if (tbody) {
      tbody.innerHTML = '';
      this.entities.forEach(char => {
        const tr = document.createElement('tr');
        if (char.isUser) tr.style.background = 'rgba(250, 204, 21, 0.15)';
        tr.innerHTML = `
          <td>#${char.number}</td>
          <td><strong>${char.def.name}</strong> ${char.isUser ? '⭐' : ''}</td>
          <td style="color: ${char.team === 'RED' ? '#F87171' : '#60A5FA'}">${char.team === 'RED' ? 'Merah' : 'Biru'}</td>
          <td>${char.def.role.split('/')[0]}</td>
          <td>${char.matchStats.goals}</td>
          <td>${char.matchStats.tackles}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  }

  toggleSettingsModal(force) {
    if (this.turnManager.phase === 'LOBBY') return;
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    const isHidden = modal.classList.contains('hidden');
    const show = force !== undefined ? force : isHidden;

    if (show) modal.classList.remove('hidden');
    else modal.classList.add('hidden');
  }

  selectCharacter(char) {
    if (this.gameMode === 'LOCAL_2P') {
      // Pada Pass & Play, user bebas memilih karakter dari tim yang sedang giliran
      this.entities.forEach(e => (e.isUser = false));
      char.isUser = true;
      this.activeUserChar = char;
      this.slingshot.setSelectedCharacter(char);
      this.updateActiveCharacterCard(char);
    } else {
      // Pada Solo / Online, user memilih karakter di timnya sendiri
      if (char.team !== this.userTeam) return;
      this.entities.forEach(e => {
        if (e.team === this.userTeam) e.isUser = false;
      });
      char.isUser = true;
      this.activeUserChar = char;
      this.slingshot.setSelectedCharacter(char);
      this.updateActiveCharacterCard(char);
    }
    this.updateRosterReadyDots();
  }

  onUserAim(char) {
    this.updateActiveCharacterCard(char);
    this.updateRosterReadyDots();
    if (this.gameMode === 'ONLINE' && this.network.connected) {
      this.network.sendAimUpdate(char.aimAngle, char.aimPower);
    }
  }

  toggleUserReady() {
    if (this.turnManager.phase !== 'PLANNING') return;

    this.soundFX.playBoing(1.2);
    this.soundFX.triggerHaptic(25);

    const btnReady = document.getElementById('btn-ready');

    if (this.gameMode === 'ONLINE_1V1') {
      // Pada Mode Online 1v1 Team: Pemain mengunci status ready untuk SEMUA 4 koin timnya
      const myTeamCoins = this.entities.filter(c => c.team === this.userTeam);
      const isAnyNotReady = myTeamCoins.some(c => !c.isReady);
      const newReadyState = isAnyNotReady;

      myTeamCoins.forEach(c => {
        c.isReady = newReadyState;
      });

      if (btnReady) {
        if (newReadyState) {
          btnReady.classList.add('ready-active');
          btnReady.innerHTML = '<span>LOCKED ✓</span>';
        } else {
          btnReady.classList.remove('ready-active');
          btnReady.innerHTML = '<span>READY ✓</span>';
        }
      }

      this.updateRosterReadyDots();

      const actions = myTeamCoins.map(c => ({
        charKey: c.charKey,
        angle: c.aimAngle,
        power: c.aimPower
      }));

      this.network.sendTeamActions(actions, newReadyState);
    } else if (this.gameMode === 'ONLINE') {
      this.activeUserChar.isReady = !this.activeUserChar.isReady;
      if (btnReady) {
        if (this.activeUserChar.isReady) {
          btnReady.classList.add('ready-active');
          btnReady.innerHTML = '<span>LOCKED ✓</span>';
        } else {
          btnReady.classList.remove('ready-active');
          btnReady.innerHTML = '<span>READY ✓</span>';
        }
      }
      this.network.sendReady(this.activeUserChar.isReady);
    } else {
      // Pada Solo Mode: Pemain mengunci status ready untuk SEMUA koin timnya!
      const myTeamCoins = this.entities.filter(c => c.team === this.userTeam);
      const isAnyNotReady = myTeamCoins.some(c => !c.isReady);
      const newReadyState = isAnyNotReady;

      this.entities.forEach(char => {
        if (char.team === this.userTeam) {
          char.isReady = newReadyState;
        } else {
          // Bot lawan otomatis ready saat pemain mengunci ready
          if (newReadyState) char.isReady = true;
        }
      });

      if (btnReady) {
        if (newReadyState) {
          btnReady.classList.add('ready-active');
          btnReady.innerHTML = '<span>LOCKED ✓</span>';
        } else {
          btnReady.classList.remove('ready-active');
          btnReady.innerHTML = '<span>READY ✓</span>';
        }
      }

      this.updateRosterReadyDots();
      this.checkAllReady();
    }
  }

  checkAllReady() {
    const allReady = this.entities.every(e => e.isReady);
    if (allReady && this.turnManager.phase === 'PLANNING') {
      this.executeTurn();
    }
  }

  executeTurn() {
    this.turnManager.startResolution(3.8);
    this.soundFX.playWhistle();

    // Luncurkan seluruh 8 karakter secara serentak
    this.entities.forEach(char => {
      if (char.aimPower > 0) {
        // Skala percepatan kuadratik dinamis: makin jauh panah ditarik, kecepatan melesat semakin dahsyat!
        const maxPower = 180;
        const powerRatio = Math.min(char.aimPower / maxPower, 1.0);
        // Boost dinamis hingga +90% saat tarikan maksimal
        let dynamicBoost = 1.0 + powerRatio * 0.90;
        // Pertimbangkan stat kecepatan karakter jika ada
        const charSpeedMult = (char.def && char.def.stats && char.def.stats.speed) ? (char.def.stats.speed / 80) : 1.0;

        // EFEK BUFF: NITRO_SPEED (More Speed +75%)
        if (char.activeBuff && char.activeBuff.id === 'NITRO_SPEED') {
          dynamicBoost *= 1.75;
          this.physics.addCallout(char.x, char.y - 25, '⚡ NITRO ROCKET BOOST! 🚀', '#F59E0B');
        }

        // EFEK BUFF: SPAWN_OBSTACLE (Pasang Rintangan Bumper di Lapangan)
        if (char.activeBuff && char.activeBuff.id === 'SPAWN_OBSTACLE') {
          this.physics.buffManager.deployObstacle(char, (x, y, text, color) => this.physics.addCallout(x, y, text, color));
        }

        // Pengurangan maxspeed 20% (multiplier 3.68 dari sebelumnya 4.6)
        const speed = char.aimPower * 3.68 * dynamicBoost * charSpeedMult;
        char.vx = Math.cos(char.aimAngle) * speed;
        char.vy = Math.sin(char.aimAngle) * speed;

        // Reaksi pegas bobblehead berguncang lebih hebat saat tembakan kencang
        if (char.spring) char.spring.applyImpact(char.aimAngle, speed * 0.45);
        if (this.soundFX) this.soundFX.playKick(0.7 + powerRatio * 0.8);

        if (char.team === 'RED') this.matchStats.shotsRed++;
        else this.matchStats.shotsBlue++;
      }
      char.isAiming = false;
      char.aimPower = 0;
      char.isReady = false;
    });

    const btnReady = document.getElementById('btn-ready');
    if (btnReady) {
      btnReady.classList.remove('ready-active');
      btnReady.disabled = true;
      btnReady.innerHTML = '<span>ACTION!</span>';
    }
  }

  aiPlanTurn() {
    if (this.gameMode === 'ONLINE' || this.gameMode === 'ONLINE_1V1') return;

    this.entities.forEach(char => {
      // Pada mode SOLO: Pemain mengarahkan SEMUA panah koin timnya sendiri!
      // AI bot HANYA mengontrol dan mengarahkan koin tim lawan!
      if (this.gameMode === 'SOLO') {
        if (char.team === this.userTeam) return;
      } else if (this.gameMode === 'ONLINE') {
        if (char.isUser) return;
        const isHuman = this.onlineRoomPlayers.some(p => p.charKey === char.charKey && p.team === char.team);
        if (isHuman) return;
      } else {
        if (char.isUser) return;
      }

      const targetGoalX = char.team === 'RED' ? 960 : 0;
      const targetGoalY = 270;

      const dx = this.ball.x - char.x;
      const dy = this.ball.y - char.y;

      let aimAngle = Math.atan2(dy, dx);
      let aimPower = 70 + Math.random() * 45;

      // Striker (Ziggy & Kiki): Bidik sudut gawang melalui bola dengan kekuatan tinggi
      if (char.def.id === 'kiki' || char.def.id === 'ziggy') {
        const ballToGoalAngle = Math.atan2(targetGoalY - this.ball.y, targetGoalX - this.ball.x);
        aimAngle = (aimAngle * 0.35) + (ballToGoalAngle * 0.65);
        aimPower = 125 + Math.random() * 45; // Tembakan roket terarah
      }
      // Bek (Rocco & Boris & Ollie): Jaga gawang dengan clearance terukur
      else if (char.def.id === 'rocco' || char.def.id === 'boris' || char.def.id === 'ollie') {
        const ownGoalX = char.team === 'RED' ? 40 : 920;
        const targetX = (this.ball.x + ownGoalX) / 2;
        aimAngle = Math.atan2(this.ball.y - char.y, targetX - char.x);
        aimPower = 65 + Math.random() * 40;
      }

      char.aimAngle = aimAngle;
      char.aimPower = aimPower;
      char.isAiming = false; // Bot tidak menggambar panah di layar - hanya player yang mengarahkan

      // Bot mengunci status ready
      if (this.turnManager.planningTimer < 8.5 - Math.random() * 3) {
        char.isReady = true;
      }
    });

    this.checkAllReady();
  }

  handleGoal(scoringTeam) {
    if (this.turnManager.phase === 'GOAL' || this.turnManager.phase === 'GAMEOVER') return;

    this.turnManager.setGoalPhase();
    this.cameraShake = 18;
    this.soundFX.playGoalHorn();
    this.soundFX.triggerHaptic('goal');

    if (scoringTeam === 'RED') {
      this.scoreRed++;
      this.matchStats.shotsRed++;
    } else {
      this.scoreBlue++;
      this.matchStats.shotsBlue++;
    }
    this.updateScoreUI();

    // Trigger animasi selebrasi karakter di lapangan
    this.entities.forEach(char => {
      if (char.team === scoringTeam) {
        char.triggerGoalJoy();
      }
    });

    // Callout mengambang langsung di atas gawang pencetak gol
    const calloutX = scoringTeam === 'RED' ? this.physics.rinkRight : this.physics.rinkLeft;
    this.physics.addCallout(calloutX, this.physics.height / 2 - 20, '⚽ GOOOAAAL! ⚽', scoringTeam === 'RED' ? '#EF4444' : '#3B82F6');

    // Partikel Konfeti Emas & Tim dari area gawang
    for (let i = 0; i < 90; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 100 + Math.random() * 280;
      this.confetti.push({
        x: scoringTeam === 'RED' ? this.physics.rinkRight : this.physics.rinkLeft,
        y: this.physics.height / 2,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: ['#EF4444', '#3B82F6', '#FACC15', '#10B981', '#F472B6'][Math.floor(Math.random() * 5)],
        size: 5 + Math.random() * 6,
        life: 2.4
      });
    }

    if (this.gameMode === 'ONLINE') {
      this.network.syncGoal(scoringTeam);
    }

    // DELAY NOTIFIKASI GOAL BANNER (1200ms) agar pemain dapat melihat bola masuk & memantul di jaring gawang
    if (this.goalBannerTimeout) {
      clearTimeout(this.goalBannerTimeout);
      this.goalBannerTimeout = null;
    }
    this.goalBannerTimeout = setTimeout(() => {
      this.goalBannerTimeout = null;
      if (this.turnManager.phase === 'LOBBY' || this.turnManager.phase === 'GAMEOVER') return;

      const banner = document.getElementById('goal-banner');
      const bannerTeam = document.getElementById('goal-team');
      if (banner && bannerTeam) {
        bannerTeam.textContent = scoringTeam === 'RED' ? 'TIM MERAH (THE STRIKERS) MENCETAK GOL!' : 'TIM BIRU (THE ROVERS) MENCETAK GOL!';
        bannerTeam.style.color = scoringTeam === 'RED' ? '#EF4444' : '#3B82F6';
        banner.classList.remove('hidden');
      }
    }, 1200);

    // Cek Kondisi Kemenangan & Reset Formasi setelah selebrasi
    if (this.goalTimeout) {
      clearTimeout(this.goalTimeout);
      this.goalTimeout = null;
    }
    this.goalTimeout = setTimeout(() => {
      this.goalTimeout = null;
      if (this.turnManager.phase === 'LOBBY' || this.turnManager.phase === 'GAMEOVER') {
        return;
      }
      const res = this.turnManager.checkTurnProgression(this.scoreRed, this.scoreBlue, this.targetScore);
      if (res.status === 'GAMEOVER') {
        this.endMatch(res.winner);
      } else if (res.status === 'SUDDEN_DEATH') {
        this.triggerSuddenDeath();
      } else {
        this.resetFormation();
      }
    }, 3200);
  }

  triggerSuddenDeath() {
    const banner = document.getElementById('goal-banner');
    if (banner) banner.classList.add('hidden');

    const sdBanner = document.getElementById('sudden-death-banner');
    const sdPill = document.getElementById('sudden-death-pill');
    if (sdBanner) sdBanner.classList.remove('hidden');
    if (sdPill) sdPill.classList.remove('hidden');

    this.soundFX.playSuddenDeath();
    this.targetScore = Math.max(this.scoreRed, this.scoreBlue) + 1;
    this.resetFormation(false);
  }

  resetFormation(startPlanning = true) {
    const banner = document.getElementById('goal-banner');
    if (banner) banner.classList.add('hidden');

    this.ball.reset(this.VIRTUAL_WIDTH / 2, this.VIRTUAL_HEIGHT / 2);
    if (this.physics && this.physics.buffManager) {
      this.physics.buffManager.resetOnGoal();
    }

    const redPositions = [
      { x: 140, y: 270 },
      { x: 410, y: 270 },
      { x: 270, y: 155 },
      { x: 270, y: 385 }
    ];

    const bluePositions = [
      { x: 550, y: 270 },
      { x: 690, y: 155 },
      { x: 690, y: 385 },
      { x: 820, y: 270 }
    ];

    let rIdx = 0;
    let bIdx = 0;
    this.entities.forEach(char => {
      if (char.team === 'RED') {
        char.x = redPositions[rIdx].x;
        char.y = redPositions[rIdx].y;
        rIdx++;
      } else {
        char.x = bluePositions[bIdx].x;
        char.y = bluePositions[bIdx].y;
        bIdx++;
      }
      char.vx = 0;
      char.vy = 0;
      char.aimPower = 0;
      char.isAiming = false;
      char.isReady = false;
      char.spring.reset();
    });

    if (startPlanning) {
      this.turnManager.startPlanning();
    }
  }

  endMatch(winningTeam) {
    this.turnManager.setGameOver();
    const endModal = document.getElementById('match-end-modal');
    const winnerText = document.getElementById('winner-title');
    const mvpText = document.getElementById('mvp-name');

    if (endModal && winnerText && mvpText) {
      winnerText.textContent = winningTeam === 'RED' ? '🏆 TIM MERAH (THE STRIKERS) JUARA!' : '🏆 TIM BIRU (THE ROVERS) JUARA!';
      winnerText.style.color = winningTeam === 'RED' ? '#EF4444' : '#3B82F6';

      // Hitung MVP & Catat Hasil Pertandingan ke Mobile Profile
      const mvp = this.entities.reduce((best, curr) => (curr.matchStats.goals > best.matchStats.goals ? curr : best), this.entities[0]);
      mvpText.textContent = `MVP Pertandingan: ${mvp.def.name} (#${mvp.number}) - ${mvp.matchStats.goals} Gol`;
      endModal.classList.remove('hidden');

      const isWin = winningTeam === this.userTeam;
      const userChar = this.entities.find(e => e.isUser);
      const userGoals = userChar ? userChar.matchStats.goals : 0;
      const buffsTaken = this.entities.reduce((sum, c) => sum + (c.team === this.userTeam ? (c.matchStats?.pickups || 0) : 0), 0);

      this.mobileUX.recordMatchResult({
        isWin,
        goalsScored: userGoals,
        buffsTaken
      });

      if (isWin) {
        this.soundFX.triggerHaptic('goal');
      }
    }
  }

  resetMatch() {
    if (this.goalTimeout) {
      clearTimeout(this.goalTimeout);
      this.goalTimeout = null;
    }
    if (this.goalBannerTimeout) {
      clearTimeout(this.goalBannerTimeout);
      this.goalBannerTimeout = null;
    }
    const banner = document.getElementById('goal-banner');
    if (banner) banner.classList.add('hidden');
    const endModal = document.getElementById('match-end-modal');
    if (endModal) endModal.classList.add('hidden');
    const sdPill = document.getElementById('sudden-death-pill');
    if (sdPill) sdPill.classList.add('hidden');

    this.scoreRed = 0;
    this.scoreBlue = 0;
    this.matchStats = { shotsRed: 0, shotsBlue: 0, tacklesRed: 0, tacklesBlue: 0, pickups: 0 };
    this.turnManager.reset();
    this.updateScoreUI();
    this.initCharacters();
    this.resetFormation();
    if (this.physics && this.physics.buffManager) {
      this.physics.buffManager.resetOnGoal();
    }
  }

  returnToLobby() {
    // 0. Bersihkan goal timeout jika ada yang sedang berjalan
    if (this.goalTimeout) {
      clearTimeout(this.goalTimeout);
      this.goalTimeout = null;
    }
    if (this.goalBannerTimeout) {
      clearTimeout(this.goalBannerTimeout);
      this.goalBannerTimeout = null;
    }

    // 1. Hentikan Turn Manager & Timer Loop
    this.turnManager.setLobby();
    this.slingshot.setLock(true);
    this.confetti = [];
    this.cameraShake = 0;

    // 2. Sembunyikan seluruh modal, overlay screen, dan banner pertandingan
    const lobbyScreen = document.getElementById('lobby-screen');
    const charSelectScreen = document.getElementById('character-select-screen');
    const statsModal = document.getElementById('stats-modal');
    const settingsModal = document.getElementById('settings-modal');
    const endModal = document.getElementById('match-end-modal');
    const goalBanner = document.getElementById('goal-banner');
    const sdBanner = document.getElementById('sudden-death-banner');
    const sdPill = document.getElementById('sudden-death-pill');

    if (statsModal) statsModal.classList.add('hidden');
    if (settingsModal) settingsModal.classList.add('hidden');
    if (endModal) endModal.classList.add('hidden');
    if (goalBanner) goalBanner.classList.add('hidden');
    if (sdBanner) sdBanner.classList.add('hidden');
    if (sdPill) sdPill.classList.add('hidden');
    if (charSelectScreen) charSelectScreen.classList.add('hidden');
    const onlineRoomScreen = document.getElementById('online-room-screen');
    if (onlineRoomScreen) onlineRoomScreen.classList.add('hidden');
    this.onlineRoomPlayers = [];
    this.isUserReadyInRoom = false;
    if (this.network) this.network.leaveRoom();

    // Tampilkan Layar Utama (Lobby)
    if (lobbyScreen) lobbyScreen.classList.remove('hidden');

    // 3. Reset Skor & Statistik Pertandingan
    this.scoreRed = 0;
    this.scoreBlue = 0;
    this.matchStats = { shotsRed: 0, shotsBlue: 0, tacklesRed: 0, tacklesBlue: 0, pickups: 0 };
    this.updateScoreUI();

    // 4. Reset Formasi Karakter, Bola, dan Item Buff
    this.resetFormation(false);
    if (this.physics && this.physics.buffManager) {
      this.physics.buffManager.resetOnGoal();
    }

    // 5. Bersihkan status bidikan & efek buff pada semua koin
    this.entities.forEach(char => {
      char.vx = 0;
      char.vy = 0;
      char.aimPower = 0;
      char.isAiming = false;
      char.isReady = false;
      char.pendingBuff = null;
      char.activeBuff = null;
      char.buffTurnsRemaining = 0;
      if (char.spring) char.spring.reset();
    });

    // 6. Reset Tampilan UI Tombol Ready & Timer Bar
    const btnReady = document.getElementById('btn-ready');
    if (btnReady) {
      btnReady.disabled = false;
      btnReady.classList.remove('ready-active');
      btnReady.innerHTML = '<span>READY ✓</span>';
    }

    const timerSeconds = document.getElementById('timer-seconds');
    const timerBar = document.getElementById('timer-bar-fill');
    if (timerSeconds) timerSeconds.textContent = '12s';
    if (timerBar) timerBar.style.width = '100%';

    const hudTitle = document.getElementById('hud-match-title');
    if (hudTitle) hudTitle.textContent = '⚡ BOLABOLA LEAGUE';

    const turnCounter = document.getElementById('turn-counter');
    if (turnCounter) turnCounter.textContent = '1 / 90 TURNS';

    // 7. Jika dalam mode Online, putuskan koneksi WebSocket
    if (this.gameMode === 'ONLINE' && this.network.connected) {
      this.network.disconnect();
      const btnShare = document.getElementById('btn-share-room');
      if (btnShare) btnShare.classList.add('hidden');
    }

    this.soundFX.playBoing(0.9);
  }

  onPhaseChange(phase) {
    const btnReady = document.getElementById('btn-ready');
    if (phase === 'PLANNING') {
      if (btnReady) {
        btnReady.disabled = false;
        btnReady.classList.remove('ready-active');
        btnReady.innerHTML = '<span>READY ✓</span>';
      }
      this.slingshot.setLock(false);
    } else {
      this.slingshot.setLock(true);
    }
  }

  onTurnChange(turn, max) {
    const elTurn = document.getElementById('turn-counter');
    if (elTurn) elTurn.textContent = `${turn} / ${max} TURNS`;
  }

  update(dt) {
    // Jika sedang di lobby screen, jangan jalankan simulasi pertandingan
    if (this.turnManager.phase === 'LOBBY') {
      if (this.previewChar) {
        this.previewChar.update(dt);
      }
      return;
    }

    // 1. Update Turn State Machine
    const stepResult = this.turnManager.update(dt, () => {
      this.soundFX.playTick();
    });

    if (stepResult === 'TIMEOUT' && this.turnManager.phase === 'PLANNING') {
      this.executeTurn();
    } else if (stepResult === 'RESOLUTION_END' && this.turnManager.phase === 'RESOLUTION') {
      this.checkResolutionFinish();
    }

    if (this.turnManager.phase === 'PLANNING' && this.gameMode !== 'ONLINE') {
      this.aiPlanTurn();
    } else if (this.turnManager.phase === 'RESOLUTION' || this.turnManager.phase === 'GOAL') {
      this.physics.update(dt, this.entities, this.ball, (team) => this.handleGoal(team));

      // Jika semua benda berhenti lebih awal (setelah minimal 0.8s animasi berlangsung)
      const resElapsed = this.turnManager.resolutionDuration - this.turnManager.resolutionTimer;
      if (this.turnManager.phase === 'RESOLUTION' && resElapsed > 0.8 && this.physics.isAtRest(this.entities, this.ball)) {
        this.checkResolutionFinish();
      }
    }

    // 2. Update Entitas
    this.entities.forEach(char => char.update(dt));
    this.ball.update(dt);

    // 3. Update Preview Canvas di menu pemilihan
    if (this.previewChar) {
      this.previewChar.update(dt);
    }

    // 4. Update Partikel Konfeti
    for (let i = this.confetti.length - 1; i >= 0; i--) {
      const p = this.confetti[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
      p.life -= dt;
      if (p.life <= 0) this.confetti.splice(i, 1);
    }

    // 5. Redam Goyangan Kamera
    if (this.cameraShake > 0) {
      this.cameraShake = Math.max(0, this.cameraShake - dt * 25);
    }
  }

  checkResolutionFinish() {
    const res = this.turnManager.checkTurnProgression(this.scoreRed, this.scoreBlue, this.targetScore);
    if (res.status === 'GAMEOVER') {
      this.endMatch(res.winner);
    } else if (res.status === 'SUDDEN_DEATH') {
      this.triggerSuddenDeath();
    } else {
      // Turn berhasil berganti ke turn berikutnya!
      // Aktifkan pending buff menjadi active buff & spawn 1 buff baru jika lapangan kosong!
      if (this.physics && this.physics.buffManager) {
        this.physics.buffManager.onTurnAdvanced(
          this.turnManager.turn,
          this.entities,
          this.ball,
          (x, y, text, color) => this.physics.addCallout(x, y, text, color)
        );
      }
    }
  }

  render() {
    this.ctx.clearRect(0, 0, this.VIRTUAL_WIDTH, this.VIRTUAL_HEIGHT);

    this.ctx.save();
    if (this.cameraShake > 0) {
      const sx = (Math.random() - 0.5) * this.cameraShake;
      const sy = (Math.random() - 0.5) * this.cameraShake;
      this.ctx.translate(sx, sy);
    }

    // 1. Gambar Lapangan Meja Stadium & Bumper
    this.physics.render(this.ctx);

    // 2. Gambar Panah Bidikan (Semua koin tim pemain yang telah diarahkan)
    this.entities.forEach(char => {
      if (this.turnManager.phase === 'PLANNING') {
        if (char.isAiming && char.aimPower >= 10) {
          if (char.team === this.userTeam || this.gameMode === 'LOCAL_2P') {
            char.renderAimArrow(this.ctx, this.physics.getBounds());
          }
        }
      }
    });

    // 3. Gambar Bola Sepak
    this.ball.render(this.ctx);

    // 4. Gambar Karakter Bobblehead (Depth Sorting berdasarkan koordinat Y)
    const sorted = [...this.entities].sort((a, b) => a.y - b.y);
    sorted.forEach(char => char.render(this.ctx));

    // 5. Gambar Partikel Konfeti
    this.confetti.forEach(p => {
      this.ctx.fillStyle = p.color;
      this.ctx.fillRect(p.x, p.y, p.size, p.size);
    });

    // 5.1 Gambar Floating Mobile Reaction Emotes
    if (this.mobileUX) {
      this.mobileUX.updateAndRenderEmotes(this.ctx, performance.now());
    }

    this.ctx.restore();

    // 6. Gambar Live Preview Canvas Karakter
    this.renderPreviewCanvas();
  }

  renderPreviewCanvas() {
    if (!this.previewCtx || !this.previewCanvas) return;
    this.previewCtx.clearRect(0, 0, 130, 130);
    this.previewChar.x = 65;
    this.previewChar.y = 65;
    this.previewChar.render(this.previewCtx);
  }

  loop(currentTime) {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    this.update(dt);
    this.render();

    requestAnimationFrame((t) => this.loop(t));
  }

  // === HUD & DOM HELPERS ===
  updateScoreUI() {
    const elRed = document.getElementById('score-red');
    const elBlue = document.getElementById('score-blue');
    if (elRed) elRed.textContent = this.scoreRed;
    if (elBlue) elBlue.textContent = this.scoreBlue;
  }

  updateTimerBar(timer, dur) {
    const timerFill = document.getElementById('timer-bar-fill');
    const timerSec = document.getElementById('timer-seconds');
    if (timerFill && timerSec) {
      const pct = Math.max(0, (timer / dur) * 100);
      timerFill.style.width = `${pct}%`;
      timerSec.textContent = `${Math.ceil(timer)}s`;
    }
    this.updateRosterReadyDots();
  }

  updateRosterReadyDots() {
    this.entities.forEach(char => {
      const dot = document.getElementById(`dot-${char.def.id}`);
      if (dot) {
        if (char.isReady || (char.aimPower >= 10 && char.team === this.userTeam)) {
          dot.classList.add('ready');
        } else {
          dot.classList.remove('ready');
        }
      }
    });
  }

  updateActiveCharacterCard(char) {
    const nameEl = document.getElementById('active-char-name');
    const roleEl = document.getElementById('active-char-role');
    const buffEl = document.getElementById('active-char-buff');
    if (nameEl) nameEl.textContent = `${char.def.name} #${char.number}`;
    if (roleEl) roleEl.textContent = `(${char.def.role.split('/')[0]})`;

    if (buffEl) {
      if (char.activeBuff) {
        buffEl.textContent = `${char.activeBuff.icon} ${char.activeBuff.name}`;
        buffEl.style.backgroundColor = char.activeBuff.color;
        buffEl.classList.remove('hidden');
      } else if (char.pendingBuff) {
        buffEl.textContent = `⏳ Next: ${char.pendingBuff.icon} ${char.pendingBuff.name}`;
        buffEl.style.backgroundColor = 'rgba(71, 85, 105, 0.9)';
        buffEl.classList.remove('hidden');
      } else {
        buffEl.classList.add('hidden');
      }
    }
  }

  // === NETWORK MESSAGE HANDLER ===
  handleNetworkMessage(data) {
    switch (data.type) {
      case 'ROOM_JOINED': {
        console.log(`Berhasil bergabung ke room: ${data.roomId} (${data.matchType || 'PARTY'})`);
        this.roomId = data.roomId;
        this.playerId = data.playerId;
        this.hostId = data.hostId;
        this.roomMatchType = data.matchType || (this.gameMode === 'ONLINE_1V1' ? '1V1' : 'PARTY');
        if (this.roomMatchType === '1V1') {
          this.gameMode = 'ONLINE_1V1';
          this.turnManager.setMode('ONLINE_1V1');
        } else {
          this.gameMode = 'ONLINE';
          this.turnManager.setMode('ONLINE');
        }
        this.onlineRoomPlayers = data.players || [];
        this.isUserReadyInRoom = false;

        const lobbyScreen = document.getElementById('lobby-screen');
        const charSelectScreen = document.getElementById('character-select-screen');
        const onlineRoomScreen = document.getElementById('online-room-screen');
        if (lobbyScreen) lobbyScreen.classList.add('hidden');
        if (charSelectScreen) charSelectScreen.classList.add('hidden');
        if (onlineRoomScreen) onlineRoomScreen.classList.remove('hidden');

        const hudTitle = document.getElementById('hud-match-title');
        if (hudTitle) hudTitle.textContent = `⚡ ROOM: ${data.roomId}`;
        const btnShare = document.getElementById('btn-share-room');
        if (btnShare) btnShare.classList.remove('hidden');

        this.renderRoomLobby();
        this.soundFX.playBoing(1.3);
        break;
      }

      case 'ROOM_PLAYERS_UPDATE':
      case 'PLAYER_READY_STATUS':
      case 'PLAYER_DISCONNECTED': {
        if (data.hostId) this.hostId = data.hostId;
        if (data.matchType) this.roomMatchType = data.matchType;
        this.onlineRoomPlayers = data.players || [];
        this.renderRoomLobby();
        break;
      }

      case 'MATCH_STARTED': {
        const roomScreen = document.getElementById('online-room-screen');
        if (roomScreen) roomScreen.classList.add('hidden');

        const hudTitle = document.getElementById('hud-match-title');
        if (hudTitle) hudTitle.textContent = `⚡ ROOM: ${this.roomId}`;
        const btnShare = document.getElementById('btn-share-room');
        if (btnShare) btnShare.classList.remove('hidden');

        if (data.players) {
          this.onlineRoomPlayers = data.players;
        }

        this.resetMatch();
        this.soundFX.playWhistle();
        break;
      }

      case 'TEAM_AIM_UPDATE':
        // Update bidikan rekan setim yang dikirim via WebSocket
        this.entities.forEach(char => {
          if (char.charKey === data.charKey) {
            char.aimAngle = data.angle;
            char.aimPower = data.power;
            char.isAiming = true;
          }
        });
        break;

      case 'START_RESOLUTION':
        // Terima paket aksi simultan dari server dan luncurkan serentak
        if (data.actions) {
          data.actions.forEach(act => {
            const char = this.entities.find(e => e.charKey === act.charKey);
            if (char) {
              char.aimAngle = act.angle;
              char.aimPower = act.power;
            }
          });
        }
        this.executeTurn();
        break;

      case 'GOAL_SCORED':
        this.scoreRed = data.scoreRed;
        this.scoreBlue = data.scoreBlue;
        this.updateScoreUI();
        break;

      case 'EMOTE':
        if (this.mobileUX) {
          this.mobileUX.triggerEmote(data.emoji, { x: data.x, y: data.y });
        }
        break;
    }
  }

  renderRoomLobby() {
    const screen = document.getElementById('online-room-screen');
    if (!screen || screen.classList.contains('hidden')) return;

    const codeDisplay = document.getElementById('room-code-display');
    const playerCount = document.getElementById('room-player-count');
    const statusPill = document.getElementById('room-status-pill');
    const btnStart = document.getElementById('btn-room-start');
    const btnReady = document.getElementById('btn-room-ready');
    const btnJoinRed = document.getElementById('btn-room-join-red');
    const btnJoinBlue = document.getElementById('btn-room-join-blue');
    const redSlots = document.getElementById('room-red-slots');
    const blueSlots = document.getElementById('room-blue-slots');
    const charRow = document.getElementById('room-char-selection-row');
    const selectedCharName = document.getElementById('room-selected-char-name');

    const is1v1 = (this.gameMode === 'ONLINE_1V1') || (this.roomMatchType === '1V1');

    if (codeDisplay) codeDisplay.textContent = this.roomId || 'BOLA1';
    if (playerCount) {
      playerCount.textContent = is1v1
        ? `${this.onlineRoomPlayers.length} / 2 Kapten Tim`
        : `${this.onlineRoomPlayers.length} / 8 Pemain`;
    }

    const myInfo = this.onlineRoomPlayers.find(p => p.id === this.playerId);
    const isHost = (this.playerId === this.hostId) || (myInfo && myInfo.isHost) || (this.onlineRoomPlayers.length > 0 && this.onlineRoomPlayers[0].id === this.playerId);

    const redPlayers = this.onlineRoomPlayers.filter(p => p.team === 'RED');
    const bluePlayers = this.onlineRoomPlayers.filter(p => p.team === 'BLUE');

    if (statusPill) {
      if (is1v1) {
        if (redPlayers.length >= 1 && bluePlayers.length >= 1) {
          statusPill.textContent = 'Duel 1v1 Siap Dimulai!';
          statusPill.style.color = '#34D399';
          statusPill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        } else {
          statusPill.textContent = 'Menunggu Lawan (Pilih Tim Berbeda)...';
          statusPill.style.color = '#FBBF24';
          statusPill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        }
      } else {
        if (this.onlineRoomPlayers.length >= 2) {
          statusPill.textContent = 'Siap Memulai Pertandingan!';
          statusPill.style.color = '#34D399';
          statusPill.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        } else {
          statusPill.textContent = 'Menunggu Pemain Lain...';
          statusPill.style.color = '#FBBF24';
          statusPill.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        }
      }
    }

    if (btnStart) {
      if (isHost) {
        btnStart.disabled = false;
        btnStart.textContent = 'MULAI PERTANDINGAN ⚽';
        btnStart.style.opacity = '1';
        btnStart.style.cursor = 'pointer';
      } else {
        btnStart.disabled = true;
        btnStart.textContent = 'MENUNGGU HOST MEMULAI...';
        btnStart.style.opacity = '0.6';
        btnStart.style.cursor = 'not-allowed';
      }
    }

    if (btnReady) {
      if (this.isUserReadyInRoom) {
        btnReady.classList.add('active');
        btnReady.textContent = 'LOCKED ✓';
      } else {
        btnReady.classList.remove('active');
        btnReady.textContent = 'READY ✓';
      }
    }

    if (btnJoinRed) btnJoinRed.classList.toggle('active', this.userTeam === 'RED');
    if (btnJoinBlue) btnJoinBlue.classList.toggle('active', this.userTeam === 'BLUE');

    // Render Slots Tim Merah
    if (redSlots) {
      redSlots.innerHTML = '';
      const maxSlots = is1v1 ? 1 : 4;
      for (let i = 0; i < maxSlots; i++) {
        const p = redPlayers[i];
        const slotEl = document.createElement('div');
        if (p) {
          const isMe = p.id === this.playerId;
          const charDef = CHARACTER_DEFS[p.charKey] || CHARACTER_DEFS.ZIGGY;
          const sprite = spriteManager.getSprite(p.charKey, 'RED');
          slotEl.className = `room-slot-item occupied ${isMe ? 'is-me' : ''}`;
          slotEl.innerHTML = `
            <div class="room-slot-avatar" style="border: 2px solid ${charDef.accentColor}">
              ${sprite ? `<canvas class="slot-canvas-sprite" width="28" height="28" style="width:28px;height:28px;border-radius:50%;display:block;"></canvas>` : (charDef.symbol || '⚽')}
            </div>
            <div class="room-slot-details">
              <span class="room-slot-name">${p.name} ${isMe ? '<small style="color:#facc15">(Kamu)</small>' : ''} ${p.isHost ? '<small style="color:#38bdf8">[Host]</small>' : ''}</span>
              <span class="room-slot-char">${is1v1 ? '⭐ Kapten Tim Merah (4 Koin)' : `${charDef.name} (${charDef.role.split('/')[0]})`}</span>
            </div>
            <span class="room-slot-badge ${p.isReady ? 'ready' : 'waiting'}">${p.isReady ? 'READY ✓' : 'MEMILIH'}</span>
          `;
          if (sprite) {
            const sc = slotEl.querySelector('.slot-canvas-sprite');
            if (sc) sc.getContext('2d').drawImage(sprite, 0, 0, 28, 28);
          }
        } else {
          slotEl.className = 'room-slot-item empty';
          slotEl.innerHTML = `<span>${is1v1 ? 'Slot Kapten Merah Kosong' : `Slot ${i + 1}: Bot Standby 🤖`}</span>`;
        }
        redSlots.appendChild(slotEl);
      }
    }

    // Render Slots Tim Biru
    if (blueSlots) {
      blueSlots.innerHTML = '';
      const maxSlots = is1v1 ? 1 : 4;
      for (let i = 0; i < maxSlots; i++) {
        const p = bluePlayers[i];
        const slotEl = document.createElement('div');
        if (p) {
          const isMe = p.id === this.playerId;
          const charDef = CHARACTER_DEFS[p.charKey] || CHARACTER_DEFS.KIKI;
          const sprite = spriteManager.getSprite(p.charKey, 'BLUE');
          slotEl.className = `room-slot-item occupied ${isMe ? 'is-me' : ''}`;
          slotEl.innerHTML = `
            <div class="room-slot-avatar" style="border: 2px solid ${charDef.accentColor}">
              ${sprite ? `<canvas class="slot-canvas-sprite" width="28" height="28" style="width:28px;height:28px;border-radius:50%;display:block;"></canvas>` : (charDef.symbol || '⚽')}
            </div>
            <div class="room-slot-details">
              <span class="room-slot-name">${p.name} ${isMe ? '<small style="color:#facc15">(Kamu)</small>' : ''} ${p.isHost ? '<small style="color:#38bdf8">[Host]</small>' : ''}</span>
              <span class="room-slot-char">${is1v1 ? '⭐ Kapten Tim Biru (4 Koin)' : `${charDef.name} (${charDef.role.split('/')[0]})`}</span>
            </div>
            <span class="room-slot-badge ${p.isReady ? 'ready' : 'waiting'}">${p.isReady ? 'READY ✓' : 'MEMILIH'}</span>
          `;
          if (sprite) {
            const sc = slotEl.querySelector('.slot-canvas-sprite');
            if (sc) sc.getContext('2d').drawImage(sprite, 0, 0, 28, 28);
          }
        } else {
          slotEl.className = 'room-slot-item empty';
          slotEl.innerHTML = `<span>${is1v1 ? 'Slot Kapten Biru Kosong' : `Slot ${i + 1}: Bot Standby 🤖`}</span>`;
        }
        blueSlots.appendChild(slotEl);
      }
    }

    // Render 8 Character Chips
    if (charRow) {
      charRow.innerHTML = '';
      if (is1v1) {
        charRow.innerHTML = `
          <div class="room-1v1-banner" style="font-size:11px; color:#38bdf8; padding:6px 12px; background:rgba(56,189,248,0.1); border-radius:8px; border:1px solid rgba(56,189,248,0.25); text-align:center; width:100%;">
            ⚡ <strong>Mode 1v1 Team Duel:</strong> Anda memegang kendali penuh atas seluruh 4 koin di tim Anda secara simultan!
          </div>
        `;
      } else {
        const teamTakenKeys = this.onlineRoomPlayers
          .filter(p => p.team === this.userTeam && p.id !== this.playerId)
          .map(p => p.charKey);

        Object.keys(CHARACTER_DEFS).forEach(key => {
          const def = CHARACTER_DEFS[key];
          const isTaken = teamTakenKeys.includes(key);
          const isSelected = key === this.userCharKey;
          const chip = document.createElement('div');
          chip.className = `room-char-chip ${isSelected ? 'active' : ''} ${isTaken ? 'disabled' : ''}`;
          if (isTaken) {
            chip.style.opacity = '0.4';
            chip.style.cursor = 'not-allowed';
            chip.title = 'Koin ini sudah dipilih rekan tim';
          }
          const sprite = spriteManager.getSprite(key, this.userTeam);

          chip.innerHTML = `
            <div class="room-chip-avatar" style="border: 1.5px solid ${def.accentColor}">
              ${sprite ? `<canvas class="chip-canvas-sprite" width="26" height="26" style="width:26px;height:26px;border-radius:50%;display:block;"></canvas>` : (def.symbol || '⚽')}
            </div>
            <span class="room-chip-name">${def.name}</span>
          `;
          if (sprite) {
            const cc = chip.querySelector('.chip-canvas-sprite');
            if (cc) cc.getContext('2d').drawImage(sprite, 0, 0, 26, 26);
          }

          chip.addEventListener('click', () => {
            if (isTaken) return;
            this.userCharKey = key;
            this.network.changeTeam(this.userTeam, this.userCharKey);
            this.soundFX.playBoing(1.2);
            this.renderRoomLobby();
          });

          charRow.appendChild(chip);
        });
      }
    }

    if (selectedCharName) {
      if (is1v1) {
        selectedCharName.textContent = this.userTeam === 'RED' ? 'The Strikers (4 Koin Merah)' : 'The Rovers (4 Koin Biru)';
      } else {
        const activeDef = CHARACTER_DEFS[this.userCharKey];
        if (activeDef) {
          selectedCharName.textContent = `${activeDef.name} (${activeDef.role.split('/')[0]})`;
        }
      }
    }
  }

  handleNetworkStatus(connected, msg) {
    console.log(`[Network Status]: ${connected ? 'ONLINE' : 'OFFLINE'} - ${msg}`);
  }
}

// Inisialisasi game saat window dimuat
window.addEventListener('DOMContentLoaded', () => {
  window.bolabolaGame = new Game();
  window.game = window.bolabolaGame;
});
