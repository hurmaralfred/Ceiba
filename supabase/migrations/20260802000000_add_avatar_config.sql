-- Add avatar_config column to profiles for the avatar builder feature.
-- Stores user-selected appearance params: gender, skinTone, hairStyle, hairColor, eyeColor.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_config jsonb;
