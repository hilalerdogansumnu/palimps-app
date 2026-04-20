-- Freemium lifetime counter: number of successful assistant questions used
-- by a free-tier user. Persists across devices (DB truth). Pro users ignore
-- this column (not decremented or read in their gate path).
ALTER TABLE `users` ADD `freeAssistantQuestionsUsed` int DEFAULT 0 NOT NULL;
