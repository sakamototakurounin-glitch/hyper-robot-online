ALTER TABLE `rooms` ADD COLUMN `first_submit_seconds` integer DEFAULT 60 NOT NULL;
ALTER TABLE `rooms` ADD COLUMN `optimal_bonus` integer DEFAULT 0 NOT NULL;
ALTER TABLE `rooms` ADD COLUMN `total_rounds` integer DEFAULT 5 NOT NULL;
ALTER TABLE `rooms` ADD COLUMN `round_limit_seconds` integer DEFAULT 300 NOT NULL;
ALTER TABLE `rounds` ADD COLUMN `round_start_time` integer;
ALTER TABLE `rounds` ADD COLUMN `max_deadline` integer;
ALTER TABLE `rounds` ADD COLUMN `participant_count` integer DEFAULT 1 NOT NULL;
ALTER TABLE `rounds` ADD COLUMN `stats_category` text DEFAULT 'solo' NOT NULL;
ALTER TABLE `rounds` ADD COLUMN `finalized_at` integer;
ALTER TABLE `rounds` ADD COLUMN `stats_updated` integer DEFAULT 0 NOT NULL;
ALTER TABLE `rounds` ADD COLUMN `result_json` text;
ALTER TABLE `submissions` ADD COLUMN `search_time_ms` integer DEFAULT 0 NOT NULL;

CREATE TABLE `player_rounds` (
  `round_id` text NOT NULL,
  `player_id` text NOT NULL,
  `best_moves` integer,
  `best_at` integer,
  `best_search_ms` integer,
  `first_moves` integer,
  `first_at` integer,
  `first_search_ms` integer,
  `ever_leader` integer DEFAULT 0 NOT NULL,
  `optimal_found` integer DEFAULT 0 NOT NULL,
  `answering` integer DEFAULT 0 NOT NULL,
  `leader_lost_at` integer,
  PRIMARY KEY (`round_id`,`player_id`)
);
CREATE INDEX `idx_player_rounds_rank` ON `player_rounds` (`round_id`,`best_moves`,`best_search_ms`,`best_at`);

CREATE TABLE `player_stats` (
  `player_id` text NOT NULL,
  `category` text NOT NULL,
  `total_rounds` integer DEFAULT 0 NOT NULL,
  `wins` integer DEFAULT 0 NOT NULL,
  `provisional_leader_rounds` integer DEFAULT 0 NOT NULL,
  `registered_round_count` integer DEFAULT 0 NOT NULL,
  `total_optimal_difference` integer DEFAULT 0 NOT NULL,
  `total_first_register_ms` integer DEFAULT 0 NOT NULL,
  `first_register_count` integer DEFAULT 0 NOT NULL,
  `optimal_found_rounds` integer DEFAULT 0 NOT NULL,
  PRIMARY KEY (`player_id`,`category`)
);
PRAGMA optimize;
