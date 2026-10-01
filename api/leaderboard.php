<?php
require_once __DIR__ . '/db.php';

$pdo = getPDO();

$limit = isset($_GET['limit']) ? min((int)$_GET['limit'], 50) : 10;
$type = $_GET['type'] ?? 'exp'; // 'exp' | 'goals' | 'wins'

try {
    $orderBy = '`exp` DESC';
    if ($type === 'goals') $orderBy = '`total_goals` DESC, `exp` DESC';
    if ($type === 'wins') $orderBy = '`matches_won` DESC, `exp` DESC';

    $stmt = $pdo->prepare("
        SELECT 
            `id`,
            `player_name`,
            `level`,
            `exp`,
            `rank_title`,
            `matches_played`,
            `matches_won`,
            `total_goals`,
            `total_buffs`,
            `favorite_char`,
            CASE 
                WHEN `matches_played` > 0 THEN ROUND((`matches_won` / `matches_played`) * 100, 1)
                ELSE 0
            END AS `win_rate`
        FROM `players`
        ORDER BY {$orderBy}
        LIMIT :limit
    ");
    $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
    $stmt->execute();

    $leaderboard = $stmt->fetchAll();

    echo json_encode([
        'success' => true,
        'count' => count($leaderboard),
        'leaderboard' => $leaderboard
    ]);
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Gagal mengambil data leaderboard.',
        'error' => $e->getMessage()
    ]);
}
