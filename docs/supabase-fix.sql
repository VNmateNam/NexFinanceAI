-- ============================================================
-- NexusAI — Supabase Fix Script
-- Run this in Supabase SQL Editor if you get:
-- "Database error creating new user"
--
-- This replaces the broken trigger with a robust version
-- that handles all signup methods (email, magic link, OAuth)
-- ============================================================

-- ── Step 1: Drop old broken trigger + function ────────────────
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user();

-- ── Step 2: Recreate profiles table safely ───────────────────
-- (skips if already exists — safe to run multiple times)
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID    PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT,                        -- nullable: magic links may not have email immediately
  full_name   TEXT,
  avatar_url  TEXT,
  plan        TEXT    NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'pro', 'enterprise')),
  is_admin    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Step 3: New robust trigger function ──────────────────────
-- SECURITY DEFINER = runs as the function owner (postgres), bypasses RLS
-- This is the correct pattern for auth triggers in Supabase
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public   -- prevent search_path injection
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, plan, is_admin)
  VALUES (
    NEW.id,
    COALESCE(NEW.email, ''),                             -- handle magic-link / OAuth null email
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),  -- from signUp({ data: { full_name } })
    'free',
    FALSE
  )
  ON CONFLICT (id) DO UPDATE SET                         -- idempotent: safe if trigger fires twice
    email      = EXCLUDED.email,
    full_name  = COALESCE(EXCLUDED.full_name, profiles.full_name),
    updated_at = NOW();

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Log the error but DO NOT raise it — never block user creation
  RAISE LOG 'handle_new_user error for %: %', NEW.id, SQLERRM;
  RETURN NEW;
END;
$$;

-- ── Step 4: Recreate trigger ──────────────────────────────────
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ── Step 5: Grant execute permission ─────────────────────────
-- The authenticated role needs to be able to call this
GRANT EXECUTE ON FUNCTION handle_new_user() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;

-- ── Step 6: Fix RLS policies on profiles ─────────────────────
-- Drop old ones first (ignore errors if they don't exist)
DROP POLICY IF EXISTS "Users can view own profile"    ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"  ON profiles;
DROP POLICY IF EXISTS "Admins can view all profiles"  ON profiles;
DROP POLICY IF EXISTS "Service role full access"      ON profiles;

-- Allow users to see and update their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- CRITICAL: Allow the trigger (service_role) to INSERT new profiles
-- Without this, the trigger gets blocked by RLS even with SECURITY DEFINER
CREATE POLICY "profiles_insert_service"
  ON profiles FOR INSERT
  TO service_role
  WITH CHECK (TRUE);

-- Also allow authenticated users to insert their own (for manual upserts)
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Admins can see all profiles
CREATE POLICY "profiles_select_admin"
  ON profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid() AND p.is_admin = TRUE
    )
  );

-- ── Step 7: Make sure RLS is enabled ─────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- ── Step 8: Backfill any existing auth users missing a profile ─
-- (safe to run: ON CONFLICT does nothing if profile already exists)
INSERT INTO public.profiles (id, email, full_name, plan, is_admin)
SELECT
  id,
  COALESCE(email, ''),
  COALESCE(raw_user_meta_data->>'full_name', ''),
  'free',
  FALSE
FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- ── Step 9: Set your admin user ──────────────────────────────
-- Replace 'your-email@example.com' with YOUR email, then run this:
--
-- UPDATE profiles SET is_admin = TRUE
-- WHERE email = 'your-email@example.com';
--
-- Or by user ID:
-- UPDATE profiles SET is_admin = TRUE
-- WHERE id = 'paste-your-user-uuid-here';

-- ── Verify everything is working ─────────────────────────────
SELECT
  'Trigger exists' AS check,
  COUNT(*) > 0     AS passed
FROM information_schema.triggers
WHERE trigger_name = 'on_auth_user_created'

UNION ALL

SELECT
  'Profiles table exists',
  COUNT(*) > 0
FROM information_schema.tables
WHERE table_name = 'profiles' AND table_schema = 'public'

UNION ALL

SELECT
  'RLS enabled on profiles',
  rowsecurity
FROM pg_tables
WHERE tablename = 'profiles' AND schemaname = 'public';
