-- Phase A enrichment (Gemini): Her okuma anına summary (tek cümlelik öz)
-- ve tags (2-3 tematik etiket, JSON array) ekliyoruz. İkisi de nullable —
-- OCR başarılı ama enrichment başarısızsa moment yine kaydolur.
--
-- Backfill yok: mevcut moment'ler summary/tags NULL olarak kalır, library
-- UI fallback olarak ocrText ilk cümlesini özet yerine göstermeye bilir
-- (ya da sadece ilerideki moment'lerde enrichment görünür). Geriye dönük
-- enrichment ayrı bir admin job olarak sonradan yazılabilir.
ALTER TABLE `reading_moments` ADD `summary` varchar(280);
ALTER TABLE `reading_moments` ADD `tags` json;
