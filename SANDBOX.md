# Open sandbox (phone + login)

## 1. Apply database schema (required once)

Tables are still missing on `aravfgeswpnnceujngmb` until you run SQL:

1. Open https://supabase.com/dashboard/project/aravfgeswpnnceujngmb/sql/new
2. Paste contents of `supabase/bootstrap_aravfges.sql`
3. Run

## 2. Allow phone login (Auth settings)

In https://supabase.com/dashboard/project/aravfgeswpnnceujngmb/auth/providers :

- **Email** → turn **OFF** “Confirm email” (sandbox)

In https://supabase.com/dashboard/project/aravfgeswpnnceujngmb/auth/url-configuration :

- **Site URL:** `http://192.168.1.223:8080` (or your tunnel URL)
- **Redirect URLs** (add all):
  - `http://localhost:8080/**`
  - `http://192.168.1.223:8080/**`
  - `https://*.loca.lt/**` (if using localtunnel)

## 4. Create platform admin

1. Apply latest migrations (including admin role) via SQL Editor or `db push`
2. Open `/admin/setup`
3. Enter **display name**, **email** (for login + password reset), and **password**
4. You land on `/admin` dashboard

Forgot password: `/auth?mode=forgot` → email link → `/auth?mode=reset`

## 3. Open on iPhone (same Wi‑Fi)

1. PC: `npm run dev` (already binds to LAN)
2. iPhone Safari: `http://192.168.1.223:8080/auth?mode=signup`
3. Sign up as **DJ** (or Guest)

Public tunnel (optional, works off Wi‑Fi):

```sh
npx localtunnel --port 8080
```

Add the printed `https://….loca.lt` URL to Supabase Redirect URLs, then open that link on the phone.
