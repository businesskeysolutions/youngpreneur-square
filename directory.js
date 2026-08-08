  // ================= LAUNCH WIRING (newsletter + lease links) =================
  (function(){
    const cfg = window.SQUARE_CONFIG || (window.SQUARE_CONFIG = {});
    const links = cfg.stripeLinks || {};
    // Some on-page names differ from config keys — map them here.
    // Hangar lot headings differ from config keys — map them here.
    const LOT_KEY = { 'Front Row': 'Front Row Lot' };   // Hangar "Front Row" -> "Front Row Lot"
    function wire(btn, key){
      const link = key && links[key];
      if(link){ btn.href = link; btn.target = '_blank'; btn.rel = 'noopener'; }
      else { btn.href = 'lease.html#join'; }                       // fall back to the First Flight waitlist
    }
    // Hangar / directory lease buttons (href="#" placeholders): map by lot heading.
    document.querySelectorAll('.lease-btn').forEach(function(btn){
      if(btn.getAttribute('href') !== '#') return;            // leave real "Visit shop" links alone
      const lot = btn.closest('.lot');
      const name = lot && lot.querySelector('h3') ? lot.querySelector('h3').textContent.trim() : '';
      wire(btn, LOT_KEY[name] || name);
    });
    // Pricing "Start free" buttons carry an explicit data-lease key (exact config key).
    document.querySelectorAll('.p-btn[data-lease]').forEach(function(btn){
      wire(btn, btn.getAttribute('data-lease'));
    });
    // Newsletter / waitlist form
    const form = document.getElementById('joinForm'), msg = document.getElementById('joinMsg');
    if(form){
      if(cfg.newsletterAction){
        form.action = cfg.newsletterAction; form.method = 'post'; form.target = 'sqHidden';
        if(!document.getElementById('sqHidden')){
          const f = document.createElement('iframe'); f.name = 'sqHidden'; f.id = 'sqHidden';
          f.style.display = 'none'; document.body.appendChild(f);
        }
      }
      form.addEventListener('submit', function(e){
        const input = form.querySelector('input[type=email]');
        const email = input ? input.value.trim() : '';
        if(!email || email.indexOf('@') < 1){ e.preventDefault(); msg.textContent = 'Enter a valid email.'; msg.classList.add('show'); return; }
        if(!cfg.newsletterAction){ e.preventDefault(); form.reset(); }   // demo mode until an email service is connected
        msg.textContent = "You're on the list — we'll be in touch. ✦";
        msg.classList.add('show');
      });
    }
  })();
