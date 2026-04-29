-- Migration: Add is_hidden flag to motions table
-- When is_hidden = true, the motion stays in the database but is not shown to delegates.
-- Admins can still see hidden motions and toggle visibility.

ALTER TABLE public.motions
  ADD COLUMN IF NOT EXISTS is_hidden BOOLEAN NOT NULL DEFAULT false;

-- Index for efficient filtering on the common query pattern
CREATE INDEX IF NOT EXISTS idx_motions_is_hidden ON public.motions (is_hidden);
