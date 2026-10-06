/* RR website -> CRM. Overrides the three inline submit handlers in index.html.
   No secrets here: the endpoint is public by design; abuse control lives server-side. */
(function () {
  var CRM_ENDPOINT = "https://raghavarajuenterprices-crm-app.onrender.com/api/v1/public/submissions"; 
  var SHEETS_BACKUP = "https://script.google.com/macros/s/AKfycbxAO-F7UgJxvWyP8ro0WM2Hedq78efo-yjT41OZHi4pf1kVMtODHB3A9GbC8MnnjX1hrw/exec";
  var UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"];

  // ---- attribution: first touch kept for the browsing session, refreshed by new UTM params
  function store(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function load(k) { try { return sessionStorage.getItem(k) || ""; } catch (e) { return ""; } }
  (function capture() {
    var p = new URLSearchParams(location.search), fresh = UTM.some(function (k) { return p.get(k); });
    if (fresh) UTM.forEach(function (k) { store(k, p.get(k) || ""); });
    if (!load("rr_landing")) { store("rr_landing", location.href); store("rr_referrer", document.referrer || ""); }
  })();

  var ids = {};                                    // one idempotency id per form until it succeeds
  function sid(form) { return ids[form] || (ids[form] = (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2))); }

  function base(formType, formName) {
    var o = { submission_id: sid(formName), form_type: formType, form_name: formName,
              page_url: location.href, landing_page: load("rr_landing"), referrer: load("rr_referrer") };
    UTM.forEach(function (k) { o[k] = load(k); });
    return o;
  }
  function val(id) { var e = document.getElementById(id); return e ? e.value.trim() : ""; }

  function send(payload, ui) {
    ui.btn.disabled = true; ui.btn.textContent = "Submitting...";
    ui.status.textContent = "";
    // existing Google Sheet stays as a parallel backup during rollout
    var legacy = new URLSearchParams();
    Object.keys(payload).forEach(function (k) { legacy.append(k === "form_name" ? "formType" : k, payload[k]); });
    legacy.append("source", payload.page_url);
    try { fetch(SHEETS_BACKUP, { method: "POST", mode: "no-cors", body: legacy }); } catch (e) {}

    var ctl = new AbortController(), t = setTimeout(function () { ctl.abort(); }, 15000);
    return fetch(CRM_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json" },
                                 body: JSON.stringify(payload), signal: ctl.signal })
      .then(function (r) {
        if (r.status === 422) throw { invalid: true };
        if (!r.ok) throw { retry: true };
        delete ids[payload.form_name];
        ui.status.textContent = ui.ok; ui.status.style.color = "var(--copper)";
        ui.form.reset(); if (ui.after) ui.after();
      })
      .catch(function (e) {
        if (e && e.invalid) ui.status.textContent = "Please check your name and phone number (10-digit mobile) and try again.";
        else ui.status.textContent = "We couldn't reach our system just now. Your details were saved as a backup, but please call 8367086748 to confirm.";
        ui.status.style.color = "#8C3D14";
      })
      .finally(function () { clearTimeout(t); ui.btn.disabled = false; ui.btn.textContent = ui.label; });
  }

  window.submitQuoteForm = function (e) {            // main #contact form
    e.preventDefault();
    var p = base("APPOINTMENT_REQUEST", "Contact Enquiry Form");   // server maps by appointment type
    p.name = val("quoteName"); p.phone = val("quotePhone"); p.email = val("quoteEmail");
    p.service = val("quoteService"); p.appointment_type = val("quoteType"); p.details = val("quoteDetails");
    p.hp = (document.querySelector("#quoteForm [name=hp]") || {}).value || "";
    var btn = document.getElementById("quoteSubmitBtn");
    send(p, { btn: btn, label: btn.textContent, status: document.getElementById("quoteStatus"),
              form: document.getElementById("quoteForm"),
              ok: "Thanks! We've received your enquiry and will contact you shortly." });
    return false;
  };
  window.submitQuoteModal = function (e) {           // Get Free Quote modal
    e.preventDefault();
    var p = base("SALES_LEAD", "Get Free Quote");
    p.name = val("quoteModalName"); p.phone = val("quoteModalPhone"); p.email = val("quoteModalEmail");
    p.service = val("quoteModalService"); p.details = val("quoteModalDetails");
    p.hp = (document.querySelector("#quoteModalForm [name=hp]") || {}).value || "";
    var btn = document.querySelector('#quoteModal button[type="submit"]');
    send(p, { btn: btn, label: btn.textContent, status: document.getElementById("quoteModalStatus"),
              form: document.getElementById("quoteModalForm"),
              ok: "Thanks! We've received your quote request. We'll contact you within 2 hours.",
              after: function () { setTimeout(function () { closeModal("quote"); }, 2000); } });
    return false;
  };
  window.submitSupportModal = function (e) {         // Customer Support modal
    e.preventDefault();
    var p = base("SUPPORT_REQUEST", "Customer Support");
    p.name = val("supportModalName"); p.phone = val("supportModalPhone"); p.email = val("supportModalEmail");
    p.issue_type = val("supportModalIssue"); p.details = val("supportModalDetails");
    p.hp = (document.querySelector("#supportModalForm [name=hp]") || {}).value || "";
    var btn = document.querySelector('#supportModal button[type="submit"]');
    send(p, { btn: btn, label: btn.textContent, status: document.getElementById("supportModalStatus"),
              form: document.getElementById("supportModalForm"),
              ok: "Thanks! We've received your support request. Our team will contact you shortly.",
              after: function () { setTimeout(function () { closeModal("support"); }, 2000); } });
    return false;
  };
})();

