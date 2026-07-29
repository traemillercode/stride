-- Run this in Supabase SQL Editor to create the community circles tables
-- 1. Go to https://supabase.com/dashboard/project/fgitsanuwzelslkzihtn/sql/new
-- 2. Paste and run this entire file
-- 3. After migration, the /api/circles routes will work

CREATE TABLE IF NOT EXISTS circles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT true,
  join_code TEXT UNIQUE,
  member_count INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS circle_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  circle_id UUID NOT NULL REFERENCES circles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(circle_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_circles_creator_id ON circles(creator_id);
CREATE INDEX IF NOT EXISTS idx_circles_is_public ON circles(is_public);
CREATE INDEX IF NOT EXISTS idx_circles_member_count ON circles(member_count DESC);
CREATE INDEX IF NOT EXISTS idx_circle_members_circle_id ON circle_members(circle_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_user_id ON circle_members(user_id);
CREATE INDEX IF NOT EXISTS idx_circle_members_role ON circle_members(circle_id, role);

ALTER TABLE circles ENABLE ROW LEVEL SECURITY;
ALTER TABLE circle_members ENABLE ROW LEVEL SECURITY;

-- circles: public circles visible to everyone; private circles visible only to members
CREATE POLICY "Public circles are viewable by everyone" ON circles FOR SELECT USING (is_public = true);
CREATE POLICY "Private circles are viewable by their members" ON circles FOR SELECT
  USING (is_public = false AND EXISTS (
    SELECT 1 FROM circle_members WHERE circle_members.circle_id = circles.id AND circle_members.user_id = auth.uid()
  ));
CREATE POLICY "Circles can be created by authenticated users" ON circles FOR INSERT WITH CHECK (auth.uid() = creator_id);
CREATE POLICY "Circle owners can update their circles" ON circles FOR UPDATE USING (auth.uid() = creator_id);
CREATE POLICY "Circle owners can delete their circles" ON circles FOR DELETE USING (auth.uid() = creator_id);

-- circle_members: visible to circle members (for private circles) or anyone (for public circles)
CREATE POLICY "Members of public circles are viewable by everyone" ON circle_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM circles WHERE circles.id = circle_members.circle_id AND circles.is_public = true));
CREATE POLICY "Members of private circles are viewable by members" ON circle_members FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM circles WHERE circles.id = circle_members.circle_id AND circles.is_public = false
    AND EXISTS (SELECT 1 FROM circle_members cm WHERE cm.circle_id = circles.id AND cm.user_id = auth.uid())
  ));
CREATE POLICY "Authenticated users can join circles" ON circle_members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can leave circles" ON circle_members FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Circle owners can manage members" ON circle_members FOR ALL
  USING (EXISTS (SELECT 1 FROM circles WHERE circles.id = circle_members.circle_id AND circles.creator_id = auth.uid()));
