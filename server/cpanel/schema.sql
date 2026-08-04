-- TryTone stats + profiles schema for a cPanel MySQL database.
-- Import once via phpMyAdmin (Import tab) or:  mysql -u USER -p DBNAME < schema.sql
-- Uses LONGTEXT (not the JSON type) so it works on older MySQL/MariaDB builds
-- common on shared cPanel hosting. The app treats the blob as opaque JSON.

CREATE TABLE IF NOT EXISTS profiles (
  id         CHAR(36)     NOT NULL,
  name       VARCHAR(64)  NOT NULL,
  pin_hash   VARCHAR(255) NULL,           -- bcrypt hash; NULL = no PIN
  created_at BIGINT       NOT NULL,        -- epoch ms
  PRIMARY KEY (id),
  UNIQUE KEY uniq_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS tokens (
  token      CHAR(64)  NOT NULL,           -- hex of 32 random bytes
  profile_id CHAR(36)  NOT NULL,
  created_at BIGINT    NOT NULL,
  PRIMARY KEY (token),
  KEY idx_profile (profile_id),
  CONSTRAINT fk_tokens_profile FOREIGN KEY (profile_id)
    REFERENCES profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS stats (
  profile_id CHAR(36) NOT NULL,
  data       LONGTEXT NOT NULL,            -- the StatsData JSON blob
  updated_at BIGINT   NOT NULL,
  PRIMARY KEY (profile_id),
  CONSTRAINT fk_stats_profile FOREIGN KEY (profile_id)
    REFERENCES profiles (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Owner-side usage analytics. One row per anonymous device (guests included).
-- `name` is the display name only when the user signed into a profile, else
-- NULL. `data` is the same rolled-up StatsData blob. Powers admin.php.
CREATE TABLE IF NOT EXISTS usage_stats (
  device_id  CHAR(64)     NOT NULL,        -- anonymous random id from the client
  name       VARCHAR(64)  NULL,
  data       LONGTEXT     NOT NULL,
  created_at BIGINT       NOT NULL,        -- first seen (epoch ms)
  updated_at BIGINT       NOT NULL,        -- last seen (epoch ms)
  PRIMARY KEY (device_id),
  KEY idx_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
