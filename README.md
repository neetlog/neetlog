# NEETlog 🎀

A responsive personal NEET study tracker. Built with React, Vite and Supabase Auth + PostgreSQL. The app has no demo mode or seeded activity: study statistics are calculated from sessions, tasks and chapters that the signed-in person records.

## Run locally

1. Create a Supabase project.
2. In the Supabase SQL Editor, run [`supabase/schema.sql`](supabase/schema.sql). It creates the private tables, row-level security policies and profile-on-signup trigger.
3. In Supabase Authentication → URL Configuration, set the Site URL to your local address (for example `http://localhost:5173`) and allow that URL as a redirect URL.
4. Copy `.env.example` to `.env.local` and enter the project URL and publishable/anon key. Never put a service-role key in this client app.
5. Run `pnpm install`, then `pnpm dev` (or use the equivalent npm commands).
6. Build for deployment with `pnpm build`; configure the same two public environment variables on the host.

New accounts must confirm their email before first login when email confirmation is enabled. Password reset links return to the configured Site URL.

For an existing deployment, run [`supabase/migrations/20260925_study_session_stopwatch.sql`](supabase/migrations/20260925_study_session_stopwatch.sql) in the Supabase SQL Editor before deploying the updated frontend. It converts prior minute-based sessions to exact seconds and preserves their totals. Fresh projects should use the current `supabase/schema.sql` instead.

## Features

- Private email/password accounts, persistent Supabase sessions, email confirmation and password reset.
- Individual profile and target year.
- Personal chapter status and progress for all six subjects; tracked progress is saved per account.
- Task creation, editing, completion, deletion, subject/chapter association, and due-date views.
- Unlimited stopwatch with start, pause, resume and Finish Study; exact elapsed seconds are saved to the account's study history.
- Dashboard and progress summary computed from recorded data, including weekly time and streaks.
- Responsive sidebar and mobile navigation.

RLS policies bind every profile, chapter, task and session to `auth.uid()`. Do not expose a Supabase service-role key to the browser.
