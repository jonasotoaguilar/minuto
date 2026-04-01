-- Remove account enumeration vector: this RPC exposed whether an email
-- was registered to unauthenticated callers.
-- Email uniqueness is already enforced by Supabase Auth on signup.
revoke execute on function public.check_registration_availability(text) from anon;
revoke execute on function public.check_registration_availability(text) from authenticated;
drop function if exists public.check_registration_availability(text);
