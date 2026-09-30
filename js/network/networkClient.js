/**
 * Network Client untuk Sinkronisasi Multiplayer Online BolaBola
 * Menggunakan WebSockets untuk pertukaran pesan real-time berlatensi rendah.
 */
export class NetworkClient {
  constructor({ onMessage, onStatusChange } = {}) {
    this.ws = null;
    this.connected = false;
    this.roomId = null;
    this.playerId = null;
    this.onMessage = onMessage || (() => {});
    this.onStatusChange = onStatusChange || (() => {});
    this.reconnectTimer = null;
  }

  connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host || 'localhost:3000';
      const url = `${protocol}//${host}`;

      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        this.connected = true;
        this.onStatusChange(true, 'Terhubung ke server multiplayer');
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleIncoming(data);
        } catch (e) {
          console.warn('Error parsing incoming WS message:', e);
        }
      };

      this.ws.onclose = () => {
        this.connected = false;
        this.onStatusChange(false, 'Terputus dari server');
      };

      this.ws.onerror = (err) => {
        this.connected = false;
        this.onStatusChange(false, 'Gagal terhubung ke server');
      };
    } catch (e) {
      this.connected = false;
      this.onStatusChange(false, 'Mode Offline');
    }
  }

  disconnect() {
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }
    this.connected = false;
    this.roomId = null;
    this.playerId = null;
  }

  handleIncoming(data) {
    if (data.type === 'CONNECTED') {
      this.playerId = data.playerId;
    } else if (data.type === 'ROOM_JOINED') {
      this.roomId = data.roomId;
    }

    this.onMessage(data);
  }

  send(data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
      return true;
    }
    return false;
  }

  createRoom(roomId, playerName, team, charKey) {
    return this.send({
      type: 'CREATE_ROOM',
      roomId,
      playerName,
      team,
      charKey
    });
  }

  joinRoom(roomId, playerName, team, charKey) {
    return this.send({
      type: 'JOIN_ROOM',
      roomId,
      playerName,
      team,
      charKey
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
    return this.send({
      type: 'AIM_UPDATE',
      angle,
      power
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
}
