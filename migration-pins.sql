-- Run this in Supabase SQL Editor to create the pins/boards tables
-- 1. Go to https://supabase.com/dashboard/project/fgitsanuwzelslkzihtn/sql/new
-- 2. Paste and run this entire file
-- 3. After migration, the /api/boards and /api/boards/:id/pins routes will work

CREATE TABLE IF NOT EXISTS boards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  board_id UUID NOT NULL REFERENCES boards(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL,  -- 'playlist', 'race', 'route', 'resource', 'gear'
  item_id TEXT NOT NULL,    -- URL slug or external ID
  item_title TEXT NOT NULL,
  item_url TEXT NOT NULL,
  item_description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_boards_user_id ON boards(user_id);
CREATE INDEX IF NOT EXISTS idx_pins_board_id ON pins(board_id);
CREATE INDEX IF NOT EXISTS idx_pins_user_id ON pins(user_id);

ALTER TABLE boards ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public boards are viewable by everyone" ON boards FOR SELECT USING (is_public = true OR auth.uid() = user_id);
CREATE POLICY "Users can manage own boards" ON boards FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Pins on public boards are viewable" ON pins FOR SELECT USING (EXISTS (SELECT 1 FROM boards WHERE boards.id = pins.board_id AND (boards.is_public = true OR boards.user_id = auth.uid())));
CREATE POLICY "Users can manage pins on own boards" ON pins FOR ALL USING (auth.uid() = user_id);