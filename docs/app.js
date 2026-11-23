(() => {
  "use strict";

  // --- 1. Accessible Tabs (with hidden="until-found" + beforematch sync + keyboard fallback) ---
  const tabs = Array.from(document.querySelectorAll('[role="tab"]'));
  const panels = Array.from(document.querySelectorAll('[role="tabpanel"]'));

  function selectTab(targetTab, moveFocus = false) {
    for (const tab of tabs) {
      const active = tab === targetTab;
      tab.setAttribute("aria-selected", active ? "true" : "false");
      tab.toggleAttribute("focusgroupstart", active);
      tab.tabIndex = active ? 0 : -1;
    }
    for (const panel of panels) {
      const match = panel.id === targetTab.dataset.panel;
      if (match) {
        panel.hidden = false;
      } else {
        panel.hidden = "until-found";
      }
    }
    targetTab.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (moveFocus) targetTab.focus();
  }

  for (const tab of tabs) {
    tab.addEventListener("click", () => selectTab(tab, false));
    tab.addEventListener("keydown", (e) => {
      const idx = tabs.indexOf(tab);
      if (e.key === "ArrowRight") {
        e.preventDefault();
        selectTab(tabs[(idx + 1) % tabs.length], true);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        selectTab(tabs[(idx - 1 + tabs.length) % tabs.length], true);
      } else if (e.key === "Home") {
        e.preventDefault();
        selectTab(tabs[0], true);
      } else if (e.key === "End") {
        e.preventDefault();
        selectTab(tabs[tabs.length - 1], true);
      }
    });
  }

  for (const panel of panels) {
    panel.addEventListener("beforematch", () => {
      const owner = tabs.find((t) => t.dataset.panel === panel.id);
      if (owner) selectTab(owner, false);
    });
  }

  // --- 2. Offline PII Redactor & Restorer (Separated Masked Copy Box vs Read-Only Restore Preview) ---
  const PII_RULES = [
    ["EMAIL", /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g],
    ["PHONE", /(?:\+81-?|0)\d{1,4}-\d{1,4}-\d{3,4}/g],
    ["POSTAL", /〒?\d{3}-\d{4}/g],
    ["API_KEY", /\b(?:sk|rk|pk|ghp|gho|AIza)[A-Za-z0-9_-]{12,}\b/g],
    ["LONG_ID", /\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b|\b\d{12,16}\b/g],
    ["IP_ADDR", /\b(?:\d{1,3}\.){3}\d{1,3}\b/g],
    // Labeled personal names (e.g. 担当: 山田太郎 / 氏名：佐藤花子) — preserves label, redacts name only
    ["PERSON", /((?:担当(?:者)?|氏名|お名前|顧客名|宛先|ご担当)\s*[:：]\s*)([\u4e00-\u9fff\u3040-\u30ffA-Za-z]{2,12}(?:[ \u3000][\u4e00-\u9fff\u3040-\u30ffA-Za-z]{1,10})?)/g],
    // Honorific personal names (e.g. 山田様 / 山田太郎様 / 佐藤さん / 田中殿)
    ["PERSON", /([\u4e00-\u9fff\u30a0-\u30ff]{1,5}(?:[ \u3000][\u4e00-\u9fff\u30a0-\u30ff]{1,5})?)(様|さん|殿|氏)/g],
  ];
  let reverseMap = new Map();
  let lang = "ja";

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  function runPiiMask() {
    const srcEl = document.getElementById("pii-in");
    const customEl = document.getElementById("pii-custom");
    const outEl = document.getElementById("pii-out");
    const restoreWrap = document.getElementById("pii-restore-wrap");
    const restoredEl = document.getElementById("pii-restored-out");
    const statEl = document.getElementById("pii-stat");
    let text = srcEl.value || "";
    reverseMap = new Map();
    const forward = new Map();
    const seqByLabel = new Map();
    let count = 0;

    function registerToken(label, secret) {
      if (!forward.has(secret)) {
        const nextSeq = (seqByLabel.get(label) || 0) + 1;
        seqByLabel.set(label, nextSeq);
        const tok = `[${label}_${nextSeq}]`;
        forward.set(secret, tok);
        reverseMap.set(tok, secret);
      }
      count += 1;
      return forward.get(secret);
    }

    // 1. User-specified custom sensitive terms (names, company names, project names) first
    const customTerms = String((customEl && customEl.value) || "")
      .split(/[,、\n]+/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .sort((a, b) => b.length - a.length);
    for (const term of customTerms) {
      const re = new RegExp(escapeRegex(term), "g");
      text = text.replace(re, (m) => registerToken("CUSTOM", m));
    }

    // 2. Built-in structured & labeled/honorific name rules
    for (const [label, regex] of PII_RULES) {
      text = text.replace(regex, (...args) => {
        const full = args[0];
        if (label === "PERSON" && args.length >= 5) {
          // Group 1 & 2 depend on pattern type (labeled prefix vs honorific suffix)
          const g1 = args[1];
          const g2 = args[2];
          if (/[:：]\s*$/.test(g1)) {
            return g1 + registerToken("PERSON", g2);
          }
          return registerToken("PERSON", g1) + g2;
        }
        return registerToken(label, full);
      });
    }

    outEl.value = text;
    // Always hide & clear separate restore preview when remasking to prevent stale sensitive exposure
    if (restoreWrap && restoredEl) {
      restoredEl.value = "";
      restoreWrap.hidden = true;
    }
    statEl.textContent =
      lang === "en"
        ? `Redacted ${count} pattern matches (${reverseMap.size} unique tokens) locally (0 bytes sent). Always visually review before pasting into external AI.`
        : `✅ ${count}件（ユニーク${reverseMap.size}種）をローカル仮名化しました（外部通信 0 バイト・貼付前に必ず目視確認してください）`;
  }

  document.getElementById("form-pii").addEventListener("submit", (e) => {
    e.preventDefault();
    runPiiMask();
    const strip = document.querySelector("#panel-pii .offer-strip");
    if (strip) strip.classList.add("ready-boost");
  });

  const customInput = document.getElementById("pii-custom");
  if (customInput) {
    customInput.addEventListener("input", runPiiMask);
  }

  const PII_PRESETS = {
    mail: "株式会社サンプル 営業部 山田太郎様\n連絡先: yamada.taro@example.co.jp / 携帯: 090-1234-5678 / 〒100-0001\nご注文番号 4242-4242-4242-4242 の見積り改定をお願いします。",
    log: "2026-11-23 ERROR auth failed for admin@corp.example.com (ip=192.168.10.25) token=sk_live_demo1234567890abcd phone=03-1234-5678",
    clear: "",
  };
  for (const btn of document.querySelectorAll("[data-pii-preset]")) {
    btn.addEventListener("click", () => {
      const k = btn.getAttribute("data-pii-preset");
      document.getElementById("pii-in").value = PII_PRESETS[k] ?? "";
      if (customInput) {
        customInput.value = k === "mail" ? "株式会社サンプル" : "";
      }
      runPiiMask();
      const strip = document.querySelector("#panel-pii .offer-strip");
      if (strip && k !== "clear") strip.classList.add("ready-boost");
    });
  }

  document.getElementById("pii-copy").addEventListener("click", async () => {
    const out = document.getElementById("pii-out").value;
    const btn = document.getElementById("pii-copy");
    try {
      await navigator.clipboard.writeText(out);
      const prev = btn.textContent;
      btn.textContent = lang === "en" ? "✅ Copied Masked Only" : "✅ 仮名化済みのみコピーしました";
      setTimeout(() => {
        btn.textContent = prev;
      }, 1500);
    } catch {
      document.getElementById("pii-out").select();
    }
  });

  document.getElementById("pii-restore").addEventListener("click", () => {
    const maskedText = document.getElementById("pii-out").value || "";
    const restoreWrap = document.getElementById("pii-restore-wrap");
    const restoredEl = document.getElementById("pii-restored-out");
    let text = maskedText;
    for (const [tok, orig] of reverseMap.entries()) {
      text = text.split(tok).join(orig);
    }
    if (restoreWrap && restoredEl) {
      restoredEl.value = text;
      restoreWrap.hidden = false;
    }
    document.getElementById("pii-stat").textContent =
      lang === "en"
        ? "Restored into the separate read-only preview below. The copy box above stays masked."
        : "↩️ 下の閲覧専用プレビュー枠へ復元しました（上のコピー欄は仮名化済みのまま保持されます）。";
  });

  // --- 3. 5-Marketplace EC Margin & GMROI Calculator ---
  function parseNum(id, fallback = 0) {
    const raw = String(document.getElementById(id).value || "").replace(/[,¥\s]/g, "");
    const n = Number(raw);
    return Number.isFinite(n) ? n : fallback;
  }

  function recalcEc() {
    const mallSel = document.getElementById("ec-mall");
    const feePct = Number(mallSel.value) || 0;
    const fixedFee = mallSel.selectedIndex === 4 ? 40 : 0;
    const price = Math.max(0, parseNum("ec-price", 0));
    const cost = Math.max(0, parseNum("ec-cost", 0));
    const ship = Math.max(0, parseNum("ec-ship", 0));
    const retPct = Math.max(0, parseNum("ec-ret", 0));
    const days = Math.max(1, parseNum("ec-days", 14));

    const fee = Math.round((price * feePct) / 100) + fixedFee;
    const retLoss = Math.round((price * retPct) / 100);
    const net = price - cost - ship - fee - retLoss;
    const margin = price > 0 ? (net / price) * 100 : 0;
    const roi = cost > 0 ? (net / cost) * 100 : 0;
    const maxCost20 = Math.max(0, Math.floor(price * (1 - feePct / 100 - retPct / 100 - 0.2) - ship - fixedFee));
    const gmroi = cost > 0 ? ((net * (365 / days)) / cost) * 100 : 0;

    const ok = margin >= 20 && roi >= 25;
    const verdict =
      lang === "en"
        ? ok
          ? "✅ PASS (Net margin >= 20% and ROI >= 25%)"
          : net > 0
            ? "⚠️ THIN MARGIN (Raise price or bundle shipping)"
            : "❌ LOSS WARNING (Skip sourcing)"
        : ok
          ? "✅ 合格（純利益率20%以上・ROI 25%以上の安全基準クリア）"
          : net > 0
            ? "⚠️ 薄利注意（値上げ・送料圧縮・まとめ売りを推奨）"
            : "❌ 赤字警告（仕入れ見送り推奨）";

    const box = document.getElementById("ec-out");
    box.replaceChildren();
    const h = document.createElement("div");
    h.style.fontWeight = "800";
    h.textContent = verdict;
    box.appendChild(h);

    const grid = document.createElement("div");
    grid.className = "kpi-grid";
    const items =
      lang === "en"
        ? [
            ["Net Profit / Unit", `¥${net.toLocaleString()}`],
            ["Net Margin / Max ACOS", `${margin.toFixed(1)}%`],
            ["Max Sourcing Cost (20% Margin)", `¥${maxCost20.toLocaleString()}`],
            ["Annual GMROI", `${gmroi.toFixed(0)}%`],
          ]
        : [
            ["1個あたり実質手残り", `¥${net.toLocaleString()}`],
            ["実質純利益率 / 上限ACOS", `${margin.toFixed(1)}%`],
            ["純利20%死守の上限仕入", `¥${maxCost20.toLocaleString()}`],
            ["年間資金回転効率(GMROI)", `${gmroi.toFixed(0)}%`],
          ];
    for (const [k, v] of items) {
      const cell = document.createElement("div");
      const lk = document.createElement("div");
      lk.className = "muted";
      lk.textContent = k;
      const lv = document.createElement("div");
      lv.className = "kpi-val";
      lv.textContent = v;
      cell.append(lk, lv);
      grid.appendChild(cell);
    }
    box.appendChild(grid);
  }

  for (const id of ["ec-mall", "ec-price", "ec-cost", "ec-ship", "ec-ret", "ec-days"]) {
    document.getElementById(id).addEventListener("input", () => {
      recalcEc();
      const strip = document.querySelector("#panel-ec .offer-strip");
      if (strip) strip.classList.add("ready-boost");
    });
  }

  const EC_PRESETS = {
    mercari_bad: { idx: 0, price: "2000", cost: "1100", ship: "580", ret: "2.0", days: "30" },
    mercari_bundle: { idx: 0, price: "4980", cost: "1800", ship: "260", ret: "2.0", days: "12" },
    amazon_fba: { idx: 1, price: "6800", cost: "2400", ship: "650", ret: "3.0", days: "18" },
  };
  for (const btn of document.querySelectorAll("[data-ec-preset]")) {
    btn.addEventListener("click", () => {
      const p = EC_PRESETS[btn.getAttribute("data-ec-preset")];
      if (!p) return;
      document.getElementById("ec-mall").selectedIndex = p.idx;
      document.getElementById("ec-price").value = p.price;
      document.getElementById("ec-cost").value = p.cost;
      document.getElementById("ec-ship").value = p.ship;
      document.getElementById("ec-ret").value = p.ret;
      document.getElementById("ec-days").value = p.days;
      recalcEc();
      const strip = document.querySelector("#panel-ec .offer-strip");
      if (strip) strip.classList.add("ready-boost");
    });
  }

  // --- 4. 2026 Invoice 80% -> 70% Deduction & T-Number Check-Digit ---
  function verifyTNumber(raw) {
    const clean = String(raw || "").trim().toUpperCase();
    if (!clean) return null;
    if (!/^T\d{13}$/.test(clean)) return { valid: false, reason: "FORMAT" };
    const digits = clean.slice(1).split("").map(Number);
    const check = digits[0];
    let total = 0;
    for (let i = 1; i < 13; i += 1) {
      const posFromRight = 13 - i;
      const weight = posFromRight % 2 === 1 ? 1 : 2;
      total += digits[i] * weight;
    }
    const expected = 9 - (total % 9);
    return { valid: check === expected, expected };
  }

  function recalcInv() {
    const amt = Math.max(0, parseNum("inv-amt", 0));
    const cnt = Math.max(0, parseNum("inv-cnt", 0));
    const annual = amt * cnt;
    const taxPart = Math.round(annual * (10 / 110));
    const burden80 = Math.round(taxPart * 0.2);
    const burden70 = Math.round(taxPart * 0.3);
    const delta = burden70 - burden80;
    const tRes = verifyTNumber(document.getElementById("inv-tnum").value);

    const box = document.getElementById("inv-out");
    box.replaceChildren();
    const grid = document.createElement("div");
    grid.className = "kpi-grid";
    const items =
      lang === "en"
        ? [
            ["Annual Spend (Tax Incl.)", `¥${annual.toLocaleString()}`],
            ["Tax Burden @80% (Until Sep 2026)", `¥${burden80.toLocaleString()}`],
            ["Tax Burden @70% (From Oct 2026)", `¥${burden70.toLocaleString()}`],
            ["Extra Annual Burden (+10% Gap)", `+¥${delta.toLocaleString()}`],
          ]
        : [
            ["年間支払総額（税込）", `¥${annual.toLocaleString()}`],
            ["80%控除時の税負担（〜2026/9）", `¥${burden80.toLocaleString()}`],
            ["70%控除時の税負担（2026/10〜）", `¥${burden70.toLocaleString()}`],
            ["年間手残り減少インパクト", `+¥${delta.toLocaleString()}`],
          ];
    for (const [k, v] of items) {
      const cell = document.createElement("div");
      const lk = document.createElement("div");
      lk.className = "muted";
      lk.textContent = k;
      const lv = document.createElement("div");
      lv.className = "kpi-val";
      lv.textContent = v;
      cell.append(lk, lv);
      grid.appendChild(cell);
    }
    box.appendChild(grid);

    if (tRes !== null) {
      const p = document.createElement("p");
      p.style.margin = "12px 0 0";
      p.style.fontWeight = "700";
      if (tRes.valid) {
        p.textContent =
          lang === "en"
            ? "✅ T-Number check digit is mathematically valid (Modulus-9)."
            : "✅ T番号チェックデジット整合OK（13桁法人番号チェック通過）";
      } else {
        p.textContent =
          lang === "en"
            ? "❌ Invalid T-Number format or check digit (must be T + 13 digits)."
            : "❌ T番号の形式またはチェックデジットが一致しません（T＋半角13桁を確認してください）";
      }
      box.appendChild(p);
    }
  }

  for (const id of ["inv-amt", "inv-cnt", "inv-tnum"]) {
    document.getElementById(id).addEventListener("input", recalcInv);
  }

  // --- 5. Bilingual JA / EN Toggle ---
  const I18N_EN = {
    csp_badge: "CSP connect-src 'none' · 0 Bytes Sent",
    hero_badge: "No Sign-Up · 100% Free · Runs Locally in Your Browser",
    hero_title: "Zero-Cloud Offline Business Tools:\nPII Redactor, EC Margin & Invoice Math",
    hero_desc: "Every calculation and redaction runs strictly inside your browser with zero external requests enforced by Content-Security-Policy.",
    hero_cta_300: "⚡ Get Offline HTML + Python PII Redactor — ¥300 (~$2 USD on note.com)",
    hero_cta_bundle: "📦 Complete Automation & Unit-Economics Bundle — ¥4,980 (64% OFF)",
    tab_pii: "🛡️ Offline PII Redactor",
    tab_ec: "🧮 5-EC Margin & GMROI",
    tab_inv: "🧾 2026 JP Invoice 70% Check",
    pii_title: "Offline PII & API-Key Pre-Processing Redactor (Local Helper)",
    pii_desc: "Replaces structured patterns (emails, phones, postal codes, 12–16 digit IDs, IPs, API keys, labeled/honorific JP names, and custom terms) locally with 0 bytes sent. Pattern-based redaction is not 100% exhaustive—always visually review before pasting into external AI.",
    pii_custom_label: "Custom Sensitive Terms to Redact (names, company, project — comma-separated)",
    pii_pre_mail: "📩 Try Customer Email Sample",
    pii_pre_log: "💻 Try Leaked API-Key Log",
    pii_pre_clear: "🧹 Clear",
    ec_pre_bad: "⚠️ Thin-Margin Example (¥2,000)",
    ec_pre_bundle: "✅ High-Margin 3-Item Bundle (¥4,980)",
    ec_pre_amz: "📦 Amazon FBA Example (¥6,800)",
    pii_in_label: "Original Text (100% Local Execution)",
    pii_btn_mask: "🛡️ Redact Locally Now",
    pii_btn_copy: "📋 Copy Masked Text Only",
    pii_btn_restore: "↩️ Preview Restored Separately",
    pii_out_label: "Masked Output (Copy Box — Always Visually Review Before Pasting)",
    pii_restore_warn: "⚠️ Restored Preview (Contains Original Sensitive Values — Read-Only, Do Not Paste into External AI)",
    pii_offer_title: "Want the standalone 1-file offline HTML + Python CLI on your machine forever?",
    pii_offer_sub: "One-time purchase (¥300 ≈ $2 USD via note.com, international cards accepted). Zero subscriptions.",
    pii_offer_btn: "⚡ Buy Full Source Pack — ¥300 (~$2 USD)",
    ec_title: "5-Marketplace EC Breakeven, Net Margin & Annual GMROI Calculator",
    ec_desc: "Deduct marketplace fees, shipping, and return buffers to compute unit net profit, max sourcing cost for 20% margin, and annual capital velocity (GMROI).",
    ec_mall: "Marketplace Fee Preset",
    ec_price: "Selling Price (JPY)",
    ec_cost: "Unit Cost (JPY)",
    ec_ship: "Shipping + Packaging (JPY)",
    ec_ret: "Return / Markdown Buffer (%)",
    ec_days: "Estimated Days to Sell",
    ec_offer_title: "Want this 5-EC calculator + CSV audit log as a standalone offline file forever?",
    ec_offer_sub: "Double-click offline HTML app + batch CSV Python CLI screener (¥300 ≈ $2 USD on note.com).",
    ec_offer_btn: "⚡ Buy Full Source Pack — ¥300 (~$2 USD)",
    inv_title: "Japan Oct 2026 Invoice System (80% → 70% Deduction) & T-Number Validator",
    inv_desc: "Estimate annual tax-burden increase from Oct 2026 and verify Japanese T+13-digit invoice registration check digits offline.",
    inv_amt: "Tax-Inclusive Payment per Invoice (JPY)",
    inv_cnt: "Invoices per Year",
    inv_tnum: "T-Number Check-Digit Validation (e.g. T1234567890123)",
    inv_offer_title: "3-Minute Practical Checklist for the Oct 2026 Japan Invoice Change (Free)",
    inv_offer_sub: "Arithmetic estimation only — not individualized tax or legal advice.",
    inv_offer_btn: "📖 Read Free Checklist (note.com)",
    cat_title: "Ready-to-Use Offline Software & Playbooks (Instant Purchase via note.com)",
    p1_t: "Standalone Offline PII Redactor HTML + Python CLI Full Source",
    p1_d: "Double-click offline HTML app + zero-dependency Python CLI with local restore map. One-time fee, $0/month.",
    p2_t: "Standalone 5-EC Margin & GMROI Offline HTML + Batch CSV Python CLI",
    p2_d: "Double-click offline HTML calculator with CSV ledger export + batch SKU screener CLI. One-time ¥300.",
    p3_t: "Complete AI Automation & Business Unit-Economics Bundle (64% OFF)",
    p3_d: "All paid playbooks and scripts bundled at 64% off (¥14,120 value → ¥4,980), including future additions.",
    buy_now: "Buy Now (note.com)",
    buy_bundle: "Get 64% OFF Bundle (note.com)",
    foot_disc: "Disclaimer: All processing runs locally in your browser with zero external data transmission. Arithmetic tools do not constitute individualized tax or legal advice.",
  };
  const I18N_JA = {};
  for (const el of document.querySelectorAll("[data-i18n]")) {
    I18N_JA[el.dataset.i18n] = el.textContent;
  }

  document.getElementById("lang-toggle").addEventListener("click", (e) => {
    lang = lang === "ja" ? "en" : "ja";
    document.documentElement.lang = lang;
    e.currentTarget.setAttribute("aria-pressed", lang === "en" ? "true" : "false");
    e.currentTarget.textContent = lang === "en" ? "🌐 日本語" : "🌐 English";
    const dict = lang === "en" ? I18N_EN : I18N_JA;
    for (const el of document.querySelectorAll("[data-i18n]")) {
      const k = el.dataset.i18n;
      if (dict[k]) el.textContent = dict[k];
    }
    runPiiMask();
    recalcEc();
    recalcInv();
  });

  // Honor direct URL hash (#panel-ec / #panel-inv / #panel-pii)
  const hashPanel = (window.location.hash || "").replace(/^#/, "");
  const hashTab = tabs.find((t) => t.dataset.panel === hashPanel);
  if (hashTab) selectTab(hashTab, false);

  // Initial calculation on load
  runPiiMask();
  recalcEc();
  recalcInv();
})();
