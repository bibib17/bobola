-- =========================================================
-- DATABASE SCHEMA: BOLABOLA LEAGUE
-- Database: if0_42937348_bobola
-- Hosting: InfinityFree MySQL (sql309.infinityfree.com)
-- =========================================================

CREATE TABLE IF NOT EXISTS `players` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `player_name` VARCHAR(50) NOT NULL UNIQUE,
  `rank_title` VARCHAR(50) DEFAULT '🌱 Rookie Player',
  `level` INT DEFAULT 1,
  `exp` INT DEFAULT 0,
  `matches_played` INT DEFAULT 0,
  `matches_won` INT DEFAULT 0,
  `total_goals` INT DEFAULT 0,
  `total_buffs` INT DEFAULT 0,
  `favorite_char` VARCHAR(30) DEFAULT 'ZIGGY',
  `last_played_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `matches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `match_id` VARCHAR(50) NOT NULL,
  `game_mode` VARCHAR(30) NOT NULL DEFAULT 'SOLO',
  `score_red` INT NOT NULL DEFAULT 0,
  `score_blue` INT NOT NULL DEFAULT 0,
  `winning_team` VARCHAR(10) NOT NULL,
  `mvp_character` VARCHAR(50) DEFAULT 'Ziggy',
  `mvp_goals` INT DEFAULT 0,
  `total_turns` INT DEFAULT 1,
  `is_sudden_death` TINYINT(1) DEFAULT 0,
  `played_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `match_participants` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `match_id` VARCHAR(50) NOT NULL,
  `player_name` VARCHAR(50) NOT NULL,
  `team` VARCHAR(10) NOT NULL,
  `char_key` VARCHAR(30) NOT NULL,
  `goals_scored` INT DEFAULT 0,
  `is_winner` TINYINT(1) DEFAULT 0,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Player Awal (Demo Leaderboard)
INSERT INTO `players` (`player_name`, `rank_title`, `level`, `exp`, `matches_played`, `matches_won`, `total_goals`, `total_buffs`, `favorite_char`)
VALUES
  ('StrikerKing', '👑 Apex Striker', 12, 1450, 48, 38, 92, 45, 'ZIGGY'),
  ('CaptenRocco', '⭐ Master Strategist', 9, 980, 32, 24, 54, 28, 'ROCCO'),
  ('KikiMaster', '⚡ Diamond Prodigy', 7, 720, 25, 18, 41, 19, 'KIKI'),
  ('TrixieGoal', '🌟 Gold Challenger', 5, 450, 16, 11, 26, 14, 'TRIXIE')
ON DUPLICATE KEY UPDATE `matches_played` = VALUES(`matches_played`);
