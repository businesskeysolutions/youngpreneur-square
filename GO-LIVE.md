// =============================================================
// YOUNGPRENEUR SQUARE — Stripe webhook (Supabase Edge Function)
// When a lease subscription is created (incl. free-trial signups),
// this assigns the next open address on the Square and records the
// tenant + lease. When a subscription is canceled, it frees the space.
//
// Deploy:   supabase functions deploy stripe-webhook --no-verify-jwt
// Secrets:  supabase secrets set STRIPE_SECRET_KEY=sk_live_... \
//                               STRIPE_WEBHOOK_SECRET=whsec_...
//           (SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided
//            automatically by Supabase to Edge Functions.)
// Stripe:   add a webhook endpoint pointing at this function's URL,
//           subscribed to:  checkout.session.completed,
//           customer.subscription.deleted
// Payment Links: set metadata "square_tier" to the tier's config key
//           (e.g. "Main Strip"), and add two custom fields so we capture
//           the tenant — a text field keyed "business_name" and one keyed
//           "shop_url".
// =============================================================

import Stripe from "https://esm.sh/stripe@16?target=deno";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2?target=deno";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
  apiVersion: "2024-06-20",
  httpClient: Stripe.createFetchHttpClient(),
});
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } },
);

// Pull a Payment Link custom field value by its key.
function customField(session: Stripe.Checkout.Session, key: string): string {
  const f = (session.custom_fields ?? []).find((c) => c.key === key);
  return (f?.text?.value ?? "").trim();
}

Deno.serve(async (req) => {
  const sig = req.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });

  let event: Stripe.Event;
  try {
    const body = await req.text();
    // Async variant — required on Deno (no Node crypto).
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    console.error("Signature verification failed:", (err as Error).message);
    return new Response("Bad signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;

      // Only act on subscription checkouts (our leases).
      if (session.mode !== "subscription" || !session.subscription) {
        return json({ ignored: session.mode });
      }

      const tier = (session.metadata?.square_tier ?? "").trim();
      const business = customField(session, "business_name") ||
        (session.customer_details?.name ?? "");
      const shopUrl = customField(session, "shop_url");
      const email = session.customer_details?.email ?? "";
      const customerId = typeof session.customer === "string"
        ? session.customer
        : session.customer?.id ?? "";
      const subId = typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;

      // Fetch the subscription for the trial end (drives "first month free").
      const sub = await stripe.subscriptions.retrieve(subId);
      const trialEnd = sub.trial_end
        ? new Date(sub.trial_end * 1000).toISOString()
        : null;

      const { data, error } = await supabase.rpc("lease_next_space", {
        p_tier: tier,
        p_business: business,
        p_shop_url: shopUrl,
        p_email: email,
        p_customer_id: customerId,
        p_sub_id: subId,
        p_trial_end: trialEnd,
      });
      if (error) throw error;
      console.log("Leased:", tier, "->", data);
      return json({ ok: true, lease: data });
    }

    if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      const { error } = await supabase.rpc("release_lease", { p_sub_id: sub.id });
      if (error) throw error;
      console.log("Released:", sub.id);
      return json({ ok: true, released: sub.id });
    }

    return json({ ignored: event.type });
  } catch (err) {
    console.error("Handler error:", (err as Error).message);
    // 500 tells Stripe to retry — safe because lease_next_space is idempotent.
    return new Response("Handler error", { status: 500 });
  }
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
