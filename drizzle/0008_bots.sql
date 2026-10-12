ALTER TABLE players ADD COLUMN bot_level integer NOT NULL DEFAULT 0;
ALTER TABLE players ADD COLUMN bot_traits text;
ALTER TABLE submissions ADD COLUMN receipt_token text;
CREATE TABLE bot_rounds (round_id text NOT NULL, player_id text NOT NULL, plan_json text NOT NULL, think_json text, updated_at integer NOT NULL DEFAULT 0, PRIMARY KEY(round_id,player_id));
