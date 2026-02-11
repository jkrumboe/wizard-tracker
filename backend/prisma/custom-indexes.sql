-- Partial unique index: ONE non-deleted identity per userId (matches MongoDB behavior)
CREATE UNIQUE INDEX IF NOT EXISTS "unique_user_active_identity"
  ON "PlayerIdentity" ("userId")
  WHERE "isDeleted" = false AND "userId" IS NOT NULL;

-- GIN indexes for JSONB player identity lookups in game data
CREATE INDEX IF NOT EXISTS "idx_wizard_game_players_gin"
  ON "WizardGame" USING GIN (("gameData"->'players') jsonb_path_ops);

CREATE INDEX IF NOT EXISTS "idx_table_game_players_gin"
  ON "TableGame" USING GIN (("gameData"->'players') jsonb_path_ops);

-- GIN index on ELO data for leaderboard queries
CREATE INDEX IF NOT EXISTS "idx_identity_elo_gin"
  ON "PlayerIdentity" USING GIN ("eloData" jsonb_path_ops);
