ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS include_stamp_duty boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.include_stamp_duty IS
  'Preferenza profilo: addebita il bollo da 2 euro nelle fatture quando ricorrono le condizioni.';
