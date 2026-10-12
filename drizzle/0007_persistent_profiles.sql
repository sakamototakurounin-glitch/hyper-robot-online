ALTER TABLE `players` ADD COLUMN `profile_id` text;
CREATE INDEX `idx_players_profile_id` ON `players` (`profile_id`);
PRAGMA optimize;
