// ============ SETTINGS — edit these ============
const SITE = {
  phoneDisplay: "704-232-2700",
  phoneTel: "+17042322700",
  smsTel: "+19803855988",           // GHL number (980-385-5988) — texts land in GHL Conversations; calls to it forward to 704-232-2700
  address: "2733 E Ozark Ave",
  city: "Gastonia, NC",
  mapsUrl: "https://www.google.com/maps/dir/?api=1&destination=" + encodeURIComponent("USA Liquidation, 2733 E Ozark Ave, Gastonia, NC"),
  mapEmbed: "https://maps.google.com/maps?q=" + encodeURIComponent("USA Liquidation, 2733 E Ozark Ave, Gastonia, NC") + "&z=15&output=embed",
  email: "gastoniallc@gmail.com",
  hours: {                          // Monday closed
    Monday: null,
    Tuesday: "9am – 6pm", Wednesday: "9am – 6pm", Thursday: "9am – 6pm",
    Friday: "9am – 6pm", Saturday: "9am – 6pm", Sunday: "9am – 6pm",
  },
};
// ===============================================

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TODAY = DAYS[new Date().getDay()];
const PAGE = document.body.dataset.page || "home";

const icon = {
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.6 8.6 0 0 1-3.8-.9L3 21l2-5.1A8.4 8.4 0 0 1 12 3a8.4 8.4 0 0 1 9 8.5z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
};

// Build a "text us" link with a pre-filled message
function smsLink(msg) {
  const sep = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) ? "&" : "?";
  return `sms:${SITE.smsTel}${sep}body=${encodeURIComponent(msg)}`;
}
const telLink = () => `tel:${SITE.phoneTel}`;

// ---------- header ----------
const navItems = [
  ["home", "index.html", "Home"],
  ["furniture", "furniture.html", "Furniture"],
  ["bins", "bins.html", "Bins"],
  ["trailers", "trailers.html", "Food Trailers"],
];
document.getElementById("site-header").outerHTML = `
<header class="site-header">
  <div class="wrap">
    <a class="logo" href="index.html" aria-label="USA Liquidation home">
      <img class="l-light" src="images/logo-color.png" alt="USA Liquidation" />
      <img class="l-dark" src="images/logo-white.png" alt="USA Liquidation" />
    </a>
    <nav class="nav">
      ${navItems.map(([k, h, t]) => `<a href="${h}" class="${PAGE === k ? "active" : ""}">${t}</a>`).join("")}
    </nav>
    <div class="header-cta">
      <a class="btn btn-ghost btn-sm btn-call" href="${telLink()}">${icon.phone} ${SITE.phoneDisplay}</a>
      <a class="btn btn-primary btn-sm" href="${smsLink("Hi USA Liquidation! I have a question.")}">${icon.chat} <span class="btn-text-label">Text Us</span></a>
    </div>
  </div>
</header>`;

// ---------- footer ----------
const ftr = document.getElementById("site-footer");
if (ftr) ftr.outerHTML = `
<footer class="site-footer">
  <div class="wrap">
    <div class="f-grid">
      <div>
        <a class="logo" href="index.html"><img class="l-light" src="images/logo-color.png" alt="USA Liquidation" /><img class="l-dark" src="images/logo-white.png" alt="USA Liquidation" /></a>
        <p class="muted" style="max-width:34ch">Furniture, bins, and custom food trailers — all at liquidation prices.</p>
      </div>
      <div><h4>Shop</h4>${navItems.slice(1).map(([, h, t]) => `<a href="${h}">${t}</a>`).join("")}</div>
      <div><h4>Contact</h4><a href="${telLink()}">${SITE.phoneDisplay}</a><a href="${smsLink("Hi USA Liquidation!")}">Text Us</a></div>
      <div><h4>Visit</h4><a href="${SITE.mapsUrl}" target="_blank" rel="noopener">${SITE.address}<br/>${SITE.city}</a><span class="muted">Tue–Sun · 9am–6pm<br/>Closed Mondays</span></div>
    </div>
    <div class="f-bottom"><span>© ${new Date().getFullYear()} USA Liquidation</span><span class="f-legal"><a href="privacy.html">Privacy Policy</a><a href="terms.html">Terms</a></span><span>Prices and stock change daily.</span></div>
  </div>
</footer>`;

// ---------- floating chat ----------
document.body.insertAdjacentHTML("beforeend", `
<div class="chat-pop" id="chatPop" role="dialog" aria-label="Contact us">
  <h4>Questions? We're Quick.</h4>
  <p>Text us and a real person on our team will get right back to you. Or give us a call.</p>
  <a class="btn btn-accent btn-block" href="${smsLink("Hi USA Liquidation! I have a question.")}">${icon.chat} Text Us Now</a>
  <a class="btn btn-ghost btn-block" href="${telLink()}">${icon.phone} Call ${SITE.phoneDisplay}</a>
</div>
<button class="chat-fab" id="chatFab" aria-expanded="false">${icon.chat}<span>Chat With Us</span></button>`);
const fab = document.getElementById("chatFab"), pop = document.getElementById("chatPop");
fab.addEventListener("click", () => { const o = pop.classList.toggle("open"); fab.setAttribute("aria-expanded", o); });
document.addEventListener("click", e => { if (!pop.contains(e.target) && !fab.contains(e.target)) pop.classList.remove("open"); });

// Fill hours tables / phone spots on any page
document.querySelectorAll("[data-hours]").forEach(t => {
  t.innerHTML = ["Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday", "Monday"].map(d =>
    `<tr class="${d === TODAY ? "today" : ""}"><td>${d}</td><td>${SITE.hours[d] || "Closed"}</td></tr>`).join("");
});
document.querySelectorAll("[data-tel]").forEach(a => (a.href = telLink()));
document.querySelectorAll("[data-sms]").forEach(a => (a.href = smsLink(a.dataset.sms || "Hi USA Liquidation!")));
document.querySelectorAll("[data-phone-text]").forEach(e => (e.textContent = SITE.phoneDisplay));
document.querySelectorAll("[data-address]").forEach(e => (e.innerHTML = `${SITE.address}<br/>${SITE.city}`));
document.querySelectorAll("[data-map]").forEach(f => (f.src = SITE.mapEmbed));
document.querySelectorAll("[data-maps]").forEach(a => (a.href = SITE.mapsUrl));

// ---------- GoHighLevel live chat (USA Liquidation Website Chat) ----------
// Customers type right on the site; replies come from the GHL Conversations app.
(function () {
  document.getElementById("chatFab")?.remove();
  document.getElementById("chatPop")?.remove();
  const s = document.createElement("script");
  s.src = "https://widgets.leadconnectorhq.com/loader.js";
  s.setAttribute("data-resources-url", "https://widgets.leadconnectorhq.com/chat-widget/loader.js");
  // Home page = A2P text opt-in widget (carriers require it to be the ONLY phone/SMS-consent form on the
  // URL registered for A2P). Every other page = the navy live chat widget.
  s.setAttribute("data-widget-id", PAGE === "home" ? "6af65f51ee64ee84e67abf51" : "6af39a92f5284e7ffe2cc05a");
  document.body.appendChild(s);
})();
