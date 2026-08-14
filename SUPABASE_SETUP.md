# Supabase setup — 10-report pack (Brief 2)

One-time setup. ~5 minutes. Free tier is fine for build/test.

## 1. Create the project
1. Go to **https://supabase.com** → sign in (GitHub is quickest) → **New project**.
2. Pick your org, name it `lores` (anything), set a strong **database password** (save it somewhere — you won't need it for the app, but Supabase asks).
3. Region: pick the closest to you (e.g. **Mumbai** / South Asia).
4. Click **Create new project** and wait ~1–2 min for it to provision.

## 2. Run the migration
1. Left sidebar → **SQL Editor** → **New query**.
2. Open `supabase/migrations/0001_pack_credits.sql` in this repo, copy the whole file, paste it in.
3. Click **Run**. You should see "Success. No rows returned."
   - This creates the `pack_credits` table, locks it with RLS, and installs the atomic
     `claim_pack` / `spend_pack_credit` / `total_pack_credits` functions.

## 3. Get the three keys
Left sidebar → **Project Settings** (gear) → **API**.
- **Project URL** → this is `SUPABASE_URL`
- **Project API keys → `anon` `public`** → this is `SUPABASE_ANON_KEY`
- **Project API keys → `service_role` `secret`** → this is `SUPABASE_SERVICE_ROLE_KEY`
  - ⚠️ This one is a **secret**. It goes only in `.env.local` (gitignored). Never paste it into
    chat, commit it, or expose it to the browser.

## 4. Add them to `.env.local`
Append these lines to `C:\dev\lore\.env.local` (create the entries if missing), pasting your
actual values. The `NEXT_PUBLIC_*` pair is the **same** URL + anon key again (Next only ships
`NEXT_PUBLIC_*` vars to the browser, which Auth needs):

```
SUPABASE_URL=https://YOURPROJECT.supabase.co
SUPABASE_ANON_KEY=eyJ...your-anon-key...
SUPABASE_SERVICE_ROLE_KEY=eyJ...your-service-role-key...

NEXT_PUBLIC_SUPABASE_URL=https://YOURPROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...your-anon-key...

DEV_COMP_SECRET=pick-any-long-random-string
```

## 5. (Optional) Allow instant test signups
By default Supabase Auth may require email confirmation, which blocks the "success screen IS
signup" flow in local testing. To test without a mail provider:
- **Authentication** → **Providers** → **Email** → turn **Confirm email** *off* (for the build
  window; turn it back on later if you add email).

That's it — tell me when the keys are in `.env.local` and I'll wire the UI and we'll test the full
buy → signup → claim → spend → log out → log back in → generate → decrement flow against your
project.
