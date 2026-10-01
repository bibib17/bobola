<?php
require_once __DIR__ . '/db.php';

$pdo = getPDO();

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'message' => 'Method not allowed']);
    exit;
}

$raw = file_get_contents('php://input');
$data = json_decode($raw, true) ?? $_POST;

$playerName = trim($data['player_name'] ?? 'Player 1');
$gameMode = $data['game_mode'] ?? 'SOLO';
$scoreRed = (int)($data['score_red'] ?? 0);
$scoreBlue = (int)($data['score_blue'] ?? 0);
$winningTeam = $data['winning_team'] ?? 'RED';
$isWin = !empty($data['is_win']) ? 1 : 0;
$goalsScored = (int)($data['goals_scored'] ?? 0);
$buffsTaken = (int)($data['buffs_taken'] ?? 0);
$charKey = $data['char_key'] ?? 'ZIGGY';
$mvpName = $data['mvp_name'] ?? 'Ziggy';
$mvpGoals = (int)($data['mvp_goals'] ?? 0);
$totalTurns = (int)($data['total_turns'] ?? 1);
$isSuddenDeath = !empty($data['is_sudden_death']) ? 1 : 0;
$matchId = 'M_' . time() . '_' . substr(md5(uniqid()), 0, 6);

try {
    $pdo->beginTransaction();

    // 1. Simpan Pertandingan ke tabel matches
    $stmtMatch = $pdo->prepare("
        INSERT INTO `matches` (`match_id`, `game_mode`, `score_red`, `score_blue`, `winning_team`, `mvp_character`, `mvp_goals`, `total_turns`, `is_sudden_death`)
        VALUES (:mid, :mode, :s_red, :s_blue, :winner, :mvp, :mvp_g, :turns, :sd)
    ");
    $stmtMatch->execute([
        ':mid' => $matchId,
        ':mode' => $gameMode,
        ':s_red' => $scoreRed,
        ':s_blue' => $scoreBlue,
        ':winner' => $winningTeam,
        ':mvp' => $mvpName,
        ':mvp_g' => $mvpGoals,
        ':turns' => $totalTurns,
        ':sd' => $isSuddenDeath
    ]);

    // 2. Hitung Tambahan EXP
    $expGained = ($isWin ? 50 : 20) + ($goalsScored * 15) + ($buffsTaken * 5);

    // 3. Upsert Player Stats ke tabel players
    $stmtPlayer = $pdo->prepare("
        INSERT INTO `players` (`player_name`, `level`, `exp`, `matches_played`, `matches_won`, `total_goals`, `total_buffs`, `favorite_char`)
        VALUES (:name, 1, :exp, 1, :won, :goals, :buffs, :char)
        ON DUPLICATE KEY UPDATE
            `exp` = `exp` + :exp_up,
            `level` = FLOOR((`exp` + :exp_up2) / 100) + 1,
            `matches_played` = `matches_played` + 1,
            `matches_won` = `matches_won` + :won_up,
            `total_goals` = `total_goals` + :goals_up,
            `total_buffs` = `total_buffs` + :buffs_up,
            `favorite_char` = :char_up
    ");

    $stmtPlayer->execute([
        ':name' => $playerName,
        ':exp' => $expGained,
        ':won' => $isWin,
        ':goals' => $goalsScored,
        ':buffs' => $buffsTaken,
        ':char' => $charKey,
        ':exp_up' => $expGained,
        ':exp_up2' => $expGained,
        ':won_up' => $isWin,
        ':goals_up' => $goalsScored,
        ':buffs_up' => $buffsTaken,
        ':char_up' => $charKey
    ]);

    // Ambil data terbaru player
    $stmtFetch = $pdo->prepare("SELECT * FROM `players` WHERE `player_name` = :name");
    $stmtFetch->execute([':name' => $playerName]);
    $player = $stmtFetch->fetch();

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'message' => 'Hasil pertandingan berhasil dicatat ke MySQL.',
        'match_id' => $matchId,
        'exp_gained' => $expGained,
        'player' => $player
    ]);
} catch (Exception $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal menyimpan hasil pertandingan.',
        'error' => $e->getMessage()
    ]);
}
