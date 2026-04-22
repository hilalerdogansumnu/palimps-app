#!/usr/bin/env node
/**
 * Tek seferlik SQL migration uygulayıcı.
 *
 * Kullanım:
 *   node scripts/apply-migration.mjs drizzle/0007_moments_enrichment.sql
 *
 * Neden bu script var: drizzle-kit migrate _journal.json'a bağımlı, bizim
 * journal 0003'te kalmış (0004-0006 hand-written SQL olarak uygulanmış).
 * Yeni migration'ı drizzle-kit üzerinden çalıştırmak ya önceki dosyaları
 * yeniden üretmeye çalışıyor ya da hiç uygulamıyor. Bu script sadece
 * verdiğin SQL dosyasını DATABASE_URL kullanarak doğrudan yürütür — idempotent
 * değil, o yüzden aynı migration'ı iki kez çalıştırma (ALTER TABLE fail eder).
 */
import { readFileSync } from "node:fs";
import { createConnection } from "mysql2/promise";
import "./load-env.js";

const migrationFile = process.argv[2];
if (!migrationFile) {
  console.error("Kullanım: node scripts/apply-migration.mjs <migration.sql>");
  process.exit(1);
}

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL bulunamadı. .env dosyasında tanımlı olmalı.");
  process.exit(1);
}

const sql = readFileSync(migrationFile, "utf-8");

// SQL'i statement'lara böl — boş satır + ; ile ayrılmış bloklar
const statements = sql
  .split(/;\s*(?:\n|$)/)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.split("\n").every((line) => line.trim().startsWith("--")));

console.log(`\n→ ${migrationFile} uygulanıyor (${statements.length} statement)`);

const conn = await createConnection(url);

try {
  for (const stmt of statements) {
    const preview = stmt.split("\n").filter((l) => !l.trim().startsWith("--")).join(" ").slice(0, 100);
    console.log(`  ▶ ${preview}${preview.length >= 100 ? "…" : ""}`);
    await conn.query(stmt);
  }
  console.log("\n✓ Migration başarıyla uygulandı.\n");
} catch (err) {
  console.error("\n✗ Migration hatası:", err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
