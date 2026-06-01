-- Migration: add JSONB columns to maps table
-- Run this in Supabase SQL Editor

ALTER TABLE public.maps
ADD COLUMN IF NOT EXISTS node_radius jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS node_notes jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS node_rich_text jsonb DEFAULT '{}'::jsonb;
