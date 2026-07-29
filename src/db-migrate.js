// Database migration script — creates tables for social profiles
// Uses the 'postgres' npm module for direct PostgreSQL connection
const postgres = require('postgres');
const fs = require('fs');
const path = require('path');

// Parse .env manually
const envPath = path.join(__dirname, '..', '.env');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
  const eqIdx = line.indexOf('=');
  if (eqIdx > 0 && !line.startsWith('#')) {
    env[line.substring(0, eqIdx).trim()] = line.substring(eqIdx + 1).trim();
  }
});

const SUPABASE_URL = env.SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

// Extract project ref from URL: https://<ref>.supabase.co
const projectRef = new URL(SUPABASE_URL).hostname.split('.')[0];

// Try multiple connection approaches
const connectionOptions = [
  // Connection pooler (session mode)
  {
    name: 'pooler-session',
    url: `postgresql://postgres.${projectRef}:${encodeURIComponent(SERVICE_ROLE_KEY)}@aws-0-us-east-1.pooler.supabase.co:5432/postgres`,
  },
  // Direct connection
  {
    name: 'direct',
    url: `postgresql://postgres:${encodeURIComponent(SERVICE_ROLE_KEY)}@db.${projectRef}.supabase.co:5432/postgres`,
  },
  // Pooler transaction mode
  {
    name: 'pooler-txn',
    url: `postgresql://postgres.${projectRef}:${encodeURIComponent(SERVICE_ROLE_KEY)}@aws-0-us-east-1.pooler.supabase.co:6543/postgres`,
  },
];

async function migrate() {
  let sql;

  for (const opt of connectionOptions) {
    try {
      console.log(`Trying connection: ${opt.name}...`);
      sql = postgres(opt.url, {
        connect_timeout: 10,
        idle_timeout: 5,
        max: 1,
        ssl: 'require',
      });
      // Test the connection
      const result = await sql`SELECT 1 as test`;
      console.log(`Connected via ${opt.name}! Result:`, result);
      break;
    } catch (err) {
      console.log(`  Failed: ${err.message}`);
      if (sql) await sql.end().catch(() => {});
      sql = null;
    }
  }

  if (!sql) {
    console.error('Could not connect to database via any method.');
    console.log('Will create a SQL migration file instead.');
    createMigrationFile();
    return;
  }

  try {
    console.log('Creating tables...');

    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        bio TEXT,
        avatar_url TEXT,
        created_at TIMESTAMPTZ DEFAULT now()
      );
    `;
    console.log('  ✓ users table');

    // Create activities table
    await sql`
      CREATE TABLE IF NOT EXISTS activities (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        distance_mi DOUBLE PRECISION,
        duration_secs INTEGER,
        avg_pace_secs INTEGER,
        elevation_ft INTEGER,
        route_name TEXT,
        source TEXT NOT NULL DEFAULT 'manual',
        is_auto_posted BOOLEAN NOT NULL DEFAULT false,
        posted_at TIMESTAMPTZ DEFAULT now()
      );
    `;
    console.log('  ✓ activities table');

    // Create follows table
    await sql`
      CREATE TABLE IF NOT EXISTS follows (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMPTZ DEFAULT now(),
        UNIQUE(follower_id, following_id)
      );
    `;
    console.log('  ✓ follows table');

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_activities_posted_at ON activities(posted_at DESC);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);`;
    console.log('  ✓ indexes');

    // Enable Row Level Security
    await sql`ALTER TABLE users ENABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE activities ENABLE ROW LEVEL SECURITY;`;
    await sql`ALTER TABLE follows ENABLE ROW LEVEL SECURITY;`;

    // RLS policies: anyone can read, only owner can write
    await sql`CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);`;
    await sql`CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);`;
    await sql`CREATE POLICY "Activities are viewable by everyone" ON activities FOR SELECT USING (true);`;
    await sql`CREATE POLICY "Users can insert own activities" ON activities FOR INSERT WITH CHECK (auth.uid() = user_id);`;
    await sql`CREATE POLICY "Users can delete own activities" ON activities FOR DELETE USING (auth.uid() = user_id);`;
    await sql`CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);`;
    await sql`CREATE POLICY "Users can manage own follows" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);`;
    await sql`CREATE POLICY "Users can remove own follows" ON follows FOR DELETE USING (auth.uid() = follower_id);`;
    console.log('  ✓ RLS policies');

    console.log('Migration complete!');
  } catch (err) {
    console.error('Migration failed:', err.message);
  } finally {
    await sql.end();
  }
}

function createMigrationFile() {
  const fs = require('fs');
  const path = require('path');
  const sql_content = `
-- Run this in Supabase SQL Editor to create the social profiles tables
-- 1. Go to https://supabase.com/dashboard/project/${projectRef}/sql/new

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  bio TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  distance_mi DOUBLE PRECISION,
  duration_secs INTEGER,
  avg_pace_secs INTEGER,
  elevation_ft INTEGER,
  route_name TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  is_auto_posted BOOLEAN NOT NULL DEFAULT false,
  posted_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS follows (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(follower_id, following_id)
);

CREATE INDEX IF NOT EXISTS idx_activities_user_id ON activities(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_posted_at ON activities(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);

ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users are viewable by everyone" ON users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Activities are viewable by everyone" ON activities FOR SELECT USING (true);
CREATE POLICY "Users can insert own activities" ON activities FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete own activities" ON activities FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "Follows are viewable by everyone" ON follows FOR SELECT USING (true);
CREATE POLICY "Users can manage own follows" ON follows FOR INSERT WITH CHECK (auth.uid() = follower_id);
CREATE POLICY "Users can remove own follows" ON follows FOR DELETE USING (auth.uid() = follower_id);
`;
  fs.writeFileSync(path.join(__dirname, '..', 'migration.sql'), sql_content.trim());
  console.log('migration.sql written — please run it in the Supabase SQL Editor.');
}

migrate().catch(console.error);
