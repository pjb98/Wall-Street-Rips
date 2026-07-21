(() => {
  const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary"];
  const RARITY_LABEL = {
    common: "Common",
    uncommon: "Uncommon",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
  };

  // Mirrors each on-chain Pack: its own prize weight table, price, and pity rule.
  const PACKS = {
    mini: {
      id: 1,
      cost: 10,
      pityEvery: 0,
      pityMinimum: "common",
      prizes: [
        { ticker: "AAPL", name: "Apple",     shares: 1, weight: 380, rarity: "common" },
        { ticker: "MSFT", name: "Microsoft", shares: 1, weight: 300, rarity: "common" },
        { ticker: "AMZN", name: "Amazon",    shares: 1, weight: 220, rarity: "uncommon" },
        { ticker: "NVDA", name: "Nvidia",    shares: 1, weight: 90,  rarity: "rare" },
        { ticker: "TSLA", name: "Tesla",     shares: 1, weight: 10,  rarity: "epic" },
      ],
    },
    standard: {
      id: 2,
      cost: 35,
      pityEvery: 10,
      pityMinimum: "uncommon",
      prizes: [
        { ticker: "AAPL", name: "Apple",     shares: 2, weight: 300, rarity: "common" },
        { ticker: "MSFT", name: "Microsoft", shares: 2, weight: 260, rarity: "common" },
        { ticker: "TSLA", name: "Tesla",     shares: 1, weight: 200, rarity: "uncommon" },
        { ticker: "GOOG", name: "Alphabet",  shares: 1, weight: 150, rarity: "rare" },
        { ticker: "META", name: "Meta",      shares: 1, weight: 70,  rarity: "epic" },
        { ticker: "NVDA", name: "Nvidia",    shares: 2, weight: 20,  rarity: "legendary" },
      ],
    },
    deluxe: {
      id: 3,
      cost: 100,
      pityEvery: 5,
      pityMinimum: "rare",
      prizes: [
        { ticker: "MSFT", name: "Microsoft", shares: 3, weight: 260, rarity: "common" },
        { ticker: "AMZN", name: "Amazon",    shares: 3, weight: 240, rarity: "uncommon" },
        { ticker: "GOOG", name: "Alphabet",  shares: 2, weight: 220, rarity: "rare" },
        { ticker: "META", name: "Meta",      shares: 2, weight: 180, rarity: "epic" },
        { ticker: "BRK",  name: "Berkshire", shares: 1, weight: 100, rarity: "legendary" },
      ],
    },
  };

  const MAX_OPEN_QUANTITY = 10;
  const NAMES = ["0x4a2f…9c31", "0x81ab…44e2", "0xffa0…12bd", "0x22c9…7a0f", "0x9de4…c831", "0x0f5b…88aa"];
  const CONTRACT_ADDRESS = "TBA"; // set once the contract is deployed

  const state = {
    lang: "en",
    connected: false,
    balance: 250,
    feed: [],
    requestCounter: 18_420,
    qty: { mini: 1, standard: 1, deluxe: 1 },
    opensByPack: { mini: 0, standard: 0, deluxe: 0 },
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const OPENING_PACK_SVG = `
    <svg viewBox="0 0 100 130" xmlns="http://www.w3.org/2000/svg" class="prize-pack-icon">
      <defs>
        <linearGradient id="packGradOpening" x1="14" y1="20" x2="86" y2="124" gradientUnits="userSpaceOnUse">
          <stop offset="0" stop-color="#e2e6ee"/>
          <stop offset="1" stop-color="#8891a0"/>
        </linearGradient>
        <clipPath id="packClipOpening"><rect x="14" y="20" width="72" height="104" rx="14"/></clipPath>
      </defs>
      <g clip-path="url(#packClipOpening)">
        <rect x="14" y="20" width="72" height="104" fill="url(#packGradOpening)"/>
        <rect x="14" y="20" width="72" height="20" fill="#ffffff33"/>
        <path d="M14 40 L22 34 L30 40 L38 34 L46 40 L54 34 L62 40 L70 34 L78 40 L86 34 L86 40 Z" fill="#ffffff4d"/>
      </g>
      <g fill="#ffffff" opacity="0.92">
        <rect x="36" y="86" width="9" height="18" rx="2"/>
        <rect x="49" y="76" width="9" height="28" rx="2"/>
        <rect x="62" y="66" width="9" height="38" rx="2"/>
      </g>
    </svg>
  `;

  /* ---------- Nav ---------- */
  const navToggle = $("#navToggle");
  const mainNav = $("#mainNav");
  navToggle.addEventListener("click", () => mainNav.classList.toggle("open"));
  $$("#mainNav a").forEach(a => a.addEventListener("click", () => mainNav.classList.remove("open")));

  /* ---------- Language switch (display-only labels) ---------- */
  const langBtn = $("#langBtn");
  const langMenu = $("#langMenu");
  langBtn.addEventListener("click", () => langMenu.classList.toggle("open"));
  document.addEventListener("click", (e) => {
    if (!$("#langSwitch").contains(e.target)) langMenu.classList.remove("open");
  });
  $$("#langMenu button").forEach(btn => {
    btn.addEventListener("click", () => {
      langBtn.textContent = btn.dataset.lang.toUpperCase();
      langMenu.classList.remove("open");
    });
  });

  /* ---------- Toast ---------- */
  let toastEl = document.createElement("div");
  toastEl.className = "toast";
  document.body.appendChild(toastEl);
  let toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove("show"), 2200);
  }

  /* ---------- Wallet connect (mock, with a simulated eligibility check) ---------- */
  const connectBtn = $("#connectBtn");
  const walletModal = $("#walletModal");
  const walletModalClose = $("#walletModalClose");

  connectBtn.addEventListener("click", () => {
    if (state.connected) {
      state.connected = false;
      connectBtn.textContent = "Connect wallet";
      connectBtn.classList.remove("connected");
      toast("Wallet disconnected");
      return;
    }
    walletModal.classList.add("open");
  });
  walletModalClose.addEventListener("click", () => walletModal.classList.remove("open"));
  walletModal.addEventListener("click", (e) => { if (e.target === walletModal) walletModal.classList.remove("open"); });

  $$(".wallet-opt").forEach(btn => {
    btn.addEventListener("click", () => {
      btn.disabled = true;
      toast("Checking jurisdiction eligibility…");
      setTimeout(() => {
        state.connected = true;
        connectBtn.textContent = "0x71…3f9a";
        connectBtn.classList.add("connected");
        walletModal.classList.remove("open");
        btn.disabled = false;
        toast(`Connected via ${btn.dataset.wallet} — wallet eligible`);
      }, 600);
    });
  });

  /* ---------- Odds tables (one independent weight table per pack) ---------- */
  const oddsBody = $("#oddsTable tbody");
  const oddsPityLine = $("#oddsPityLine");
  const oddsTabs = $$(".odds-tab");
  let activeOddsTier = "mini";

  function renderOddsTable(tier) {
    const pack = PACKS[tier];
    const totalWeight = pack.prizes.reduce((sum, p) => sum + p.weight, 0);

    oddsBody.innerHTML = pack.prizes
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .map(p => {
        const pct = (p.weight / totalWeight) * 100;
        return `
          <tr>
            <td>
              <div class="ticker-cell">
                <span class="ticker-badge">${p.ticker.slice(0, 2)}</span>
                ${p.shares} × ${p.ticker} <span style="color:var(--text-muted);font-weight:400">· ${p.name}</span>
              </div>
            </td>
            <td><span class="rarity-pill rarity-${p.rarity}">${RARITY_LABEL[p.rarity]}</span></td>
            <td class="odds-val">${pct.toFixed(1)}%</td>
          </tr>
        `;
      })
      .join("");

    oddsPityLine.innerHTML = pack.pityEvery
      ? `<strong>Pity floor:</strong> every ${pack.pityEvery}th open on this pack is guaranteed ${RARITY_LABEL[pack.pityMinimum]} or better, drawn from the table above.`
      : `<strong>No pity floor</strong> on this pack — every open follows the table above exactly.`;
  }

  oddsTabs.forEach(tab => {
    tab.addEventListener("click", () => {
      activeOddsTier = tab.dataset.oddsTab;
      oddsTabs.forEach(t => t.classList.toggle("active", t === tab));
      renderOddsTable(activeOddsTier);
    });
  });
  renderOddsTable(activeOddsTier);

  /* ---------- Collection (union of prizes across all packs) ---------- */
  const collectionGrid = $("#collectionGrid");
  const owned = new Set();
  const ALL_PRIZES = (() => {
    const seen = new Map();
    Object.values(PACKS).forEach(pack => {
      pack.prizes.forEach(p => { if (!seen.has(p.ticker)) seen.set(p.ticker, p); });
    });
    return Array.from(seen.values());
  })();

  function renderCollection() {
    collectionGrid.innerHTML = ALL_PRIZES.map(p => `
      <div class="coll-card ${owned.has(p.ticker) ? "owned" : ""}">
        <div class="coll-badge">${p.ticker.slice(0, 2)}</div>
        <div>${p.ticker}</div>
        <div class="coll-status">${owned.has(p.ticker) ? "Owned" : "Not yet"}</div>
      </div>
    `).join("");
  }
  renderCollection();

  /* ---------- Live activity feed + Rip Points leaderboard ---------- */
  const feedList = $("#feedList");
  const rankList = $("#rankList");
  const ripPoints = {};

  function randOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // Mirrors ripPoints[msg.sender] += paymentAmount — accrues on request, 1:1 with spend.
  function addRipPoints(who, amount) {
    ripPoints[who] = (ripPoints[who] || 0) + amount;
    renderLeaderboard();
  }

  function pushFeedEntry(who, prize) {
    state.feed.unshift({ who, prize, ts: Date.now() });
    state.feed = state.feed.slice(0, 12);
    renderFeed();
  }

  function renderFeed() {
    feedList.innerHTML = state.feed.map(f => {
      const secs = Math.max(1, Math.floor((Date.now() - f.ts) / 1000));
      const when = secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`;
      return `<li>
        <span class="who">${f.who}</span>
        <span class="what">won <strong>${f.prize.shares} ${f.prize.ticker}</strong>
          <span class="rarity-pill rarity-${f.prize.rarity}">${RARITY_LABEL[f.prize.rarity]}</span>
        </span>
        <span class="when">${when}</span>
      </li>`;
    }).join("") || `<li><span class="who">—</span><span class="what">No activity yet</span></li>`;
  }

  function renderLeaderboard() {
    const ranked = Object.entries(ripPoints).sort((a, b) => b[1] - a[1]).slice(0, 6);
    rankList.innerHTML = ranked.map(([who, val], i) => `
      <li>
        <span class="rank-num">${i + 1}</span>
        <span class="rank-who">${who}</span>
        <span class="rank-val">${val} pts</span>
      </li>
    `).join("") || `<li><span class="rank-num">–</span><span class="rank-who">No data yet</span></li>`;
  }

  function simulateActivity() {
    const who = randOf(NAMES);
    const tier = randOf(Object.keys(PACKS));
    const pack = PACKS[tier];
    const prize = drawPrize(tier, "common");
    pushFeedEntry(who, prize);
    addRipPoints(who, pack.cost);
  }
  for (let i = 0; i < 3; i++) simulateActivity();
  setInterval(simulateActivity, 9000);
  setInterval(renderFeed, 15000);

  /* ---------- Weighted draw with pity floor (mirrors _drawPrize) ---------- */
  function rarityAtLeast(rarity, minimum) {
    return RARITY_ORDER.indexOf(rarity) >= RARITY_ORDER.indexOf(minimum);
  }

  function drawPrize(tier, minimumRarity) {
    const pack = PACKS[tier];
    let pool = pack.prizes.filter(p => rarityAtLeast(p.rarity, minimumRarity));
    if (pool.length === 0) pool = pack.prizes; // a badly configured pity floor must not strand a draw

    const totalWeight = pool.reduce((sum, p) => sum + p.weight, 0);
    let roll = Math.random() * totalWeight;
    for (const p of pool) {
      roll -= p.weight;
      if (roll < 0) return p;
    }
    return pool[pool.length - 1];
  }

  /* ---------- Quantity steppers (openPack(packId, quantity), max 10) ---------- */
  $$(".pack-card").forEach(card => {
    const tier = card.dataset.tier;
    const unitCost = parseInt(card.dataset.cost, 10);
    const qtyValue = $("[data-qty-value]", card);
    const totalCostEl = $("[data-total-cost]", card);
    const decBtn = $("[data-qty-dec]", card);
    const incBtn = $("[data-qty-inc]", card);

    function syncQty() {
      const qty = state.qty[tier];
      qtyValue.textContent = qty;
      totalCostEl.textContent = unitCost * qty;
      decBtn.disabled = qty <= 1;
      incBtn.disabled = qty >= MAX_OPEN_QUANTITY;
    }

    decBtn.addEventListener("click", () => {
      state.qty[tier] = Math.max(1, state.qty[tier] - 1);
      syncQty();
    });
    incBtn.addEventListener("click", () => {
      state.qty[tier] = Math.min(MAX_OPEN_QUANTITY, state.qty[tier] + 1);
      syncQty();
    });
    syncQty();
  });

  /* ---------- Pack opening: request -> await randomness -> reveal ---------- */
  const prizeModal = $("#prizeModal");
  const modalClose = $("#modalClose");
  const modalStatus = $("#modalStatus");
  const modalBody = $("#modalBody");
  const modalActions = $("#modalActions");
  const balanceHint = $("#balanceHint");

  modalClose.addEventListener("click", () => prizeModal.classList.remove("open"));
  prizeModal.addEventListener("click", (e) => { if (e.target === prizeModal) prizeModal.classList.remove("open"); });

  function openPack(card) {
    const tier = card.dataset.tier;
    const pack = PACKS[tier];
    const qty = state.qty[tier];
    const totalCost = pack.cost * qty;

    if (!state.connected) {
      toast("Connect wallet to open — running in demo mode");
    }
    if (state.balance < totalCost) {
      toast("Insufficient balance");
      return;
    }

    // Payment escrows and Rip Points accrue as soon as the request is submitted,
    // independent of whether randomness has been fulfilled yet.
    state.balance -= totalCost;
    balanceHint.textContent = state.balance;
    const who = state.connected ? "0x71…3f9a" : "You";
    addRipPoints(who, totalCost);

    state.requestCounter += 1;
    const requestId = state.requestCounter;

    prizeModal.classList.add("open");
    modalStatus.textContent = "Submitting request…";
    modalBody.innerHTML = `
      <div class="prize-emoji">${OPENING_PACK_SVG}</div>
      <div class="prize-sub">Escrowing ${totalCost} USDG · requesting randomness</div>
    `;
    modalActions.innerHTML = "";

    setTimeout(() => {
      modalStatus.textContent = "Awaiting verifiable randomness…";
      modalBody.innerHTML = `
        <div class="prize-emoji">${OPENING_PACK_SVG}</div>
        <div class="prize-sub">Coordinator is fulfilling the request</div>
        <div class="request-id">Request #${requestId}</div>
      `;
    }, 500);

    setTimeout(() => {
      const results = [];
      for (let i = 0; i < qty; i++) {
        state.opensByPack[tier] += 1;
        const absoluteOpeningNumber = state.opensByPack[tier];
        const pity = pack.pityEvery !== 0 && absoluteOpeningNumber % pack.pityEvery === 0;
        const prize = drawPrize(tier, pity ? pack.pityMinimum : "common");
        results.push(prize);
        owned.add(prize.ticker);
        pushFeedEntry(who, prize);
      }
      renderCollection();

      if (qty === 1) {
        const prize = results[0];
        modalStatus.textContent = "You got";
        modalBody.innerHTML = `
          <div class="prize-emoji">🏆</div>
          <div class="prize-name">${prize.shares} × ${prize.ticker}</div>
          <span class="rarity-pill rarity-${prize.rarity}">${RARITY_LABEL[prize.rarity]}</span>
          <div class="prize-sub">cost ${totalCost} USDG · request #${requestId}</div>
        `;
      } else {
        modalStatus.textContent = `You got ${qty} prizes`;
        modalBody.innerHTML = `
          <div class="prize-list">
            ${results.map(p => `
              <div class="prize-row">
                <span class="prize-row-name">${p.shares} × ${p.ticker}</span>
                <span class="rarity-pill rarity-${p.rarity}">${RARITY_LABEL[p.rarity]}</span>
              </div>
            `).join("")}
          </div>
          <div class="prize-total">cost ${totalCost} USDG · request #${requestId}</div>
        `;
      }

      modalActions.innerHTML = `
        <button class="btn btn-ghost" id="prizeKeep">Add to collection</button>
        <button class="btn btn-primary" id="prizeAgain">Open another</button>
      `;
      $("#prizeKeep").addEventListener("click", () => prizeModal.classList.remove("open"));
      $("#prizeAgain").addEventListener("click", () => {
        prizeModal.classList.remove("open");
        setTimeout(() => openPack(card), 200);
      });
    }, 1700);
  }

  $$("[data-open-pack]").forEach(el => {
    el.addEventListener("click", () => {
      const card = el.closest(".pack-card");
      openPack(card);
    });
  });

  /* ---------- Contract address (kept in sync everywhere it's shown) ---------- */
  $("#contractAddr").textContent = CONTRACT_ADDRESS;
  $("#oddsContractAddr").textContent = CONTRACT_ADDRESS;

  /* ---------- Copy contract ---------- */
  const copyBtn = $("#copyContractBtn");
  copyBtn.addEventListener("click", async () => {
    const addr = $("#contractAddr").textContent.trim();
    if (addr === "TBA") { toast("Contract not deployed yet"); return; }
    try {
      await navigator.clipboard.writeText(addr);
      copyBtn.textContent = "Copied";
      toast("Address copied");
      setTimeout(() => (copyBtn.textContent = "Copy"), 1500);
    } catch {
      toast("Copy failed — select manually");
    }
  });

  /* ---------- Live assets stat (distinct stocks across all packs) ---------- */
  $("#liveAssetsStat").textContent = ALL_PRIZES.length;
})();
