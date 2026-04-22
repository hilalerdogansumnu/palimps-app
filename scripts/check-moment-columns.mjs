#!/usr/bin/env node
/**
 * Phase A (Gemini enrichment) — reading_moments tablosunda summary + tags
 * kolonlarının uygulanıp uygulanmadığını kontrol eder.
 *
 * Kullanım:
 *   railway run node scripts/check-moment-columns.mjs
 *
 * (Railway CLI DATABASE_URL'i inject eder. load-env.js local .env okur ama
 * prod için railway run tercih edilir.)
 *
 * Çıktı:
 *   ✓ summary: varchar(280) null=YES  → 0007 uygulanmış
 *   ✓ tags: json null=YES             → 0007 uygulanmış
 *   ✗ YOK                             → 0007 uygulanmamış, önce apply et
 */
import { createConnection } from "mysql2/promise";
import "./load-env.js";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL bulunamadı. `railway run` ile çalıştır veya export et.");
  process.exit(1);
}

const conn = await createConnection(url);

try {
  const [rows] = await conn.query("SHOW COLUMNS FROM reading_moments");
  const relevant = rows.filter((r) => r.Field === "summary" || r.Field === "tags");

  console.log("\nreading_moments — Phase A kolonları:\n");

  if (relevant.length === 0) {
    console.log("  ✗ YOK — 0007_moments_enrichment.sql henüz uygulanmamış.");
    console.log("    Uygula: railway run node scripts/apply-migration.mjs drizzle/0007_moments_enrichment.sql\n");
    process.exitCode = 1;
  } else {
    for (const c of relevant) {
      console.log(`  ✓ ${c.Field}: ${c.Type} null=${c.Null}`);
    }
    if (relevant.length < 2) {
      console.log("\n  ⚠ Beklenen 2 kolon (summary + tags), bulunan:", relevant.length);
      process.exitCode = 1;
    } else {
      console.log("\n✓ Phase A schema hazır.\n");
    }
  }
} catch (err) {
  console.error("\n✗ Query hatası:", err.message);
  process.exitCode = 1;
} finally {
  await conn.end();
}
