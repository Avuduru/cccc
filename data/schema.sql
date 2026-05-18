-- ============================================================
-- CCCC Database Schema
-- Run this once in phpMyAdmin or via MySQL CLI on CranL.
-- ============================================================

SET NAMES utf8mb4;
SET time_zone = '+00:00';

-- ============================================================
-- Table 1: works
-- One row per unique work of art (anime, game, movie, etc.)
-- Identified by content_id + content_type (e.g. mal_id + 'anime')
-- ============================================================
CREATE TABLE IF NOT EXISTS works (
    id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    content_id            VARCHAR(255) NOT NULL,
    content_type          ENUM('anime','manga','movie','tv','game','book','manual') NOT NULL,
    title                 VARCHAR(500) NOT NULL,
    poster_url            VARCHAR(1000) DEFAULT NULL,
    rater_count           INT UNSIGNED DEFAULT 0,     -- unique raters (not raw export count)
    created_at            DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at            DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    UNIQUE KEY uq_content (content_id, content_type),
    INDEX idx_content_type (content_type),
    INDEX idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ============================================================
-- Table 2: classifications
-- One row per person per work.
-- UNIQUE KEY (work_id, ip_hash) enforces "one vote per rater".
-- Re-exporting the same work from the same IP overwrites the row.
-- ============================================================
CREATE TABLE IF NOT EXISTS classifications (
    id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    work_id         INT UNSIGNED NOT NULL,
    ip_hash         CHAR(64) NOT NULL,               -- SHA-256 of client IP (never stored raw)

    -- ── Mawjoodat ratings ────────────────────────────────────
    -- 0 = absent / not present
    -- 1 = red    (cannot skip, integral to content)
    -- 2 = orange (can skip, causes frequent interruptions)
    -- 3 = yellow (can skip easily, rare occurrences)
    kufr            TINYINT UNSIGNED DEFAULT 0,
    sex             TINYINT UNSIGNED DEFAULT 0,
    nudity          TINYINT UNSIGNED DEFAULT 0,
    vices           TINYINT UNSIGNED DEFAULT 0,
    magic           TINYINT UNSIGNED DEFAULT 0,
    lgbt            TINYINT UNSIGNED DEFAULT 0,
    gore            TINYINT UNSIGNED DEFAULT 0,
    addiction       TINYINT UNSIGNED DEFAULT 0,      -- game-only
    lootbox         TINYINT UNSIGNED DEFAULT 0,      -- game-only
    p2w             TINYINT UNSIGNED DEFAULT 0,      -- game-only

    -- ── Mustathniyat badges ───────────────────────────────────
    -- TRUE = this content is ABSENT (a positive quality)
    badge_nomusic       TINYINT(1) DEFAULT 0,
    badge_noprofanity   TINYINT(1) DEFAULT 0,
    badge_noaffairs     TINYINT(1) DEFAULT 0,

    -- ── Session metadata ──────────────────────────────────────
    classifier      VARCHAR(100) DEFAULT '',         -- watermark name entered by user
    orientation     ENUM('horizontal','vertical') DEFAULT 'horizontal',
    action          ENUM('export','copy','rate') DEFAULT 'export',

    created_at      DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (work_id) REFERENCES works(id) ON DELETE CASCADE,
    UNIQUE KEY uq_vote (work_id, ip_hash),           -- one vote per person per work
    INDEX idx_work_id (work_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
