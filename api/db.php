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

// Deteksi apakah dijalankan di localhost / XAMPP lokal
$host = $_SERVER['HTTP_HOST'] ?? ($_SERVER['SERVER_NAME'] ?? 'localhost');
$isLocal = ($host === 'localhost' || $host === '127.0.0.1' || $host === '::1' || 
            strpos($host, '192.168.') === 0 || strpos($host, '10.') === 0 || strpos($host, '172.') === 0);

$pdo = null;
$dbError = null;

if (!$isLocal) {
    // 1. Coba koneksi utama InfinityFree MySQL
    try {
        $dsn = "mysql:host=sql309.infinityfree.com;port=3306;dbname=if0_42937348_bobola;charset=utf8mb4";
        $pdo = new PDO($dsn, 'if0_42937348', 'Saosabc123', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 5,
        ]);
    } catch (PDOException $e) {
        $dbError = $e->getMessage();
    }
}

// 2. Jika di localhost atau koneksi InfinityFree gagal saat di lokal, coba MySQL XAMPP lokal
if (!$pdo) {
    try {
        $dsn = "mysql:host=127.0.0.1;port=3306;dbname=if0_42937348_bobola;charset=utf8mb4";
        $pdo = new PDO($dsn, 'root', '', [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_TIMEOUT => 3,
        ]);
    } catch (PDOException $e) {
        // Coba nama database 'bolabola' di XAMPP lokal
        try {
            $dsn = "mysql:host=127.0.0.1;port=3306;dbname=bolabola;charset=utf8mb4";
            $pdo = new PDO($dsn, 'root', '', [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 3,
            ]);
        } catch (PDOException $e2) {
            // Jika tetap belum dapat, coba remote InfinityFree jika belum dicoba
            if ($isLocal) {
                try {
                    $dsn = "mysql:host=sql309.infinityfree.com;port=3306;dbname=if0_42937348_bobola;charset=utf8mb4";
                    $pdo = new PDO($dsn, 'if0_42937348', 'Saosabc123', [
                        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES => false,
                        PDO::ATTR_TIMEOUT => 5,
                    ]);
                } catch (PDOException $e3) {
                    $dbError = $e3->getMessage();
                }
            } else {
                $dbError = $e->getMessage();
            }
        }
    }
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
