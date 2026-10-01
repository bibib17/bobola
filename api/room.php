<?php
/**
 * Real-Time Multiplayer Room Controller untuk InfinityFree MySQL
 * Menggunakan Polling berlatensi rendah untuk sinkronisasi room, lobby & turn resolution.
 */
require_once __DIR__ . '/db.php';

$pdo = getPDO();

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?? $_POST;
$action = $_GET['action'] ?? ($data['action'] ?? 'poll');

// Helper: Ambil data semua pemain di suatu room
function getRoomPlayersData($pdo, $roomId, $hostId) {
    $stmt = $pdo->prepare("SELECT `player_id` AS `id`, `player_name` AS `name`, `team`, `char_key` AS `charKey`, `is_ready` AS `isReady`, `aim_angle` AS `angle`, `aim_power` AS `power`, `team_actions` AS `teamActions` FROM `room_players` WHERE `room_id` = :rid ORDER BY `id` ASC");
    $stmt->execute([':rid' => $roomId]);
    $players = $stmt->fetchAll();

    foreach ($players as &$p) {
        $p['isHost'] = ($p['id'] === $hostId);
        $p['isReady'] = (bool)$p['isReady'];
        if (!empty($p['teamActions'])) {
            $p['teamActions'] = json_decode($p['teamActions'], true);
        }
    }
    return $players;
}

try {
    switch ($action) {
        case 'create': {
            $roomId = strtoupper(trim($data['room_id'] ?? ('BOLA' . rand(10, 99))));
            $playerName = trim($data['player_name'] ?? 'Player 1');
            $team = strtoupper(trim($data['team'] ?? 'RED'));
            $charKey = strtoupper(trim($data['char_key'] ?? 'ZIGGY'));
            $matchType = strtoupper(trim($data['match_type'] ?? '1V1'));
            $playerId = 'P_' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 6));

            // Buat atau timpa room baru
            $stmt = $pdo->prepare("
                INSERT INTO `rooms` (`id`, `host_id`, `match_type`, `status`, `current_turn`, `score_red`, `score_blue`)
                VALUES (:rid, :hid, :mtype, 'LOBBY', 1, 0, 0)
                ON DUPLICATE KEY UPDATE `host_id` = :hid2, `match_type` = :mtype2, `status` = 'LOBBY', `current_turn` = 1, `score_red` = 0, `score_blue` = 0
            ");
            $stmt->execute([
                ':rid' => $roomId,
                ':hid' => $playerId,
                ':mtype' => $matchType,
                ':hid2' => $playerId,
                ':mtype2' => $matchType
            ]);

            // Hapus pemain lama di room jika ada
            $pdo->prepare("DELETE FROM `room_players` WHERE `room_id` = :rid")->execute([':rid' => $roomId]);

            // Tambahkan host sebagai player 1
            $stmtP = $pdo->prepare("
                INSERT INTO `room_players` (`room_id`, `player_id`, `player_name`, `team`, `char_key`, `is_ready`)
                VALUES (:rid, :pid, :pname, :team, :char, 0)
            ");
            $stmtP->execute([
                ':rid' => $roomId,
                ':pid' => $playerId,
                ':pname' => $playerName,
                ':team' => $team,
                ':char' => $charKey
            ]);

            $players = getRoomPlayersData($pdo, $roomId, $playerId);

            echo json_encode([
                'success' => true,
                'type' => 'ROOM_JOINED',
                'roomId' => $roomId,
                'playerId' => $playerId,
                'hostId' => $playerId,
                'matchType' => $matchType,
                'players' => $players,
                'gameState' => 'LOBBY'
            ]);
            break;
        }

        case 'join': {
            $roomId = strtoupper(trim($data['room_id'] ?? ''));
            $playerName = trim($data['player_name'] ?? 'Player 2');
            $team = strtoupper(trim($data['team'] ?? 'BLUE'));
            $charKey = strtoupper(trim($data['char_key'] ?? 'KIKI'));
            $playerId = 'P_' . strtoupper(substr(md5(uniqid(rand(), true)), 0, 6));

            // Cek apakah room ada
            $stmt = $pdo->prepare("SELECT * FROM `rooms` WHERE `id` = :rid");
            $stmt->execute([':rid' => $roomId]);
            $room = $stmt->fetch();

            if (!$room) {
                echo json_encode(['success' => false, 'type' => 'ERROR', 'message' => "Room [{$roomId}] tidak ditemukan! Silakan buat room baru."]);
                exit;
            }

            // Tambahkan player ke room_players
            $stmtP = $pdo->prepare("
                INSERT INTO `room_players` (`room_id`, `player_id`, `player_name`, `team`, `char_key`, `is_ready`)
                VALUES (:rid, :pid, :pname, :team, :char, 0)
                ON DUPLICATE KEY UPDATE `player_name` = :pname2, `team` = :team2, `char_key` = :char2, `last_active` = NOW()
            ");
            $stmtP->execute([
                ':rid' => $roomId,
                ':pid' => $playerId,
                ':pname' => $playerName,
                ':team' => $team,
                ':char' => $charKey,
                ':pname2' => $playerName,
                ':team2' => $team,
                ':char2' => $charKey
            ]);

            $players = getRoomPlayersData($pdo, $roomId, $room['host_id']);

            echo json_encode([
                'success' => true,
                'type' => 'ROOM_JOINED',
                'roomId' => $roomId,
                'playerId' => $playerId,
                'hostId' => $room['host_id'],
                'matchType' => $room['match_type'],
                'players' => $players,
                'gameState' => $room['status']
            ]);
            break;
        }

        case 'change_team': {
            $roomId = strtoupper(trim($data['room_id'] ?? ''));
            $playerId = trim($data['player_id'] ?? '');
            $team = strtoupper(trim($data['team'] ?? 'RED'));
            $charKey = strtoupper(trim($data['char_key'] ?? 'ZIGGY'));

            $stmt = $pdo->prepare("UPDATE `room_players` SET `team` = :team, `char_key` = :char, `is_ready` = 0, `last_active` = NOW() WHERE `room_id` = :rid AND `player_id` = :pid");
            $stmt->execute([':team' => $team, ':char' => $charKey, ':rid' => $roomId, ':pid' => $playerId]);

            $stmtR = $pdo->prepare("SELECT * FROM `rooms` WHERE `id` = :rid");
            $stmtR->execute([':rid' => $roomId]);
            $room = $stmtR->fetch();

            $players = getRoomPlayersData($pdo, $roomId, $room['host_id'] ?? $playerId);

            echo json_encode([
                'success' => true,
                'type' => 'ROOM_PLAYERS_UPDATE',
                'hostId' => $room['host_id'] ?? $playerId,
                'matchType' => $room['match_type'] ?? '1V1',
                'players' => $players
            ]);
            break;
        }

        case 'ready': {
            $roomId = strtoupper(trim($data['room_id'] ?? ''));
            $playerId = trim($data['player_id'] ?? '');
            $isReady = !empty($data['is_ready']) ? 1 : 0;

            $stmt = $pdo->prepare("UPDATE `room_players` SET `is_ready` = :ready, `last_active` = NOW() WHERE `room_id` = :rid AND `player_id` = :pid");
            $stmt->execute([':ready' => $isReady, ':rid' => $roomId, ':pid' => $playerId]);

            $stmtR = $pdo->prepare("SELECT * FROM `rooms` WHERE `id` = :rid");
            $stmtR->execute([':rid' => $roomId]);
            $room = $stmtR->fetch();

            $players = getRoomPlayersData($pdo, $roomId, $room['host_id'] ?? $playerId);

            echo json_encode([
                'success' => true,
                'type' => 'PLAYER_READY_STATUS',
                'playerId' => $playerId,
                'isReady' => (bool)$isReady,
                'hostId' => $room['host_id'] ?? $playerId,
                'players' => $players
            ]);
            break;
        }

        case 'start_match': {
            $roomId = strtoupper(trim($data['room_id'] ?? ''));
            $playerId = trim($data['player_id'] ?? '');

            $stmt = $pdo->prepare("SELECT * FROM `rooms` WHERE `id` = :rid");
            $stmt->execute([':rid' => $roomId]);
            $room = $stmt->fetch();

            if (!$room || $room['host_id'] !== $playerId) {
                echo json_encode(['success' => false, 'message' => 'Hanya Host yang dapat memulai pertandingan!']);
                exit;
            }

            // Update status room ke PLANNING & reset koin/ready
            $pdo->prepare("UPDATE `rooms` SET `status` = 'PLANNING', `current_turn` = 1, `score_red` = 0, `score_blue` = 0, `resolution_actions` = NULL, `resolution_version` = 0 WHERE `id` = :rid")->execute([':rid' => $roomId]);
            $pdo->prepare("UPDATE `room_players` SET `is_ready` = 0, `aim_power` = 0, `team_actions` = NULL WHERE `room_id` = :rid")->execute([':rid' => $roomId]);

            // Tambah event MATCH_STARTED
            $stmtEv = $pdo->prepare("INSERT INTO `room_events` (`room_id`, `event_type`, `event_payload`) VALUES (:rid, 'MATCH_STARTED', :payload)");
            $stmtEv->execute([
                ':rid' => $roomId,
                ':payload' => json_encode([
                    'turn' => 1,
                    'matchType' => $room['match_type'],
                    'players' => getRoomPlayersData($pdo, $roomId, $playerId)
                ])
            ]);

            echo json_encode([
                'success' => true,
                'type' => 'MATCH_STARTED',
                'turn' => 1,
                'matchType' => $room['match_type'],
                'players' => getRoomPlayersData($pdo, $roomId, $playerId)
            ]);
            break;
        }

        case 'send_team_actions': {
            $roomId = strtoupper(trim($data['room_id'] ?? ''));
            $playerId = trim($data['player_id'] ?? '');
            $actions = $data['actions'] ?? [];
            $ready = !empty($data['ready']) ? 1 : 0;

            $stmt = $pdo->prepare("UPDATE `room_players` SET `team_actions` = :acts, `is_ready` = :rdy, `last_active` = NOW() WHERE `room_id` = :rid AND `player_id` = :pid");
            $stmt->execute([
                ':acts' => json_encode($actions),
                ':rdy' => $ready,
                ':rid' => $roomId,
                ':pid' => $playerId
            ]);

            // Cek apakah kedua pemain sudah ready
            $stmtP = $pdo->prepare("SELECT * FROM `room_players` WHERE `room_id` = :rid");
            $stmtP->execute([':rid' => $roomId]);
            $allPlayers = $stmtP->fetchAll();

            $allReady = count($allPlayers) >= 2 && array_reduce($allPlayers, fn($carry, $p) => $carry && $p['is_ready'], true);

            if ($allReady) {
                // Kumpulkan seluruh aksi koin dari kedua tim
                $combinedActions = [];
                foreach ($allPlayers as $p) {
                    if (!empty($p['team_actions'])) {
                        $parsed = json_decode($p['team_actions'], true);
                        if (is_array($parsed)) {
                            foreach ($parsed as $act) {
                                $combinedActions[] = [
                                    'charKey' => $act['charKey'] ?? 'ZIGGY',
                                    'angle' => (float)($act['angle'] ?? 0),
                                    'power' => (float)($act['power'] ?? 0),
                                    'team' => $p['team']
                                ];
                            }
                        }
                    }
                }

                // Update resolution di tabel rooms
                $pdo->prepare("
                    UPDATE `rooms` 
                    SET `status` = 'RESOLUTION', 
                        `resolution_actions` = :acts, 
                        `resolution_version` = `resolution_version` + 1 
                    WHERE `id` = :rid
                ")->execute([
                    ':acts' => json_encode($combinedActions),
                    ':rid' => $roomId
                ]);

                // Reset player ready
                $pdo->prepare("UPDATE `room_players` SET `is_ready` = 0, `team_actions` = NULL WHERE `room_id` = :rid")->execute([':rid' => $roomId]);

                echo json_encode([
                    'success' => true,
                    'type' => 'START_RESOLUTION',
                    'actions' => $combinedActions
                ]);
                exit;
            }

            echo json_encode(['success' => true, 'message' => 'Team actions recorded']);
            break;
        }

        case 'send_aim': {
            $roomId = strtoupper(trim($data['room_id'] ?? ''));
            $playerId = trim($data['player_id'] ?? '');
            $angle = (float)($data['angle'] ?? 0);
            $power = (float)($data['power'] ?? 0);

            $stmt = $pdo->prepare("UPDATE `room_players` SET `aim_angle` = :ang, `aim_power` = :pow, `last_active` = NOW() WHERE `room_id` = :rid AND `player_id` = :pid");
            $stmt->execute([':ang' => $angle, ':pow' => $power, ':rid' => $roomId, ':pid' => $playerId]);

            echo json_encode(['success' => true]);
            break;
        }

        case 'poll': {
            $roomId = strtoupper(trim($_GET['room_id'] ?? ($data['room_id'] ?? '')));
            $playerId = trim($_GET['player_id'] ?? ($data['player_id'] ?? ''));
            $lastEventId = (int)($_GET['last_event_id'] ?? ($data['last_event_id'] ?? 0));
            $lastResVersion = (int)($_GET['last_res_version'] ?? ($data['last_res_version'] ?? 0));

            if (empty($roomId)) {
                echo json_encode(['success' => false, 'message' => 'Room ID required']);
                exit;
            }

            // Update heartbeat player
            if (!empty($playerId)) {
                $pdo->prepare("UPDATE `room_players` SET `last_active` = NOW() WHERE `room_id` = :rid AND `player_id` = :pid")->execute([':rid' => $roomId, ':pid' => $playerId]);
            }

            // Ambil state room
            $stmtR = $pdo->prepare("SELECT * FROM `rooms` WHERE `id` = :rid");
            $stmtR->execute([':rid' => $roomId]);
            $room = $stmtR->fetch();

            if (!$room) {
                echo json_encode(['success' => false, 'message' => 'Room not found']);
                exit;
            }

            $players = getRoomPlayersData($pdo, $roomId, $room['host_id']);

            // Ambil event-event baru
            $stmtEv = $pdo->prepare("SELECT `id`, `event_type`, `event_payload` FROM `room_events` WHERE `room_id` = :rid AND `id` > :last_id ORDER BY `id` ASC");
            $stmtEv->execute([':rid' => $roomId, ':last_id' => $lastEventId]);
            $events = $stmtEv->fetchAll();

            $formattedEvents = [];
            $maxEvId = $lastEventId;
            foreach ($events as $ev) {
                $maxEvId = max($maxEvId, (int)$ev['id']);
                $formattedEvents[] = [
                    'id' => (int)$ev['id'],
                    'type' => $ev['event_type'],
                    'payload' => json_decode($ev['event_payload'], true)
                ];
            }

            // Cek resolusi baru
            $newResolution = null;
            if ((int)$room['resolution_version'] > $lastResVersion && !empty($room['resolution_actions'])) {
                $newResolution = [
                    'version' => (int)$room['resolution_version'],
                    'actions' => json_decode($room['resolution_actions'], true)
                ];
            }

            echo json_encode([
                'success' => true,
                'roomId' => $roomId,
                'hostId' => $room['host_id'],
                'matchType' => $room['match_type'],
                'gameState' => $room['status'],
                'turn' => (int)$room['current_turn'],
                'scoreRed' => (int)$room['score_red'],
                'scoreBlue' => (int)$room['score_blue'],
                'players' => $players,
                'events' => $formattedEvents,
                'lastEventId' => $maxEvId,
                'resolution' => $newResolution,
                'resolutionVersion' => (int)$room['resolution_version']
            ]);
            break;
        }

        case 'sync_goal': {
            $roomId = strtoupper(trim($data['room_id'] ?? ''));
            $scoringTeam = strtoupper(trim($data['scoring_team'] ?? 'RED'));

            if ($scoringTeam === 'RED') {
                $pdo->prepare("UPDATE `rooms` SET `score_red` = `score_red` + 1 WHERE `id` = :rid")->execute([':rid' => $roomId]);
            } else {
                $pdo->prepare("UPDATE `rooms` SET `score_blue` = `score_blue` + 1 WHERE `id` = :rid")->execute([':rid' => $roomId]);
            }

            $stmtR = $pdo->prepare("SELECT * FROM `rooms` WHERE `id` = :rid");
            $stmtR->execute([':rid' => $roomId]);
            $room = $stmtR->fetch();

            $stmtEv = $pdo->prepare("INSERT INTO `room_events` (`room_id`, `event_type`, `event_payload`) VALUES (:rid, 'GOAL_SCORED', :payload)");
            $stmtEv->execute([
                ':rid' => $roomId,
                ':payload' => json_encode([
                    'scoringTeam' => $scoringTeam,
                    'scoreRed' => (int)$room['score_red'],
                    'scoreBlue' => (int)$room['score_blue']
                ])
            ]);

            echo json_encode([
                'success' => true,
                'scoreRed' => (int)$room['score_red'],
                'scoreBlue' => (int)$room['score_blue']
            ]);
            break;
        }

        case 'emote': {
            $roomId = strtoupper(trim($data['room_id'] ?? ''));
            $playerId = trim($data['player_id'] ?? '');
            $emoji = $data['emoji'] ?? '⚽';
            $x = (float)($data['x'] ?? 0);
            $y = (float)($data['y'] ?? 0);

            $stmtEv = $pdo->prepare("INSERT INTO `room_events` (`room_id`, `event_type`, `event_payload`) VALUES (:rid, 'EMOTE', :payload)");
            $stmtEv->execute([
                ':rid' => $roomId,
                ':payload' => json_encode(['playerId' => $playerId, 'emoji' => $emoji, 'x' => $x, 'y' => $y])
            ]);

            echo json_encode(['success' => true]);
            break;
        }

        case 'leave': {
            $roomId = strtoupper(trim($data['room_id'] ?? ''));
            $playerId = trim($data['player_id'] ?? '');

            $pdo->prepare("DELETE FROM `room_players` WHERE `room_id` = :rid AND `player_id` = :pid")->execute([':rid' => $roomId, ':pid' => $playerId]);

            echo json_encode(['success' => true]);
            break;
        }

        default: {
            http_response_code(400);
            echo json_encode(['success' => false, 'message' => "Action '{$action}' tidak dikenali"]);
            break;
        }
    }
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['success' => false, 'message' => 'Terjadi kesalahan di server.', 'error' => $e->getMessage()]);
}
