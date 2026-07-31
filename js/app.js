/* ============ Vakeel Mitra — Main App ============ */
"use strict";

/* ---------- Storage ---------- */
const STORE_KEY = "vakeel_sathi_v1";

function defaultStore() {
  return {
    settings: { advocateName: "", enrollNo: "", chamber: "", mobile: "", tehsil: "", district: "" },
    clients: [],   // {id, name, father, mobile, village, address, note, createdAt}
    cases: [],     // {id, no, title, clientId, opponent, catId, service, court, courtCaseNo, filedDate, nextDate, status, totalFee, notes, hearings:[{date,note,nextDate}], payments:[{date,amount,note}], createdAt}
    seq: 1
  };
}

let store = loadStore();

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.cases) && Array.isArray(s.clients)) return Object.assign(defaultStore(), s);
    }
  } catch (e) { console.error(e); }
  return defaultStore();
}
function saveStore() { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

/* ---------- Helpers ---------- */
const $ = (sel, el) => (el || document).querySelector(sel);
const $$ = (sel, el) => Array.from((el || document).querySelectorAll(sel));

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function addDaysISO(days) {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function money(n) { return "₹ " + Number(n || 0).toLocaleString("en-IN"); }
function clientById(id) { return store.clients.find(c => c.id === id); }
function caseById(id) { return store.cases.find(c => c.id === id); }
function catById(id) { return SERVICE_CATEGORIES.find(c => c.id === id); }
function received(cs) { return (cs.payments || []).reduce((s, p) => s + Number(p.amount || 0), 0); }
function balance(cs) { return Number(cs.totalFee || 0) - received(cs); }
function statusBadge(st) {
  const s = CASE_STATUSES.find(x => x.id === st) || CASE_STATUSES[0];
  return `<span class="badge ${s.id}">${s.label}</span>`;
}

let toastTimer = null;
function toast(msg) {
  const t = $("#toast");
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 2600);
}

/* ---------- Modal ---------- */
function openModal(title, bodyHTML) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = bodyHTML;
  $("#modal-backdrop").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeModal() {
  $("#modal-backdrop").hidden = true;
  $("#modal-body").innerHTML = "";
  document.body.style.overflow = "";
}
$("#modal-close").addEventListener("click", closeModal);
$("#modal-backdrop").addEventListener("click", (e) => { if (e.target === $("#modal-backdrop")) closeModal(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

/* ---------- Router ---------- */
const TITLES = {
  dashboard: "डैशबोर्ड", services: "सेवा सूची", cases: "प्रकरण", clients: "पक्षकार",
  diary: "पेशी डायरी", fees: "फीस लेजर", documents: "दस्तावेज़ टेम्पलेट",
  links: "उपयोगी लिंक", settings: "सेटिंग / बैकअप", search: "खोज परिणाम", case: "प्रकरण विवरण", doc: "दस्तावेज़"
};

function route() {
  clearInterval(heroTimer);
  const hash = location.hash.replace(/^#\//, "") || "dashboard";
  const [page, param] = hash.split("/");
  $$(".nav-link").forEach(a => a.classList.toggle("active", a.dataset.route === page));
  $("#page-title").textContent = TITLES[page] || "Vakeel Mitra";
  $("#sidebar").classList.remove("open");
  const view = $("#view");
  switch (page) {
    case "dashboard": renderDashboard(view); break;
    case "services":  renderServices(view, decodeURIComponent(param || "")); break;
    case "cases":     renderCases(view); break;
    case "case":      renderCaseDetail(view, param); break;
    case "clients":   renderClients(view); break;
    case "diary":     renderDiary(view); break;
    case "fees":      renderFees(view); break;
    case "documents": renderDocuments(view); break;
    case "doc":       renderDocFill(view, param); break;
    case "links":     renderLinks(view); break;
    case "settings":  renderSettings(view); break;
    case "search":    renderSearch(view, decodeURIComponent(param || "")); break;
    default:          renderDashboard(view);
  }
  view.scrollTop = 0; window.scrollTo(0, 0);
  view.classList.remove("page-enter");
  void view.offsetWidth;
  view.classList.add("page-enter");
}
window.addEventListener("hashchange", route);

/* ---------- Dashboard ---------- */
function renderDashboard(el) {
  const t = todayISO();
  const active = store.cases.filter(c => c.status === "chalu" || c.status === "lambit");
  const todayHearings = active.filter(c => c.nextDate === t);
  const overdue = active.filter(c => c.nextDate && c.nextDate < t);
  const week = active.filter(c => c.nextDate && c.nextDate > t && c.nextDate <= addDaysISO(7));
  const totalDue = store.cases.reduce((s, c) => s + Math.max(0, balance(c)), 0);
  const adv = store.settings.advocateName;

  el.innerHTML = `
    ${adv ? "" : `<div class="card" style="border-left:4px solid var(--saffron)">
      <b>नमस्ते!</b> पहले <a href="#/settings">सेटिंग</a> में अपना नाम व कार्यालय विवरण भर लें — यह दस्तावेज़ों में स्वतः उपयोग होगा।
    </div>`}
    ${heroSliderHTML()}
    <div class="stat-grid">
      <div class="stat" onclick="location.hash='#/cases'"><div class="num">${store.cases.length}</div><div class="lbl">कुल प्रकरण</div></div>
      <div class="stat good" onclick="location.hash='#/cases'"><div class="num">${active.length}</div><div class="lbl">चालू प्रकरण</div></div>
      <div class="stat warn" onclick="location.hash='#/diary'"><div class="num">${todayHearings.length}</div><div class="lbl">आज की पेशी</div></div>
      <div class="stat bad" onclick="location.hash='#/diary'"><div class="num">${overdue.length}</div><div class="lbl">तिथि निकली / अपडेट करें</div></div>
      <div class="stat" onclick="location.hash='#/clients'"><div class="num">${store.clients.length}</div><div class="lbl">पक्षकार</div></div>
      <div class="stat warn" onclick="location.hash='#/fees'"><div class="num">${money(totalDue)}</div><div class="lbl">बकाया फीस</div></div>
    </div>

    <div class="two-col">
      <div class="card">
        <h2>📅 आज की पेशियाँ (${fmtDate(t)})</h2>
        ${todayHearings.length ? caseMiniTable(todayHearings) : `<div class="empty"><span class="big">🍃</span>आज कोई पेशी नहीं है</div>`}
        ${week.length ? `<h3 style="margin-top:14px">आगामी 7 दिन</h3>${caseMiniTable(week)}` : ""}
      </div>
      <div class="card">
        <h2>⚡ त्वरित कार्य</h2>
        <div style="display:grid; gap:8px">
          <button class="btn btn-primary btn-block" onclick="openCaseForm()">+ नया प्रकरण दर्ज करें</button>
          <button class="btn btn-block" onclick="openClientForm()">+ नया पक्षकार जोड़ें</button>
          <button class="btn btn-block" onclick="location.hash='#/documents'">📝 दस्तावेज़ / शपथ-पत्र बनाएँ</button>
          <button class="btn btn-block" onclick="location.hash='#/services'">📋 सेवा सूची देखें</button>
        </div>
        <h3 style="margin-top:16px">🔗 प्रमुख पोर्टल</h3>
        <ul class="plain-list">
          ${USEFUL_LINKS.slice(0, 4).map(l => `<li><a href="${esc(l.url)}" target="_blank" rel="noopener">${esc(l.name)}</a></li>`).join("")}
        </ul>
      </div>
    </div>

    <div class="card">
      <h2>हाल के प्रकरण</h2>
      ${store.cases.length ? caseTable(store.cases.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || "")).slice(0, 8)) : `<div class="empty"><span class="big">📁</span>अभी कोई प्रकरण दर्ज नहीं है। "+ नया प्रकरण" से शुरू करें।</div>`}
    </div>

    <div class="card small muted mb0" style="border-left:4px solid var(--navy)">
      <b>ध्यान रखने योग्य:</b> ${esc(JURISDICTION_NOTE)}
    </div>`;
  initHeroSlider();
}

/* ---------- Hero slider (dashboard) — service categories showcase ---------- */
let heroTimer = null;

function heroSlides() {
  const totalItems = SERVICE_CATEGORIES.reduce((s, c) => s + c.items.length, 0);
  const intro = {
    ico: "⚖️", title: "सेवाओं की पूरी सूची", cat: null, count: totalItems,
    text: "13 श्रेणियों में भूमि-राजस्व से लेकर RTI तक — नीचे झलक देखें या सीधे सेवा सूची खोलें।",
    cta: "पूरी सेवा सूची देखें", href: "#/services"
  };
  const catSlides = SERVICE_CATEGORIES.map(cat => ({
    ico: cat.icon, title: cat.name, cat: cat.id, count: cat.items.length,
    text: `${cat.items.length} कार्य उपलब्ध — जैसे: ${cat.items.slice(0, 3).join(", ")}${cat.items.length > 3 ? " आदि" : ""}`,
    cta: "इस श्रेणी में देखें", href: "#/services"
  }));
  return [intro, ...catSlides];
}

function heroSliderHTML() {
  const slides = heroSlides();
  return `<div class="hero-slider" id="hero-slider">
    <div class="hero-track" id="hero-track">
      ${slides.map(s => `
        <div class="hero-slide">
          <div class="hero-ico">${s.ico}</div>
          <div class="hero-text">
            <h3>${esc(s.title)} <span class="hero-count">${s.count}</span></h3>
            <p>${esc(s.text)}</p>
            <button class="btn-hero" data-hero-href="${s.href}">${esc(s.cta)} →</button>
          </div>
        </div>`).join("")}
    </div>
    <button class="hero-arrow prev" id="hero-prev" aria-label="पिछला">‹</button>
    <button class="hero-arrow next" id="hero-next" aria-label="अगला">›</button>
    <div class="hero-dots" id="hero-dots">
      ${slides.map((_, i) => `<button class="hero-dot ${i === 0 ? "active" : ""}" data-dot="${i}" aria-label="स्लाइड ${i + 1}"></button>`).join("")}
    </div>
  </div>`;
}

function initHeroSlider() {
  const track = $("#hero-track");
  if (!track) return;
  const dots = $$(".hero-dot");
  const total = heroSlides().length;
  let idx = 0;

  function goTo(i) {
    idx = (i + total) % total;
    track.style.transform = `translateX(-${idx * 100}%)`;
    dots.forEach((d, di) => d.classList.toggle("active", di === idx));
  }
  function resetTimer() {
    clearInterval(heroTimer);
    heroTimer = setInterval(() => goTo(idx + 1), 5000);
  }
  $("#hero-next").addEventListener("click", () => { goTo(idx + 1); resetTimer(); });
  $("#hero-prev").addEventListener("click", () => { goTo(idx - 1); resetTimer(); });
  dots.forEach(d => d.addEventListener("click", () => { goTo(Number(d.dataset.dot)); resetTimer(); }));
  $$("[data-hero-href]").forEach(btn => btn.addEventListener("click", () => { location.hash = btn.dataset.heroHref; }));
  $("#hero-slider").addEventListener("mouseenter", () => clearInterval(heroTimer));
  $("#hero-slider").addEventListener("mouseleave", resetTimer);
  resetTimer();
}

function caseMiniTable(list) {
  return `<div class="table-wrap"><table class="data">
    <thead><tr><th>प्रकरण</th><th>पक्षकार</th><th>न्यायालय</th><th>तिथि</th></tr></thead>
    <tbody>${list.map(c => `
      <tr class="clickable" onclick="location.hash='#/case/${c.id}'">
        <td><b>${esc(c.no)}</b><br><span class="small muted">${esc(c.service || c.title || "")}</span></td>
        <td>${esc(clientById(c.clientId)?.name || "—")}</td>
        <td class="small">${esc(c.court || "—")}</td>
        <td>${fmtDate(c.nextDate)}</td>
      </tr>`).join("")}</tbody></table></div>`;
}

/* ---------- Services ---------- */
function renderServices(el, query) {
  const q = (query || "").trim();
  el.innerHTML = `
    <div class="toolbar">
      <input type="search" id="svc-search" placeholder="सेवा खोजें… (जैसे: नामांतरण, शपथ, नोटिस)" value="${esc(q)}" style="flex:1; max-width:420px">
      <span class="muted small">कुल ${SERVICE_CATEGORIES.reduce((s, c) => s + c.items.length, 0)} कार्य — ${SERVICE_CATEGORIES.length} श्रेणियाँ</span>
    </div>
    <div class="cat-grid" id="cat-grid"></div>
    <div class="card small muted" style="margin-top:16px; border-left:4px solid var(--brand-2)">
      <b>ध्यान रखने योग्य:</b> ${esc(JURISDICTION_NOTE)}
    </div>`;

  function draw(qq) {
    const grid = $("#cat-grid");
    const ql = qq.toLowerCase();
    grid.innerHTML = SERVICE_CATEGORIES.map(cat => {
      const items = ql ? cat.items.filter(i => i.toLowerCase().includes(ql)) : cat.items;
      if (ql && !items.length && !cat.name.toLowerCase().includes(ql)) return "";
      const list = (ql && !items.length) ? cat.items : items;
      return `<div class="cat-card">
        <div class="cat-head" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display==='none' ? '' : 'none'">
          <span class="cat-ico">${cat.icon}</span>
          <span class="cat-title">${esc(cat.name)}</span>
          <span class="cat-count">${list.length}</span>
        </div>
        <div class="cat-body">
          ${list.map(i => `<div class="svc-item">
              <span class="svc-name">${esc(i)}</span>
              <button class="btn btn-sm svc-add" title="इस कार्य का नया प्रकरण दर्ज करें"
                onclick="openCaseForm(null, '${cat.id}', '${esc(i).replace(/'/g, "\\'")}')">+ प्रकरण</button>
            </div>`).join("")}
        </div>
        ${cat.note ? `<div class="cat-note">ℹ️ ${esc(cat.note)}</div>` : ""}
      </div>`;
    }).join("") || `<div class="empty" style="grid-column:1/-1"><span class="big">🔍</span>"${esc(qq)}" से मिलती कोई सेवा नहीं मिली</div>`;
  }
  draw(q);
  $("#svc-search").addEventListener("input", e => draw(e.target.value.trim()));
}

/* ---------- Cases list ---------- */
function renderCases(el) {
  el.innerHTML = `
    <div class="toolbar">
      <input type="search" id="case-search" placeholder="प्रकरण / पक्षकार खोजें…">
      <select id="case-status-filter">
        <option value="">सभी स्थिति</option>
        ${CASE_STATUSES.map(s => `<option value="${s.id}">${s.label}</option>`).join("")}
      </select>
      <select id="case-cat-filter">
        <option value="">सभी श्रेणियाँ</option>
        ${SERVICE_CATEGORIES.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join("")}
      </select>
      <span class="spacer"></span>
      <button class="btn btn-primary" onclick="openCaseForm()">+ नया प्रकरण</button>
    </div>
    <div class="card" id="case-list"></div>`;

  function draw() {
    const q = $("#case-search").value.trim().toLowerCase();
    const st = $("#case-status-filter").value;
    const cat = $("#case-cat-filter").value;
    let list = store.cases.slice().sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    if (st) list = list.filter(c => c.status === st);
    if (cat) list = list.filter(c => c.catId === cat);
    if (q) list = list.filter(c =>
      (c.no || "").toLowerCase().includes(q) ||
      (c.title || "").toLowerCase().includes(q) ||
      (c.service || "").toLowerCase().includes(q) ||
      (c.courtCaseNo || "").toLowerCase().includes(q) ||
      (clientById(c.clientId)?.name || "").toLowerCase().includes(q) ||
      (c.opponent || "").toLowerCase().includes(q));
    $("#case-list").innerHTML = list.length ? caseTable(list) :
      `<div class="empty"><span class="big">📁</span>कोई प्रकरण नहीं मिला</div>`;
  }
  ["case-search", "case-status-filter", "case-cat-filter"].forEach(id => $("#" + id).addEventListener("input", draw));
  draw();
}

function caseTable(list) {
  return `<div class="table-wrap"><table class="data">
    <thead><tr><th>क्रमांक</th><th>कार्य / प्रकरण</th><th>पक्षकार</th><th>न्यायालय</th><th>अगली तिथि</th><th>स्थिति</th><th>बकाया</th></tr></thead>
    <tbody>${list.map(c => {
      const bal = balance(c);
      return `<tr class="clickable" onclick="location.hash='#/case/${c.id}'">
        <td><b>${esc(c.no)}</b></td>
        <td>${esc(c.service || c.title || "—")}<br><span class="small muted">${esc(catById(c.catId)?.name || "")}</span></td>
        <td>${esc(clientById(c.clientId)?.name || "—")}${c.opponent ? `<br><span class="small muted">बनाम ${esc(c.opponent)}</span>` : ""}</td>
        <td class="small">${esc(c.court || "—")}${c.courtCaseNo ? `<br><span class="muted">प्र.क्र. ${esc(c.courtCaseNo)}</span>` : ""}</td>
        <td>${fmtDate(c.nextDate)}</td>
        <td>${statusBadge(c.status)}</td>
        <td>${bal > 0 ? `<span class="badge due">${money(bal)}</span>` : `<span class="badge nirnit">पूर्ण</span>`}</td>
      </tr>`;
    }).join("")}</tbody></table></div>`;
}

/* ---------- Case form ---------- */
function openCaseForm(caseId, presetCat, presetService) {
  const cs = caseId ? caseById(caseId) : null;
  const clientsOpts = store.clients.map(c =>
    `<option value="${c.id}" ${cs && cs.clientId === c.id ? "selected" : ""}>${esc(c.name)}${c.village ? " — " + esc(c.village) : ""}</option>`).join("");
  const catId = cs ? cs.catId : (presetCat || "");
  openModal(cs ? `प्रकरण संपादित करें — ${esc(cs.no)}` : "नया प्रकरण दर्ज करें", `
    <form id="case-form" class="form-grid">
      <div class="fld full">
        <label>पक्षकार *</label>
        <div style="display:flex; gap:8px">
          <select id="cf-client" required style="flex:1">
            <option value="">— पक्षकार चुनें —</option>${clientsOpts}
          </select>
          <button type="button" class="btn" onclick="openClientForm(null, true)">+ नया</button>
        </div>
      </div>
      <div class="fld"><label>विपक्षी / अनावेदक</label><input id="cf-opponent" value="${esc(cs?.opponent || "")}"></div>
      <div class="fld">
        <label>कार्य की श्रेणी *</label>
        <select id="cf-cat" required>
          <option value="">— चुनें —</option>
          ${SERVICE_CATEGORIES.map(c => `<option value="${c.id}" ${catId === c.id ? "selected" : ""}>${esc(c.name)}</option>`).join("")}
        </select>
      </div>
      <div class="fld full">
        <label>कार्य / सेवा *</label>
        <select id="cf-service" required></select>
      </div>
      <div class="fld">
        <label>न्यायालय / कार्यालय</label>
        <select id="cf-court">
          <option value="">— चुनें —</option>
          ${COURTS.map(c => `<option ${cs?.court === c ? "selected" : ""}>${esc(c)}</option>`).join("")}
        </select>
      </div>
      <div class="fld"><label>न्यायालयीन प्रकरण क्रमांक</label><input id="cf-courtno" value="${esc(cs?.courtCaseNo || "")}" placeholder="जैसे: रा.प्र.क्र. 125/अ-6/2025-26"></div>
      <div class="fld"><label>दर्ज दिनांक</label><input type="date" id="cf-filed" value="${cs?.filedDate || todayISO()}"></div>
      <div class="fld"><label>अगली पेशी / तिथि</label><input type="date" id="cf-next" value="${cs?.nextDate || ""}"></div>
      <div class="fld">
        <label>स्थिति</label>
        <select id="cf-status">${CASE_STATUSES.map(s => `<option value="${s.id}" ${cs?.status === s.id ? "selected" : ""}>${s.label}</option>`).join("")}</select>
      </div>
      <div class="fld"><label>कुल तय फीस (₹)</label><input type="number" id="cf-fee" min="0" value="${cs?.totalFee || ""}"></div>
      <div class="fld full"><label>टिप्पणी / विवरण (खसरा नं., ग्राम आदि)</label><textarea id="cf-notes">${esc(cs?.notes || "")}</textarea></div>
      <div class="form-actions full">
        <button type="button" class="btn" onclick="closeModal()">रद्द</button>
        <button type="submit" class="btn btn-primary">${cs ? "सहेजें" : "प्रकरण दर्ज करें"}</button>
      </div>
    </form>`);

  const catSel = $("#cf-cat"), svcSel = $("#cf-service");
  function fillServices() {
    const cat = catById(catSel.value);
    const cur = cs?.service || presetService || "";
    svcSel.innerHTML = `<option value="">— कार्य चुनें —</option>` +
      (cat ? cat.items.map(i => `<option ${i === cur ? "selected" : ""}>${esc(i)}</option>`).join("") : "") +
      `<option value="__other__">अन्य (स्वयं लिखें)</option>`;
  }
  catSel.addEventListener("change", fillServices);
  svcSel.addEventListener("change", () => {
    if (svcSel.value === "__other__") {
      const custom = prompt("कार्य का नाम लिखें:");
      if (custom && custom.trim()) {
        const opt = document.createElement("option");
        opt.textContent = custom.trim(); opt.selected = true;
        svcSel.insertBefore(opt, svcSel.lastElementChild);
      } else svcSel.value = "";
    }
  });
  fillServices();

  $("#case-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const clientId = $("#cf-client").value;
    if (!clientId) { toast("पहले पक्षकार चुनें या नया जोड़ें"); return; }
    const data = {
      clientId,
      opponent: $("#cf-opponent").value.trim(),
      catId: catSel.value,
      service: svcSel.value === "__other__" ? "" : svcSel.value,
      court: $("#cf-court").value,
      courtCaseNo: $("#cf-courtno").value.trim(),
      filedDate: $("#cf-filed").value,
      nextDate: $("#cf-next").value,
      status: $("#cf-status").value,
      totalFee: Number($("#cf-fee").value || 0),
      notes: $("#cf-notes").value.trim()
    };
    if (!data.service) { toast("कार्य / सेवा चुनें"); return; }
    if (cs) {
      Object.assign(cs, data);
      toast("प्रकरण अपडेट हुआ");
    } else {
      const year = new Date().getFullYear();
      const no = `VS-${year}/${String(store.seq).padStart(3, "0")}`;
      store.seq++;
      store.cases.push(Object.assign({
        id: uid(), no, hearings: [], payments: [], createdAt: new Date().toISOString()
      }, data));
      toast(`प्रकरण ${no} दर्ज हुआ`);
    }
    saveStore(); closeModal(); route();
  });
}

/* ---------- Case detail ---------- */
function renderCaseDetail(el, id) {
  const cs = caseById(id);
  if (!cs) { el.innerHTML = `<div class="card empty">प्रकरण नहीं मिला। <a href="#/cases">सूची पर जाएँ</a></div>`; return; }
  const cl = clientById(cs.clientId);
  const recd = received(cs), bal = balance(cs);
  const hearings = (cs.hearings || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const payments = (cs.payments || []).slice().sort((a, b) => (b.date || "").localeCompare(a.date || ""));

  el.innerHTML = `
    <div class="toolbar">
      <a class="btn" href="#/cases">← सूची</a>
      <span class="spacer"></span>
      <button class="btn" onclick="openCaseForm('${cs.id}')">✏️ संपादित</button>
      <button class="btn btn-accent" onclick="openHearingForm('${cs.id}')">+ पेशी / कार्यवाही</button>
      <button class="btn" onclick="openPaymentForm('${cs.id}')">+ फीस प्राप्ति</button>
      <button class="btn btn-danger" onclick="deleteCase('${cs.id}')">🗑 हटाएँ</button>
    </div>

    <div class="card">
      <h2>${esc(cs.no)} — ${esc(cs.service || cs.title || "")} ${statusBadge(cs.status)}</h2>
      <dl class="kv">
        <dt>पक्षकार</dt><dd>${esc(cl?.name || "—")} ${cl?.mobile ? `<span class="muted small">(${esc(cl.mobile)})</span>` : ""}</dd>
        <dt>विपक्षी</dt><dd>${esc(cs.opponent || "—")}</dd>
        <dt>श्रेणी</dt><dd><span class="badge cat">${esc(catById(cs.catId)?.name || "—")}</span></dd>
        <dt>न्यायालय / कार्यालय</dt><dd>${esc(cs.court || "—")}</dd>
        <dt>न्यायालयीन प्रकरण क्रमांक</dt><dd>${esc(cs.courtCaseNo || "—")}</dd>
        <dt>दर्ज दिनांक</dt><dd>${fmtDate(cs.filedDate)}</dd>
        <dt>अगली पेशी</dt><dd><b>${fmtDate(cs.nextDate)}</b></dd>
        <dt>फीस</dt><dd>कुल ${money(cs.totalFee)} • प्राप्त ${money(recd)} • ${bal > 0 ? `<span class="badge due">बकाया ${money(bal)}</span>` : `<span class="badge nirnit">पूर्ण भुगतान</span>`}</dd>
        <dt>टिप्पणी</dt><dd>${esc(cs.notes || "—")}</dd>
      </dl>
    </div>

    <div class="two-col">
      <div class="card">
        <h2>📅 पेशी / कार्यवाही विवरण</h2>
        ${hearings.length ? `<div class="hearing-log">${hearings.map(h => `
          <div class="h-item">
            <div class="h-date">${fmtDate(h.date)} ${h.nextDate ? `<span class="muted small">→ अगली तिथि ${fmtDate(h.nextDate)}</span>` : ""}</div>
            <div class="h-note">${esc(h.note || "")}</div>
          </div>`).join("")}</div>`
        : `<div class="empty">अभी कोई कार्यवाही दर्ज नहीं</div>`}
      </div>
      <div class="card">
        <h2>₹ फीस प्राप्तियाँ</h2>
        ${payments.length ? `<div class="table-wrap"><table class="data">
          <thead><tr><th>दिनांक</th><th>राशि</th><th>विवरण</th></tr></thead>
          <tbody>${payments.map(p => `<tr><td>${fmtDate(p.date)}</td><td><b>${money(p.amount)}</b></td><td>${esc(p.note || "")}</td></tr>`).join("")}</tbody>
        </table></div>` : `<div class="empty">अभी कोई प्राप्ति दर्ज नहीं</div>`}
      </div>
    </div>`;
}

function openHearingForm(caseId) {
  openModal("पेशी / कार्यवाही दर्ज करें", `
    <form id="hearing-form" class="form-grid">
      <div class="fld"><label>पेशी दिनांक</label><input type="date" id="hf-date" value="${todayISO()}" required></div>
      <div class="fld"><label>अगली तिथि</label><input type="date" id="hf-next"></div>
      <div class="fld full"><label>कार्यवाही का विवरण *</label><textarea id="hf-note" required placeholder="जैसे: अनावेदक का जवाब प्रस्तुत, बहस हेतु तिथि नियत…"></textarea></div>
      <div class="form-actions full">
        <button type="button" class="btn" onclick="closeModal()">रद्द</button>
        <button type="submit" class="btn btn-primary">दर्ज करें</button>
      </div>
    </form>`);
  $("#hearing-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const cs = caseById(caseId);
    cs.hearings = cs.hearings || [];
    const nextDate = $("#hf-next").value;
    cs.hearings.push({ date: $("#hf-date").value, note: $("#hf-note").value.trim(), nextDate });
    if (nextDate) cs.nextDate = nextDate;
    saveStore(); closeModal(); route(); toast("कार्यवाही दर्ज हुई");
  });
}

function openPaymentForm(caseId) {
  const cs = caseById(caseId);
  openModal(`फीस प्राप्ति — ${esc(cs.no)} (बकाया ${money(balance(cs))})`, `
    <form id="pay-form" class="form-grid">
      <div class="fld"><label>दिनांक</label><input type="date" id="pf-date" value="${todayISO()}" required></div>
      <div class="fld"><label>राशि (₹) *</label><input type="number" id="pf-amount" min="1" required></div>
      <div class="fld full"><label>विवरण</label><input id="pf-note" placeholder="नकद / UPI / किस बाबत"></div>
      <div class="form-actions full">
        <button type="button" class="btn" onclick="closeModal()">रद्द</button>
        <button type="submit" class="btn btn-primary">दर्ज करें</button>
      </div>
    </form>`);
  $("#pay-form").addEventListener("submit", (e) => {
    e.preventDefault();
    cs.payments = cs.payments || [];
    cs.payments.push({ date: $("#pf-date").value, amount: Number($("#pf-amount").value || 0), note: $("#pf-note").value.trim() });
    saveStore(); closeModal(); route(); toast("प्राप्ति दर्ज हुई");
  });
}

function deleteCase(id) {
  const cs = caseById(id);
  if (!cs) return;
  if (!confirm(`प्रकरण ${cs.no} स्थायी रूप से हटाएँ? इसकी पेशी व फीस जानकारी भी हट जाएगी।`)) return;
  store.cases = store.cases.filter(c => c.id !== id);
  saveStore(); location.hash = "#/cases"; toast("प्रकरण हटाया गया");
}

/* ---------- Clients ---------- */
function renderClients(el) {
  el.innerHTML = `
    <div class="toolbar">
      <input type="search" id="cl-search" placeholder="नाम / मोबाइल / ग्राम खोजें…">
      <span class="spacer"></span>
      <button class="btn btn-primary" onclick="openClientForm()">+ नया पक्षकार</button>
    </div>
    <div class="card" id="cl-list"></div>`;
  function draw() {
    const q = $("#cl-search").value.trim().toLowerCase();
    let list = store.clients.slice().sort((a, b) => a.name.localeCompare(b.name, "hi"));
    if (q) list = list.filter(c =>
      c.name.toLowerCase().includes(q) || (c.mobile || "").includes(q) ||
      (c.village || "").toLowerCase().includes(q) || (c.father || "").toLowerCase().includes(q));
    $("#cl-list").innerHTML = list.length ? `<div class="table-wrap"><table class="data">
      <thead><tr><th>नाम</th><th>पिता/पति</th><th>मोबाइल</th><th>ग्राम / पता</th><th>प्रकरण</th><th class="right"></th></tr></thead>
      <tbody>${list.map(c => {
        const n = store.cases.filter(x => x.clientId === c.id).length;
        return `<tr>
          <td><b>${esc(c.name)}</b></td>
          <td>${esc(c.father || "—")}</td>
          <td>${esc(c.mobile || "—")}</td>
          <td class="small">${esc([c.village, c.address].filter(Boolean).join(", ") || "—")}</td>
          <td>${n ? `<a href="#/cases">${n}</a>` : "0"}</td>
          <td class="actions">
            <button class="btn btn-sm" onclick="openCaseForm(null); setTimeout(()=>{const s=document.querySelector('#cf-client'); if(s) s.value='${c.id}';},50)">+ प्रकरण</button>
            <button class="btn btn-sm" onclick="openClientForm('${c.id}')">✏️</button>
            <button class="btn btn-sm btn-danger" onclick="deleteClient('${c.id}')">🗑</button>
          </td>
        </tr>`;
      }).join("")}</tbody></table></div>`
    : `<div class="empty"><span class="big">👥</span>कोई पक्षकार नहीं मिला</div>`;
  }
  $("#cl-search").addEventListener("input", draw);
  draw();
}

function openClientForm(clientId, fromCaseForm) {
  const cl = clientId ? clientById(clientId) : null;
  openModal(cl ? "पक्षकार संपादित करें" : "नया पक्षकार", `
    <form id="client-form" class="form-grid">
      <div class="fld"><label>नाम *</label><input id="clf-name" required value="${esc(cl?.name || "")}"></div>
      <div class="fld"><label>पिता / पति का नाम</label><input id="clf-father" value="${esc(cl?.father || "")}"></div>
      <div class="fld"><label>मोबाइल</label><input id="clf-mobile" value="${esc(cl?.mobile || "")}"></div>
      <div class="fld"><label>ग्राम / शहर</label><input id="clf-village" value="${esc(cl?.village || "")}"></div>
      <div class="fld full"><label>पूरा पता</label><input id="clf-address" value="${esc(cl?.address || "")}"></div>
      <div class="fld full"><label>टिप्पणी</label><input id="clf-note" value="${esc(cl?.note || "")}"></div>
      <div class="form-actions full">
        <button type="button" class="btn" onclick="closeModal()">रद्द</button>
        <button type="submit" class="btn btn-primary">सहेजें</button>
      </div>
    </form>`);
  $("#client-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const data = {
      name: $("#clf-name").value.trim(),
      father: $("#clf-father").value.trim(),
      mobile: $("#clf-mobile").value.trim(),
      village: $("#clf-village").value.trim(),
      address: $("#clf-address").value.trim(),
      note: $("#clf-note").value.trim()
    };
    if (!data.name) return;
    let newId = null;
    if (cl) { Object.assign(cl, data); toast("पक्षकार अपडेट हुआ"); }
    else {
      newId = uid();
      store.clients.push(Object.assign({ id: newId, createdAt: new Date().toISOString() }, data));
      toast("पक्षकार जुड़ गया");
    }
    saveStore(); closeModal();
    if (fromCaseForm && newId) {
      openCaseForm();
      setTimeout(() => { const s = $("#cf-client"); if (s) s.value = newId; }, 50);
    } else route();
  });
}

function deleteClient(id) {
  const n = store.cases.filter(c => c.clientId === id).length;
  if (n) { alert(`इस पक्षकार के ${n} प्रकरण दर्ज हैं। पहले उन्हें हटाएँ या किसी और पक्षकार से जोड़ें।`); return; }
  if (!confirm("पक्षकार हटाएँ?")) return;
  store.clients = store.clients.filter(c => c.id !== id);
  saveStore(); route(); toast("पक्षकार हटाया गया");
}

/* ---------- Diary ---------- */
function renderDiary(el) {
  const t = todayISO();
  const active = store.cases.filter(c => c.status === "chalu" || c.status === "lambit");
  const overdue = active.filter(c => c.nextDate && c.nextDate < t).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const today = active.filter(c => c.nextDate === t);
  const upcoming = active.filter(c => c.nextDate && c.nextDate > t).sort((a, b) => a.nextDate.localeCompare(b.nextDate));
  const noDate = active.filter(c => !c.nextDate);

  const section = (title, list, cls) => `
    <div class="card">
      <h2>${title} <span class="muted small">(${list.length})</span></h2>
      ${list.length ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>तिथि</th><th>प्रकरण</th><th>पक्षकार</th><th>न्यायालय</th><th class="right"></th></tr></thead>
        <tbody>${list.map(c => `
          <tr>
            <td><b>${fmtDate(c.nextDate)}</b></td>
            <td class="clickable" onclick="location.hash='#/case/${c.id}'"><b>${esc(c.no)}</b><br><span class="small muted">${esc(c.service || "")}</span></td>
            <td>${esc(clientById(c.clientId)?.name || "—")}</td>
            <td class="small">${esc(c.court || "—")}</td>
            <td class="actions"><button class="btn btn-sm btn-accent" onclick="openHearingForm('${c.id}')">पेशी दर्ज</button></td>
          </tr>`).join("")}</tbody></table></div>`
      : `<div class="empty">कोई प्रकरण नहीं</div>`}
    </div>`;

  el.innerHTML =
    (overdue.length ? section("⚠️ तिथि निकल चुकी — अपडेट करें", overdue) : "") +
    section(`📅 आज — ${fmtDate(t)}`, today) +
    section("🔜 आगामी पेशियाँ", upcoming) +
    (noDate.length ? section("❓ बिना तिथि के चालू प्रकरण", noDate) : "");
}

/* ---------- Fees ---------- */
function renderFees(el) {
  const rows = store.cases.slice().sort((a, b) => balance(b) - balance(a));
  const totalFee = rows.reduce((s, c) => s + Number(c.totalFee || 0), 0);
  const totalRecd = rows.reduce((s, c) => s + received(c), 0);
  const totalBal = totalFee - totalRecd;
  el.innerHTML = `
    <div class="stat-grid">
      <div class="stat"><div class="num">${money(totalFee)}</div><div class="lbl">कुल तय फीस</div></div>
      <div class="stat good"><div class="num">${money(totalRecd)}</div><div class="lbl">कुल प्राप्त</div></div>
      <div class="stat bad"><div class="num">${money(totalBal)}</div><div class="lbl">कुल बकाया</div></div>
    </div>
    <div class="card">
      <h2>प्रकरणवार फीस</h2>
      ${rows.length ? `<div class="table-wrap"><table class="data">
        <thead><tr><th>प्रकरण</th><th>पक्षकार</th><th>तय फीस</th><th>प्राप्त</th><th>बकाया</th><th class="right"></th></tr></thead>
        <tbody>${rows.map(c => {
          const r = received(c), b = balance(c);
          return `<tr>
            <td class="clickable" onclick="location.hash='#/case/${c.id}'"><b>${esc(c.no)}</b><br><span class="small muted">${esc(c.service || "")}</span></td>
            <td>${esc(clientById(c.clientId)?.name || "—")}</td>
            <td>${money(c.totalFee)}</td>
            <td>${money(r)}</td>
            <td>${b > 0 ? `<span class="badge due">${money(b)}</span>` : `<span class="badge nirnit">पूर्ण</span>`}</td>
            <td class="actions"><button class="btn btn-sm" onclick="openPaymentForm('${c.id}')">+ प्राप्ति</button></td>
          </tr>`;
        }).join("")}</tbody></table></div>`
      : `<div class="empty"><span class="big">₹</span>अभी कोई प्रकरण दर्ज नहीं</div>`}
    </div>`;
}

/* ---------- Documents ---------- */
function renderDocuments(el) {
  el.innerHTML = `
    <div class="card small muted" style="border-left:4px solid var(--accent)">
      टेम्पलेट चुनें → विवरण भरें → दस्तावेज़ तैयार → प्रिंट करें। <b>नोट:</b> शपथ-पत्र का नोटरी प्रमाणन केवल अधिकृत नोटरी द्वारा ही होगा।
    </div>
    <div class="tpl-grid">
      ${DOC_TEMPLATES.map(t => `
        <div class="tpl-card" onclick="location.hash='#/doc/${t.id}'">
          <div class="tpl-ico">${t.icon}</div>
          <div class="tpl-name">${esc(t.name)}</div>
          <div class="tpl-desc">${esc(t.desc)}</div>
        </div>`).join("")}
    </div>`;
}

function renderDocFill(el, tplId) {
  const tpl = DOC_TEMPLATES.find(t => t.id === tplId);
  if (!tpl) { el.innerHTML = `<div class="card empty">टेम्पलेट नहीं मिला। <a href="#/documents">सूची पर जाएँ</a></div>`; return; }
  const s = store.settings;
  const prefill = {
    advName: s.advocateName, advAddress: s.chamber, enrollNo: s.enrollNo,
    tehsil: s.tehsil, district: s.district, date: todayISO(), place: s.tehsil
  };
  el.innerHTML = `
    <div class="toolbar">
      <a class="btn" href="#/documents">← टेम्पलेट सूची</a>
      <span class="spacer"></span>
      <button class="btn" id="doc-copy">📋 कॉपी</button>
      <button class="btn" id="doc-download">⬇ फाइल (.txt)</button>
      <button class="btn btn-primary" id="doc-print">🖨 प्रिंट</button>
    </div>
    <div class="two-col">
      <div class="card">
        <h2>${tpl.icon} ${esc(tpl.name)}</h2>
        <p class="muted small" style="margin-bottom:12px">${esc(tpl.desc)}</p>
        <form id="doc-form" class="form-grid">
          ${tpl.fields.map(f => `
            <div class="fld ${f.type === "textarea" ? "full" : ""}">
              <label>${esc(f.label)}</label>
              ${f.type === "textarea"
                ? `<textarea data-fid="${f.id}">${esc(prefill[f.id] || "")}</textarea>`
                : `<input type="${f.type === "date" ? "date" : "text"}" data-fid="${f.id}" value="${esc(prefill[f.id] || "")}">`}
            </div>`).join("")}
        </form>
      </div>
      <div class="card">
        <h2>पूर्वावलोकन</h2>
        <div class="doc-preview" id="doc-preview"></div>
      </div>
    </div>`;

  function values() {
    const v = {};
    $$("#doc-form [data-fid]").forEach(i => {
      let val = i.value;
      if (i.type === "date" && val) val = fmtDate(val);
      v[i.dataset.fid] = val;
    });
    return v;
  }
  function refresh() { $("#doc-preview").textContent = tpl.body(values()); }
  $("#doc-form").addEventListener("input", refresh);
  refresh();

  $("#doc-print").addEventListener("click", () => {
    $("#print-area").textContent = tpl.body(values());
    window.print();
  });
  $("#doc-copy").addEventListener("click", async () => {
    try { await navigator.clipboard.writeText(tpl.body(values())); toast("दस्तावेज़ कॉपी हो गया"); }
    catch (e) { toast("कॉपी नहीं हो सका"); }
  });
  $("#doc-download").addEventListener("click", () => {
    const blob = new Blob(["﻿" + tpl.body(values())], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = tpl.id + ".txt";
    a.click();
    URL.revokeObjectURL(a.href);
  });
}

/* ---------- Links ---------- */
function renderLinks(el) {
  el.innerHTML = `
    <div class="link-grid">
      ${USEFUL_LINKS.map(l => `
        <a class="link-card" href="${esc(l.url)}" target="_blank" rel="noopener">
          <div class="lk-name">${esc(l.name)} ↗</div>
          <div class="lk-desc">${esc(l.desc)}</div>
          <div class="lk-url">${esc(l.url)}</div>
        </a>`).join("")}
    </div>`;
}

/* ---------- Settings ---------- */
function renderSettings(el) {
  const s = store.settings;
  el.innerHTML = `
    <div class="two-col">
      <div class="card">
        <h2>👤 अधिवक्ता / कार्यालय विवरण</h2>
        <p class="muted small" style="margin-bottom:12px">यह विवरण दस्तावेज़ टेम्पलेट में स्वतः भर जाएगा।</p>
        <form id="settings-form" class="form-grid">
          <div class="fld"><label>अधिवक्ता का नाम</label><input id="sf-name" value="${esc(s.advocateName)}"></div>
          <div class="fld"><label>पंजीयन क्रमांक</label><input id="sf-enroll" value="${esc(s.enrollNo)}"></div>
          <div class="fld full"><label>चेंबर / कार्यालय का पता</label><input id="sf-chamber" value="${esc(s.chamber)}"></div>
          <div class="fld"><label>मोबाइल</label><input id="sf-mobile" value="${esc(s.mobile)}"></div>
          <div class="fld"><label>तहसील</label><input id="sf-tehsil" value="${esc(s.tehsil)}"></div>
          <div class="fld"><label>जिला</label><input id="sf-district" value="${esc(s.district)}"></div>
          <div class="form-actions full"><button type="submit" class="btn btn-primary">सहेजें</button></div>
        </form>
      </div>
      <div>
        <div class="card">
          <h2>💾 बैकअप / डेटा</h2>
          <p class="muted small" style="margin-bottom:12px">
            सारा डेटा (${store.cases.length} प्रकरण, ${store.clients.length} पक्षकार) इसी ब्राउज़र में सुरक्षित है।
            समय-समय पर बैकअप फाइल डाउनलोड कर लें।
          </p>
          <div style="display:grid; gap:8px">
            <button class="btn btn-block" id="bk-export">⬇ बैकअप डाउनलोड करें (.json)</button>
            <label class="btn btn-block" style="cursor:pointer">
              ⬆ बैकअप से वापस लाएँ <input type="file" id="bk-import" accept=".json" hidden>
            </label>
            <button class="btn btn-danger btn-block" id="bk-clear">🗑 सारा डेटा मिटाएँ</button>
          </div>
        </div>
        <div class="card small muted">
          <b>Vakeel Mitra</b> — तहसील अधिवक्ता कार्य-प्रबंधन प्रणाली (छत्तीसगढ़)।
          बिना इंटरनेट चलती है; कोई डेटा बाहर नहीं जाता।
        </div>
      </div>
    </div>`;

  $("#settings-form").addEventListener("submit", (e) => {
    e.preventDefault();
    store.settings = {
      advocateName: $("#sf-name").value.trim(),
      enrollNo: $("#sf-enroll").value.trim(),
      chamber: $("#sf-chamber").value.trim(),
      mobile: $("#sf-mobile").value.trim(),
      tehsil: $("#sf-tehsil").value.trim(),
      district: $("#sf-district").value.trim()
    };
    saveStore(); updateSidebarName(); toast("विवरण सहेजा गया");
  });

  $("#bk-export").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(store, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `vakeel-sathi-backup-${todayISO()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast("बैकअप डाउनलोड हुआ");
  });

  $("#bk-import").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data || !Array.isArray(data.cases) || !Array.isArray(data.clients)) throw new Error("अमान्य फाइल");
        if (!confirm(`बैकअप में ${data.cases.length} प्रकरण व ${data.clients.length} पक्षकार हैं। वर्तमान डेटा इससे बदल जाएगा। जारी रखें?`)) return;
        store = Object.assign(defaultStore(), data);
        saveStore(); updateSidebarName(); route(); toast("बैकअप से डेटा वापस आ गया");
      } catch (err) { alert("फाइल पढ़ने में त्रुटि: " + err.message); }
    };
    reader.readAsText(file);
  });

  $("#bk-clear").addEventListener("click", () => {
    if (!confirm("क्या आप वाकई सारा डेटा (प्रकरण, पक्षकार, फीस) स्थायी रूप से मिटाना चाहते हैं?")) return;
    if (!confirm("यह क्रिया वापस नहीं हो सकती। पक्का मिटाएँ?")) return;
    store = defaultStore();
    saveStore(); updateSidebarName(); route(); toast("सारा डेटा मिटा दिया गया");
  });
}

/* ---------- Global search ---------- */
function renderSearch(el, q) {
  const ql = q.toLowerCase();
  const svcHits = [];
  SERVICE_CATEGORIES.forEach(cat => cat.items.forEach(i => {
    if (i.toLowerCase().includes(ql)) svcHits.push({ cat, item: i });
  }));
  const caseHits = store.cases.filter(c =>
    (c.no || "").toLowerCase().includes(ql) || (c.service || "").toLowerCase().includes(ql) ||
    (c.courtCaseNo || "").toLowerCase().includes(ql) ||
    (clientById(c.clientId)?.name || "").toLowerCase().includes(ql) ||
    (c.opponent || "").toLowerCase().includes(ql));
  const clientHits = store.clients.filter(c =>
    c.name.toLowerCase().includes(ql) || (c.mobile || "").includes(ql) || (c.village || "").toLowerCase().includes(ql));
  const tplHits = DOC_TEMPLATES.filter(t => t.name.toLowerCase().includes(ql) || t.desc.toLowerCase().includes(ql));

  el.innerHTML = `
    <div class="card"><h2>"${esc(q)}" के लिए परिणाम</h2>
      <div class="muted small">${svcHits.length} सेवाएँ • ${caseHits.length} प्रकरण • ${clientHits.length} पक्षकार • ${tplHits.length} टेम्पलेट</div>
    </div>
    ${caseHits.length ? `<div class="card"><h2>📁 प्रकरण</h2>${caseTable(caseHits)}</div>` : ""}
    ${clientHits.length ? `<div class="card"><h2>👥 पक्षकार</h2><ul class="plain-list">
      ${clientHits.map(c => `<li><b>${esc(c.name)}</b> <span class="muted small">${esc([c.father, c.village, c.mobile].filter(Boolean).join(" • "))}</span></li>`).join("")}
    </ul></div>` : ""}
    ${tplHits.length ? `<div class="card"><h2>📝 दस्तावेज़ टेम्पलेट</h2><ul class="plain-list">
      ${tplHits.map(t => `<li><a href="#/doc/${t.id}">${t.icon} ${esc(t.name)}</a> <span class="muted small">${esc(t.desc)}</span></li>`).join("")}
    </ul></div>` : ""}
    ${svcHits.length ? `<div class="card"><h2>📋 सेवाएँ</h2><ul class="plain-list">
      ${svcHits.slice(0, 40).map(h => `<li>
        <span style="flex:1">${esc(h.item)} <span class="badge cat">${esc(h.cat.name)}</span></span>
        <button class="btn btn-sm" onclick="openCaseForm(null,'${h.cat.id}','${esc(h.item).replace(/'/g, "\\'")}')">+ प्रकरण</button>
      </li>`).join("")}
    </ul></div>` : ""}
    ${(!svcHits.length && !caseHits.length && !clientHits.length && !tplHits.length)
      ? `<div class="card empty"><span class="big">🔍</span>कुछ नहीं मिला</div>` : ""}`;
}

/* ---------- Wiring ---------- */
function updateSidebarName() {
  const s = store.settings;
  $("#advocate-name-side").textContent = s.advocateName ? `${s.advocateName}${s.enrollNo ? " • " + s.enrollNo : ""}` : "";
}

$("#quick-new-case").addEventListener("click", () => openCaseForm());
$("#hamburger").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
$("#sidebar-backdrop").addEventListener("click", () => $("#sidebar").classList.remove("open"));
$("#global-search").addEventListener("keydown", (e) => {
  if (e.key === "Enter" && e.target.value.trim()) {
    location.hash = "#/search/" + encodeURIComponent(e.target.value.trim());
  }
});

updateSidebarName();
route();
