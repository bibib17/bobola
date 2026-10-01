/**
 * Network Client untuk Sinkronisasi Multiplayer Online BolaBola
 * Mendukung Mode Hibrida:
 * 1. WebSockets (Bila Node.js WS server tersedia)
 * 2. HTTP Polling via PHP & MySQL (Bekerja otomatis di Web Hosting InfinityFree / Apache / XAMPP)
 */
export class NetworkClient {
  constructor({ onMessage, onStatusChange } = {}) {
    this.ws = null;
    this.connected = false;
    this.useHttpPolling = false;
    this.roomId = null;
    this.playerId = null;
    this.hostId = null;
    this.lastEventId = 0;
    this.lastResVersion = 0;
    this.pollTimer = null;
    this.pendingQueue = [];
    this.onMessage = onMessage || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.isPolling = false;
    this.lastAimTime = 0;
  }

  getApiBaseUrl() {
    // Relative path ke folder api/ dari lokasi aplikasi web saat ini
    const origin = window.location.origin || '';
    let pathname = window.location.pathname || '';
    if (!pathname.endsWith('/')) {
      pathname = pathname.substring(0, pathname.lastIndexOf('/') + 1);
    }
    return `${origin}${pathname}api/room.php`;
  }

  getWebSocketUrl() {
    const customUrl = localStorage.getItem('bolabola_ws_server');
    if (customUrl) return customUrl;

    const isSecure = window.location.protocol === 'https:';
    const protocol = isSecure ? 'wss:' : 'ws:';
    const hostname = window.location.hostname || 'localhost';

    // Jika diakses secara lokal (Localhost / XAMPP / IP LAN lokal)
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname.startsWith('192.168.') || hostname.startsWith('10.') || hostname.endsWith('.local');
    if (isLocal) {
      const port = (window.location.port && window.location.port !== '80' && window.location.port !== '443') ? window.location.port : '3000';
      return `${protocol}//${hostname}:${port}`;
    }

    // Default fallback WS jika ada server websocket terpasang
    return `wss://bobola.onrender.com`;
  }

  connect() {
    if (this.connected) return;

    // Coba koneksi WebSocket terlebih dahulu
    try {
      const wsUrl = this.getWebSocketUrl();
      this.ws = new WebSocket(wsUrl);

      // Berikan timeout 1.5 detik: jika WS gagal/tidak merespon, beralih otomatis ke HTTP Polling (PHP/MySQL)
      const wsTimeout = setTimeout(() => {
        if (!this.connected && this.ws && this.ws.readyState !== WebSocket.OPEN) {
          console.log('[NetworkClient] WebSocket tidak tersedia, beralih otomatis ke mode HTTP/MySQL (InfinityFree)...');
          this.enableHttpFallback();
        }
      }, 1500);

      this.ws.onopen = () => {
        clearTimeout(wsTimeout);
        this.connected = true;
        this.useHttpPolling = false;
        this.flushQueue();
        this.onStatusChange(true, 'Terhubung ke server multiplayer (WebSocket)');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncoming(data);
        } catch (e) {
          console.warn('[NetworkClient] Error parsing incoming WS message:', e);
        }
      };

      this.ws.onclose = () => {
        if (!this.useHttpPolling) {
          console.log('[NetworkClient] WebSocket ditutup, beralih ke HTTP Polling...');
          this.enableHttpFallback();
        }
      };

      this.ws.onerror = () => {
        clearTimeout(wsTimeout);
        if (!this.useHttpPolling) {
          console.log('[NetworkClient] WebSocket error, beralih ke HTTP Polling...');
          this.enableHttpFallback();
        }
      };
    } catch (e) {
      this.enableHttpFallback();
    }
  }

  enableHttpFallback() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.useHttpPolling = true;
    this.connected = true;
    this.onStatusChange(true, 'Terhubung ke server multiplayer (PHP/MySQL)');
    this.flushQueue();
  }

  disconnect() {
    if (this.ws) {
      try { this.ws.close(); } catch (e) {}
      this.ws = null;
    }
    this.stopPolling();
    this.connected = false;
    this.useHttpPolling = false;
    this.roomId = null;
    this.playerId = null;
    this.pendingQueue = [];
  }

  startPolling() {
    this.stopPolling();
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), 750);
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  async poll() {
    if (!this.roomId || !this.useHttpPolling || this.isPolling) return;
    this.isPolling = true;

    try {
      const url = `${this.getApiBaseUrl()}?action=poll&room_id=${encodeURIComponent(this.roomId)}&player_id=${encodeURIComponent(this.playerId || '')}&last_event_id=${this.lastEventId}&last_res_version=${this.lastResVersion}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      if (data.success) {
        if (data.hostId) this.hostId = data.hostId;
        if (data.lastEventId) this.lastEventId = data.lastEventId;

        // Kirim update pemain ke game jika ada
        this.onMessage({
          type: 'ROOM_PLAYERS_UPDATE',
          hostId: data.hostId,
          matchType: data.matchType,
          players: data.players || []
        });

        // Proses event-event baru
        if (Array.isArray(data.events)) {
          for (const ev of data.events) {
            if (ev.type === 'MATCH_STARTED') {
              this.onMessage({
                type: 'MATCH_STARTED',
                turn: ev.payload.turn || 1,
                matchType: ev.payload.matchType || data.matchType,
                players: ev.payload.players || data.players
              });
            } else if (ev.type === 'GOAL_SCORED') {
              this.onMessage({
                type: 'GOAL_SCORED',
                scoringTeam: ev.payload.scoringTeam,
                scoreRed: ev.payload.scoreRed,
                scoreBlue: ev.payload.scoreBlue
              });
            } else if (ev.type === 'EMOTE') {
              this.onMessage({
                type: 'EMOTE',
                playerId: ev.payload.playerId,
                emoji: ev.payload.emoji,
                x: ev.payload.x,
                y: ev.payload.y
              });
            }
          }
        }

        // Resolusi aksi simultan
        if (data.resolution && data.resolution.version > this.lastResVersion) {
          this.lastResVersion = data.resolution.version;
          this.onMessage({
            type: 'START_RESOLUTION',
            actions: data.resolution.actions || []
          });
        }
      }
    } catch (e) {
      console.warn('[NetworkClient] Poll error:', e);
    } finally {
      this.isPolling = false;
    }
  }

  flushQueue() {
    while (this.pendingQueue.length > 0) {
      const msg = this.pendingQueue.shift();
      this.send(msg);
    }
  }

  handleIncoming(data) {
    if (data.type === 'CONNECTED') {
      this.playerId = data.playerId;
    } else if (data.type === 'ROOM_JOINED') {
      this.roomId = data.roomId;
      this.playerId = data.playerId;
      this.hostId = data.hostId;
      if (this.useHttpPolling) {
        this.startPolling();
      }
    }

    this.onMessage(data);
  }

  async send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }

    if (this.useHttpPolling) {
      return this.sendHttp(data);
    }

    // Jika belum siap, simpan ke antrean dan aktifkan koneksi
    this.pendingQueue.push(data);
    this.connect();
    return true;
  }

  async sendHttp(data) {
    const apiUrl = this.getApiBaseUrl();
    try {
      let action = 'poll';
      let payload = { ...data };

      switch (data.type) {
        case 'CREATE_ROOM':
          action = 'create';
          payload = {
            room_id: data.roomId,
            player_name: data.playerName,
            team: data.team,
            char_key: data.charKey,
            match_type: data.matchType
          };
          break;

        case 'JOIN_ROOM':
          action = 'join';
          payload = {
            room_id: data.roomId,
            player_name: data.playerName,
            team: data.team,
            char_key: data.charKey,
            match_type: data.matchType
          };
          break;

        case 'CHANGE_TEAM':
          action = 'change_team';
          payload = {
            room_id: this.roomId,
            player_id: this.playerId,
            team: data.team,
            char_key: data.charKey
          };
          break;

        case 'PLAYER_READY':
          action = 'ready';
          payload = {
            room_id: this.roomId,
            player_id: this.playerId,
            is_ready: data.ready ? 1 : 0
          };
          break;

        case 'MATCH_START_REQUEST':
          action = 'start_match';
          payload = {
            room_id: this.roomId,
            player_id: this.playerId
          };
          break;

        case 'TEAM_ACTIONS_UPDATE':
          action = 'send_team_actions';
          payload = {
            room_id: this.roomId,
            player_id: this.playerId,
            actions: data.actions || [],
            ready: data.ready ? 1 : 0
          };
          break;

        case 'AIM_UPDATE':
          action = 'send_aim';
          payload = {
            room_id: this.roomId,
            player_id: this.playerId,
            angle: data.angle,
            power: data.power
          };
          break;

        case 'SYNC_GOAL':
          action = 'sync_goal';
          payload = {
            room_id: this.roomId,
            scoring_team: data.scoringTeam
          };
          break;

        case 'EMOTE':
          action = 'emote';
          payload = {
            room_id: this.roomId,
            player_id: this.playerId,
            emoji: data.emoji,
            x: data.x,
            y: data.y
          };
          break;

        case 'LEAVE_ROOM':
          action = 'leave';
          payload = {
            room_id: this.roomId,
            player_id: this.playerId
          };
          break;

        default:
          return;
      }

      const res = await fetch(`${apiUrl}?action=${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const resData = await res.json();

      if (resData.success) {
        if (resData.type) {
          this.handleIncoming(resData);
        }
        if (action === 'create' || action === 'join') {
          this.roomId = resData.roomId;
          this.playerId = resData.playerId;
          this.hostId = resData.hostId;
          this.startPolling();
        }
      } else if (resData.message) {
        alert(resData.message);
      }
      return resData;
    } catch (e) {
      console.error('[NetworkClient] HTTP Error:', e);
      alert('Gagal menghubungi server database online. Pastikan koneksi internet aktif dan database telah di-import.');
    }
  }

  createRoom(roomId, playerName, team, charKey, matchType = 'PARTY') {
    return this.send({
      type: 'CREATE_ROOM',
      roomId,
      playerName,
      team,
      charKey,
      matchType
    });
  }

  joinRoom(roomId, playerName, team, charKey, matchType = 'PARTY') {
    return this.send({
      type: 'JOIN_ROOM',
      roomId,
      playerName,
      team,
      charKey,
      matchType
    });
  }

  changeTeam(team, charKey) {
    return this.send({
      type: 'CHANGE_TEAM',
      team,
      charKey
    });
  }

  sendAimUpdate(angle, power) {
    const now = performance.now();
    if (this.useHttpPolling && now - this.lastAimTime < 200) {
      return; // Throttle aim update pada mode polling HTTP agar tidak membebani server
    }
    this.lastAimTime = now;
    return this.send({
      type: 'AIM_UPDATE',
      angle,
      power
    });
  }

  sendTeamActions(actions, ready = true) {
    return this.send({
      type: 'TEAM_ACTIONS_UPDATE',
      actions,
      ready
    });
  }

  sendReady(ready = true) {
    return this.send({
      type: 'PLAYER_READY',
      ready
    });
  }

  requestStartMatch() {
    return this.send({
      type: 'MATCH_START_REQUEST'
    });
  }

  syncGoal(scoringTeam) {
    return this.send({
      type: 'SYNC_GOAL',
      scoringTeam
    });
  }

  sendEmote(emoji, x, y) {
    return this.send({
      type: 'EMOTE',
      emoji,
      x,
      y
    });
  }

  leaveRoom() {
    this.send({
      type: 'LEAVE_ROOM'
    });
    this.stopPolling();
    this.roomId = null;
    this.playerId = null;
  }
}
