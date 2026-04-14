-- Migrate from Manus OAuth + iyzico to native Apple/Google Sign In + RevenueCat.
--
-- 1. Drop iyzico subscription columns (replaced by RevenueCat)
-- 2. Widen openId to fit "apple:<sub>" / "google:<sub>" identifiers
-- 3. Add RevenueCat tracking columns

ALTER TABLE `users` DROP COLUMN `iyzicoCustomerId`;--> statement-breakpoint
ALTER TABLE `users` DROP COLUMN `iyzicoSubscriptionRef`;--> statement-breakpoint
ALTER TABLE `users` MODIFY `openId` varchar(128) NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `revenuecatProductId` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `revenuecatExpiresAt` timestamp NULL;
