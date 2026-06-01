-- Rollback: remove JSONB columns from maps table
-- Run this in Supabase SQL Editor if you need to revert the migration

ALTER TABLE public.maps
DROP COLUMN IF EXISTS node_rich_text,
DROP COLUMN IF EXISTS node_notes,
DROP COLUMN IF EXISTS node_radius;
