import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

// ==========================================
// 1. HTTP STATIC FILE SERVER
// ==========================================
const server = http.createServer((req, res) => {
  let reqPath = req.url.split('?')[0];
  if (reqPath === '/') reqPath = '/index.html';

  const filePath = path.join(__dirname, reqPath);

  // Security check: cegah directory traversal
  if (!filePath.startsWith(__dirname)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-cache'
    });

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  });
});

// ==========================================
// 2. NATIVE RFC 6455 WEBSOCKET PROTOCOL ENGINE
// (Zero Dependency - Berjalan di mana saja tanpa 'npm install')
// ==========================================
const rooms = new Map(); // roomId -> RoomState

class Room {
  constructor(id, hostId = null) {
    this.id = id;
    this.hostId = hostId;
    this.clients = new Set(); // Set of socket wrappers
    this.turn = 1;
    this.scoreRed = 0;
    this.scoreBlue = 0;
    this.planningTimer = 12.0;
    this.state = 'LOBBY'; // LOBBY | PLANNING | RESOLUTION | GOAL | GAMEOVER
    this.actions = new Map(); // playerId -> { charKey, angle, power }
    this.playerAssignments = new Map(); // playerId -> { name, team, charKey, isReady }
  }

  broadcast(data, excludeSocket = null) {
    const message = JSON.stringify(data);
    for (const client of this.clients) {
      if (client !== excludeSocket && client.readyState === 1) {
        client.send(message);
      }
    }
  }

  broadcastTeam(data, team) {
    const message = JSON.stringify(data);
    for (const client of this.clients) {
      if (client.readyState === 1 && client.team === team) {
        client.send(message);
      }
    }
  }

  getPlayersData() {
    return Array.from(this.playerAssignments.entries()).map(([id, info]) => ({
      id,
      isHost: (id === this.hostId),
      ...info
    }));
  }
}

// WebSocket Helper Functions
function parseWsFrame(buffer) {
  if (buffer.length < 2) return null;
  const firstByte = buffer[0];
  const secondByte = buffer[1];

  const fin = (firstByte & 0x80) === 0x80;
  const opcode = firstByte & 0x0f;
  const masked = (secondByte & 0x80) === 0x80;
  let payloadLen = secondByte & 0x7f;
  let offset = 2;

  if (payloadLen === 126) {
    if (buffer.length < 4) return null;
    payloadLen = buffer.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buffer.length < 10) return null;
    payloadLen = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  if (!masked) return null; // Client frames MUST be masked
  if (buffer.length < offset + 4 + payloadLen) return null;

  const maskKey = buffer.subarray(offset, offset + 4);
  offset += 4;
  const payload = Buffer.alloc(payloadLen);

  for (let i = 0; i < payloadLen; i++) {
    payload[i] = buffer[offset + i] ^ maskKey[i % 4];
  }

  return { fin, opcode, payload, totalLength: offset + payloadLen };
}

function buildWsFrame(textData) {
  const payload = Buffer.from(textData, 'utf8');
  const payloadLen = payload.length;

  let header;
  if (payloadLen <= 125) {
    header = Buffer.alloc(2);
    header[0] = 0x81; // FIN + text opcode
    header[1] = payloadLen;
  } else if (payloadLen <= 65535) {
    header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(payloadLen, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x81;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(payloadLen), 2);
  }

  return Buffer.concat([header, payload]);
}

server.on('upgrade', (req, socket, head) => {
  const secKey = req.headers['sec-websocket-key'];
  if (!secKey) {
    socket.destroy();
    return;
  }

  // WebSocket Handshake Response
  const hash = crypto
    .createHash('sha1')
    .update(secKey + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11')
    .digest('base64');

  const headers = [
    'HTTP/1.1 101 Switching Protocols',
    'Upgrade: websocket',
    'Connection: Upgrade',
    `Sec-WebSocket-Accept: ${hash}`
  ];

  socket.write(headers.join('\r\n') + '\r\n\r\n');

  // Client Wrapper Object
  const client = {
    id: 'P_' + Math.random().toString(36).substr(2, 6).toUpperCase(),
    socket,
    readyState: 1, // OPEN
    room: null,
    team: 'RED',
    charKey: 'ZIGGY',
    playerName: 'Player',
    send(text) {
      if (this.readyState === 1) {
        socket.write(buildWsFrame(text));
      }
    }
  };

  let bufferAcc = Buffer.alloc(0);

  socket.on('data', (chunk) => {
    bufferAcc = Buffer.concat([bufferAcc, chunk]);

    while (bufferAcc.length > 0) {
      const frame = parseWsFrame(bufferAcc);
      if (!frame) break; // Frame belum lengkap
      bufferAcc = bufferAcc.subarray(frame.totalLength);

      if (frame.opcode === 0x8) {
        // Close frame
        client.readyState = 2;
        socket.end();
        break;
      } else if (frame.opcode === 0x9) {
        // Ping -> Pong
        const pong = Buffer.alloc(2);
        pong[0] = 0x8a; // FIN + Pong
        pong[1] = 0;
        socket.write(pong);
      } else if (frame.opcode === 0x1) {
        // Text Frame
        try {
          const msg = JSON.parse(frame.payload.toString('utf8'));
          handleClientMessage(client, msg);
        } catch (e) {
          console.warn('Invalid JSON message received:', e.message);
        }
      }
    }
  });

  socket.on('close', () => {
    client.readyState = 3;
    handleClientDisconnect(client);
  });

  socket.on('error', () => {
    client.readyState = 3;
    handleClientDisconnect(client);
  });

  // Sambut klien baru
  client.send(JSON.stringify({
    type: 'CONNECTED',
    playerId: client.id
  }));
});

function handleClientMessage(client, msg) {
  switch (msg.type) {
    case 'CREATE_ROOM': {
      const roomId = (msg.roomId || Math.random().toString(36).substr(2, 5)).toUpperCase();
      let room = rooms.get(roomId);
      if (!room) {
        room = new Room(roomId, client.id);
        rooms.set(roomId, room);
      }
      if (!room.hostId) room.hostId = client.id;
      joinRoom(client, room, msg.playerName, msg.team, msg.charKey);
      break;
    }

    case 'JOIN_ROOM': {
      const roomId = (msg.roomId || '').toUpperCase();
      const room = rooms.get(roomId);
      if (!room) {
        client.send(JSON.stringify({ type: 'ERROR', message: `Room ${roomId} tidak ditemukan!` }));
        return;
      }
      if (!room.hostId) room.hostId = client.id;
      joinRoom(client, room, msg.playerName, msg.team, msg.charKey);
      break;
    }

    case 'CHANGE_TEAM': {
      if (!client.room) return;
      client.team = msg.team;
      client.charKey = msg.charKey || client.charKey;
      client.room.playerAssignments.set(client.id, {
        name: client.playerName,
        team: client.team,
        charKey: client.charKey,
        isReady: false
      });
      client.room.broadcast({
        type: 'ROOM_PLAYERS_UPDATE',
        hostId: client.room.hostId,
        players: client.room.getPlayersData()
      });
      break;
    }

    case 'AIM_UPDATE': {
      // Protokol PRD: Pemain membidik, rekan setim melihat vektor teman, lawan FOG OF AIM
      if (!client.room) return;
      client.room.actions.set(client.id, {
        playerId: client.id,
        charKey: client.charKey,
        angle: msg.angle,
        power: msg.power,
        team: client.team
      });

      // Broadcast hanya ke rekan setim (Intra-team visibility)
      client.room.broadcastTeam({
        type: 'TEAM_AIM_UPDATE',
        playerId: client.id,
        charKey: client.charKey,
        angle: msg.angle,
        power: msg.power
      }, client.team);
      break;
    }

    case 'TEAM_ACTIONS_UPDATE': {
      // Mode 1v1 Team: Pemain mengirim seluruh aksi 4 koin di timnya
      if (!client.room) return;
      if (Array.isArray(msg.actions)) {
        msg.actions.forEach(act => {
          client.room.actions.set(`${client.team}_${act.charKey}`, {
            playerId: client.id,
            charKey: act.charKey,
            angle: act.angle,
            power: act.power,
            team: client.team
          });
        });
      }

      const playerInfo = client.room.playerAssignments.get(client.id);
      if (playerInfo) {
        playerInfo.isReady = msg.ready !== undefined ? msg.ready : true;
      }

      client.room.broadcast({
        type: 'PLAYER_READY_STATUS',
        playerId: client.id,
        team: client.team,
        isReady: playerInfo ? playerInfo.isReady : true,
        hostId: client.room.hostId,
        players: client.room.getPlayersData()
      });

      // Cek apakah kedua tim sudah ready
      const allReady = Array.from(client.room.playerAssignments.values()).every(p => p.isReady);
      if (allReady && client.room.playerAssignments.size >= 2) {
        triggerSimultaneousResolution(client.room);
      }
      break;
    }

    case 'PLAYER_READY': {
      if (!client.room) return;
      const playerInfo = client.room.playerAssignments.get(client.id);
      if (playerInfo) {
        playerInfo.isReady = msg.ready;
      }

      client.room.broadcast({
        type: 'PLAYER_READY_STATUS',
        playerId: client.id,
        charKey: client.charKey,
        isReady: msg.ready,
        hostId: client.room.hostId,
        players: client.room.getPlayersData()
      });

      // Cek apakah semua pemain sudah ready
      const allReady = Array.from(client.room.playerAssignments.values()).every(p => p.isReady);
      if (allReady) {
        triggerSimultaneousResolution(client.room);
      }
      break;
    }

    case 'EMOTE': {
      if (!client.room) return;
      client.room.broadcast({
        type: 'EMOTE',
        playerId: client.id,
        emoji: msg.emoji,
        x: msg.x,
        y: msg.y
      }, client);
      break;
    }

    case 'MATCH_START_REQUEST': {
      if (!client.room) return;
      client.room.state = 'PLANNING';
      client.room.turn = 1;
      client.room.scoreRed = 0;
      client.room.scoreBlue = 0;
      client.room.actions.clear();

      client.room.broadcast({
        type: 'MATCH_STARTED',
        turn: 1,
        matchType: client.room.matchType || '1V1',
        players: client.room.getPlayersData()
      });
      break;
    }

    case 'SYNC_GOAL': {
      if (!client.room) return;
      if (msg.scoringTeam === 'RED') client.room.scoreRed++;
      else client.room.scoreBlue++;

      client.room.broadcast({
        type: 'GOAL_SCORED',
        scoringTeam: msg.scoringTeam,
        scoreRed: client.room.scoreRed,
        scoreBlue: client.room.scoreBlue
      });
      break;
    }
  }
}

function joinRoom(client, room, playerName = 'Player', team = 'RED', charKey = 'ZIGGY') {
  if (client.room) {
    client.room.clients.delete(client);
    client.room.playerAssignments.delete(client.id);
  }

  client.room = room;
  client.playerName = playerName;
  client.team = team;
  client.charKey = charKey;

  room.clients.add(client);
  room.playerAssignments.set(client.id, {
    name: client.playerName,
    team: client.team,
    charKey: client.charKey,
    isReady: false
  });

  client.send(JSON.stringify({
    type: 'ROOM_JOINED',
    roomId: room.id,
    playerId: client.id,
    hostId: room.hostId,
    players: room.getPlayersData(),
    gameState: room.state
  }));

  room.broadcast({
    type: 'ROOM_PLAYERS_UPDATE',
    hostId: room.hostId,
    players: room.getPlayersData()
  }, client);
}

function handleClientDisconnect(client) {
  if (client.room) {
    const room = client.room;
    room.clients.delete(client);
    room.playerAssignments.delete(client.id);
    room.actions.delete(client.id);

    if (room.clients.size === 0) {
      rooms.delete(room.id);
    } else {
      if (room.hostId === client.id) {
        const nextClient = room.clients.values().next().value;
        room.hostId = nextClient ? nextClient.id : null;
      }
      room.broadcast({
        type: 'PLAYER_DISCONNECTED',
        playerId: client.id,
        hostId: room.hostId,
        players: room.getPlayersData()
      });
    }
  }
}

function triggerSimultaneousResolution(room) {
  room.state = 'RESOLUTION';
  const actionsList = Array.from(room.actions.values());

  // Kirim paket resolusi simultan ke semua klien di room
  room.broadcast({
    type: 'START_RESOLUTION',
    turn: room.turn,
    actions: actionsList
  });

  // Reset actions untuk turn berikutnya
  room.actions.clear();
  for (const info of room.playerAssignments.values()) {
    info.isReady = false;
  }
}

server.listen(PORT, () => {
  console.log(`⚡ BolaBola Server & WebSocket Engine aktif di http://localhost:${PORT}`);
});
