import mysql from "mysql2/promise";

let pool = null;
let unavailable = false;

const schema = `
CREATE TABLE IF NOT EXISTS qr_invite_tokens (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  token_hash CHAR(64) NOT NULL UNIQUE,
  owner_user_id VARCHAR(32) NOT NULL,
  expires_at DATETIME(3) NOT NULL,
  redeemed_by VARCHAR(32) NULL,
  redeemed_at DATETIME(3) NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_qr_owner (owner_user_id),
  INDEX idx_qr_expires (expires_at)
);

CREATE TABLE IF NOT EXISTS device_sessions (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  session_key CHAR(36) NOT NULL UNIQUE,
  user_id VARCHAR(32) NOT NULL,
  token_hash CHAR(64) NOT NULL,
  device_label VARCHAR(255) NOT NULL,
  last_active_at DATETIME(3) NOT NULL,
  revoked_at DATETIME(3) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX idx_session_user (user_id)
);

CREATE TABLE IF NOT EXISTS abuse_reports (
  id BIGINT PRIMARY KEY AUTO_INCREMENT,
  reporter_user_id VARCHAR(32) NOT NULL,
  reported_user_id VARCHAR(32) NOT NULL,
  message_key VARCHAR(80) NOT NULL DEFAULT '',
  reason VARCHAR(64) NOT NULL,
  description VARCHAR(2000) NULL,
  evidence_text TEXT NULL,
  status VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uniq_report (reporter_user_id, reported_user_id, message_key, reason)
);
`;

export function mysqlConfigured() {
  return Boolean(process.env.MYSQL_HOST && process.env.MYSQL_USER && process.env.MYSQL_DATABASE);
}

export async function getPool() {
  if (!mysqlConfigured() || unavailable) return null;
  if (pool) return pool;
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST,
    port: Number(process.env.MYSQL_PORT || 3306),
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD || "",
    database: process.env.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: 10,
    timezone: "Z",
  });
  return pool;
}

export async function initMysql() {
  if (!mysqlConfigured()) {
    console.log("MySQL is not configured. QR codes, device sessions, and reports stay unavailable.");
    return false;
  }
  try {
    const connection = await getPool();
    const statements = schema.split(";").map((item) => item.trim()).filter(Boolean);
    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log("MySQL schema is ready");
    return true;
  } catch (error) {
    unavailable = true;
    pool = null;
    console.error("MySQL is unavailable:", error.message);
    return false;
  }
}

export function mysqlRequired() {
  const error = new Error("MySQL is not configured. Set MYSQL_HOST, MYSQL_USER, MYSQL_PASSWORD, and MYSQL_DATABASE.");
  error.statusCode = 503;
  return error;
}
