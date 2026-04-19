-- Add archived flag to books for swipe-to-archive flow.
-- Default false so existing books stay visible in the library.
ALTER TABLE `books` ADD `archived` boolean DEFAULT false NOT NULL;
