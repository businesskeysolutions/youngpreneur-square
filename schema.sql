  /* ===== EDIT THESE WHEN YOU GO LIVE — see the setup guide ===== */
  window.SQUARE_CONFIG = {
    /* 0) Supabase — the live backend. Paste your Project URL and the ANON
          (public) key from Supabase → Project Settings → API. With these set,
          the directory and the Now Boarding board load live from your database
          and update the moment a lease completes. Leave "" and the site falls
          back to its built-in demo data, so it always works. */
    supabaseUrl: "https://mbgkersuwjrpsenktpyu.supabase.co",
    supabaseAnonKey: "sb_publishable_uYsccCCejduUbWLhzyZCvw_eOOuYrIz",

    /* 1) Paste your Brevo signup-form ACTION url here so the First Flight
          signup captures real emails. (Brevo → Contacts → Forms → your form →
          Share → copy the <form action="..."> url.) Leave "" for demo mode. */
    newsletterAction: "",

    /* 2) Paste a Stripe Payment Link for each lease tier. Create each product
          in Stripe as a recurring subscription with a 30-day free trial
          ("first month free"), then paste its Payment Link URL below.
          Any key left "" falls back to the First Flight waitlist (#join),
          so the site works today and gets "live" one paste at a time.
          The keys must match the tier names on the page exactly. */
    stripeLinks: {
      /* --- The base · monthly addresses --- */
      "Ground Level": "",     /* Takeoff Lane   · $19/mo First Flight */
      "Main Strip":   "",     /* The Runway     · $49/mo First Flight */
      "Growth":       "",     /* Ascend Avenue  · $99/mo First Flight */
      "Front Row":    "",     /* First Class Row· $199/mo First Flight */
      /* --- The Stage · weekly rotating --- */
      "The Tower":    "",     /* $199/week First Flight */
      /* --- The Hangar · dealership lots (District 02) --- */
      "Front Row Lot":   "",  /* $149/mo */
      "Showcase Pad":    "",  /* $99/mo  */
      "Center Aisle":    "",  /* $79/mo  */
      "Back Row Bay":    ""   /* $49/mo  */
    },

    /* 3) Demo countdown length for The Tower ball-drop (seconds). */
    ballDropSeconds: 10
  };

  /* Create the Supabase client once, if configured. window.SQ_DB is null in
     demo mode, and every feature checks for it before using live data. */
  window.SQ_DB = null;
  (function(){
    var c = window.SQUARE_CONFIG;
    if(c && c.supabaseUrl && c.supabaseAnonKey && window.supabase){
      try { window.SQ_DB = window.supabase.createClient(c.supabaseUrl, c.supabaseAnonKey); }
      catch(e){ console.warn('Supabase init failed — using demo data.', e); }
    }
  })();
