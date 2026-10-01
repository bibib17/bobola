<?php
/**
 * Koneksi Database PDO untuk BolaBola League
 * Otomatis mendeteksi lingkungan InfinityFree MySQL vs Local XAMPP MySQL.
 */
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// Konfigurasi Database InfinityFree
$isInfinityFree = (strpos($_SERVER['HTTP_HOST'] ?? '', 'infinityfree') !== false || 
                   strpos($_SERVER['HTTP_HOST'] ?? '', 'epizy.com') !== false || 
                   strpos($_SERVER['HTTP_HOST'] ?? '', 'rf.gd') !== false);

if ($isInfinityFree) {
    $dbHost = 'sql309.infinityfree.com';
    $dbName = 'if0_42937348_bobola';
    $dbUser = 'if0_42937348';
    $dbPass = 'Saosabc123';
    $dbPort = '3306';
} else {
    // Fallback Localhost / XAMPP
    $dbHost = '127.0.0.1';
    $dbName = 'if0_42937348_bobola'; // atau 'bolabola'
    $dbUser = 'root';
    $dbPass = '';
    $dbPort = '3306';
}

try {
    $dsn = "mysql:host={$dbHost};port={$dbPort};dbname={$dbName};charset=utf8mb4";
    $pdo = new PDO($dsn, $dbUser, $dbPass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    // Jika koneksi lokal gagal karena database lokal belum dibuat, tangani secara graceful
    $pdo = null;
    $dbError = $e->getMessage();
}

function getPDO() {
    global $pdo, $dbError;
    if (!$pdo) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'Gagal terhubung ke Database MySQL.',
            'error' => $dbError ?? 'Unknown DB error'
        ]);
        exit;
    }
    return $pdo;
}
