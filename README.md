# Youngpreneur Square — the live site + backend

This folder is the whole thing, ready to push to GitHub and go live. Lowest-cost stack, all free tiers except Stripe (which only costs you when you actually get paid).

```
youngpreneur-square-site/
├── index.html                      ← the website (deploy this)
├── ignition-day.html               ← the held Ignition Day page (optional to publish)
├── README.md                       ← you are here
├── GO-LIVE.md                      ← the click-by-click launch runbook
└── supabase/
    ├── schema.sql                  ← paste into Supabase SQL Editor → builds the whole database
    └── functions/
        └── stripe-webhook/
            └── index.ts            ← flips a space to "Leased" when someone subscribes
```

## The stack (and why)

| Piece | Tool | Cost | Does |
|---|---|---|---|
| Code | **GitHub** | free | source of truth + free version history (your backup) |
| Hosting | **Cloudflare Pages** | free, unlimited bandwidth | serves the site, auto-deploys on every push |
| Database + logic | **Supabase** | free tier | live directory, leases, weekly board, votes |
| Payments | **Stripe** | 2.9% + 30¢ per charge, no monthly | subscriptions with a 30-day free trial ("first month free") |
| Email list | **Brevo** | free (~300/day) | captures First Flight signups |
| Business inbox | **Zoho Mail** | free | your info@ address |

The only paid upgrade worth knowing about: **Supabase Pro ($25/mo)** adds automated daily database backups and stops the free project from pausing after long idle. You won't need it until you have real, paying tenants — GitHub already backs up the site and `schema.sql` rebuilds the database structure any time.

## How it works once it's on

The site is a single static page. When Supabase is connected, the **directory and the Now Boarding board load live from your database** — and they fall back to built-in demo data if it isn't, so the page never looks broken. When a visitor subscribes through a Stripe Payment Link (first month free), Stripe calls the **`stripe-webhook`** function, which grabs the next open address on that tier's street, flips it to **Leased**, and records the tenant — so the directory updates itself. Cancelling frees the space again.

Follow **GO-LIVE.md** to turn it on. You can stop after any step and still have a real, live site.
