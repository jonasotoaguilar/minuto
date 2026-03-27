ALTER TABLE public.organizations ADD COLUMN default_timezone text;
UPDATE public.organizations SET default_timezone = 'America/Santiago' WHERE default_timezone IS NULL;
ALTER TABLE public.organizations ALTER COLUMN default_timezone SET DEFAULT 'America/Santiago';
ALTER TABLE public.organizations ALTER COLUMN default_timezone SET NOT NULL;
