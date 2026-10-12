ALTER TABLE `rooms` ADD COLUMN `win_points` integer DEFAULT 5 NOT NULL;
ALTER TABLE `rooms` ADD COLUMN `optimal_points` integer DEFAULT 0 NOT NULL;
