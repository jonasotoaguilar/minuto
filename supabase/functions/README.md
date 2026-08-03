# Supabase Edge Functions

There are **no Edge Functions** in this project.

Database SQL functions (RPCs) are the backend layer and are versioned through `supabase/migrations/*.sql`. Schema, RPC, RLS, or migration work must read the migration history first and must not edit pushed migrations.

The `functions/` directory is kept for future Edge Functions if workflows outgrow SQL RPCs or require external integrations.
