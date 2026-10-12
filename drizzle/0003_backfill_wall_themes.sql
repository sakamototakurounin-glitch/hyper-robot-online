UPDATE `rooms` SET `wall_theme` = abs(random()) % 16 WHERE `current_round_id` IS NULL;
