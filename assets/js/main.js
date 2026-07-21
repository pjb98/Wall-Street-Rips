(() => {
  const STOCKS = [
    { ticker: "AAPL", name: "Apple",     odds: "18.4%", price: "$212.40", tier: "common" },
    { ticker: "NVDA", name: "Nvidia",    odds: "9.2%",  price: "$134.80", tier: "rare" },
    { ticker: "TSLA", name: "Tesla",     odds: "12.6%", price: "$268.15", tier: "common" },
    { ticker: "MSFT", name: "Microsoft", odds: "15.1%", price: "$441.90", tier: "common" },
    { ticker: "AMZN", name: "Amazon",    odds: "10.8%", price: "$196.30", tier: "common" },
    { ticker: "GOOG", name: "Alphabet",  odds: "8.7%",  price: "$178.55", tier: "rare" },
    { ticker: "META", name: "Meta",      odds: "7.5%",  price: "$602.20", tier: "rare" },
    { ticker: "BRK",  name: "Berkshire", odds: "2.1%",  price: "$705.00", tier: "legendary" },
  ];

  const NAMES = ["0x4a2f…9c31", "0x81ab…44e2", "0xffa0…12bd", "0x22c9…7a0f", "0x9de4…c831", "0x0f5b…88aa"];

  const state = {
    lang: "en",
    connected: false,
    balance: 250,
    feed: [],
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

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

  /* ---------- Wallet connect (mock) ---------- */
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
      state.connected = true;
      connectBtn.textContent = "0x71…3f9a";
      connectBtn.classList.add("connected");
      walletModal.classList.remove("open");
      toast(`Connected via ${btn.dataset.wallet}`);
    });
  });

  /* ---------- Odds table ---------- */
  const oddsBody = $("#oddsTable tbody");
  oddsBody.innerHTML = STOCKS.map(s => `
    <tr>
      <td>
        <div class="ticker-cell">
          <span class="ticker-badge">${s.ticker.slice(0, 2)}</span>
          ${s.ticker} <span style="color:var(--text-muted);font-weight:400">· ${s.name}</span>
        </div>
      </td>
      <td class="odds-val">${s.odds}</td>
      <td class="price-val">${s.price}</td>
    </tr>
  `).join("");

  /* ---------- Collection ---------- */
  const collectionGrid = $("#collectionGrid");
  const owned = new Set();
  function renderCollection() {
    collectionGrid.innerHTML = STOCKS.map(s => `
      <div class="coll-card ${owned.has(s.ticker) ? "owned" : ""}">
        <div class="coll-badge">${s.ticker.slice(0, 2)}</div>
        <div>${s.ticker}</div>
        <div class="coll-status">${owned.has(s.ticker) ? "Owned" : "Not yet"}</div>
      </div>
    `).join("");
  }
  renderCollection();

  /* ---------- Live activity feed + leaderboard ---------- */
  const feedList = $("#feedList");
  const rankList = $("#rankList");
  const leaderboard = {};

  function randOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function pushFeedEntry(who, stock, shares) {
    state.feed.unshift({ who, stock, shares, ts: Date.now() });
    state.feed = state.feed.slice(0, 12);
    leaderboard[who] = (leaderboard[who] || 0) + shares * parseFloat(stock.price.replace(/[^0-9.]/g, ""));
    renderFeed();
    renderLeaderboard();
  }

  function renderFeed() {
    feedList.innerHTML = state.feed.map(f => {
      const secs = Math.max(1, Math.floor((Date.now() - f.ts) / 1000));
      const when = secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`;
      return `<li>
        <span class="who">${f.who}</span>
        <span class="what">won <strong>${f.shares} ${f.stock.ticker}</strong></span>
        <span class="when">${when}</span>
      </li>`;
    }).join("") || `<li><span class="who">—</span><span class="what">No activity yet</span></li>`;
  }

  function renderLeaderboard() {
    const ranked = Object.entries(leaderboard).sort((a, b) => b[1] - a[1]).slice(0, 6);
    rankList.innerHTML = ranked.map(([who, val], i) => `
      <li>
        <span class="rank-num">${i + 1}</span>
        <span class="rank-who">${who}</span>
        <span class="rank-val">$${val.toFixed(0)}</span>
      </li>
    `).join("") || `<li><span class="rank-num">–</span><span class="rank-who">No data yet</span></li>`;
  }

  function simulateActivity() {
    const who = randOf(NAMES);
    const stock = randOf(STOCKS);
    const shares = Math.max(1, Math.floor(Math.random() * 5));
    pushFeedEntry(who, stock, shares);
  }
  for (let i = 0; i < 5; i++) simulateActivity();
  setInterval(simulateActivity, 4000);
  setInterval(renderFeed, 15000);

  /* ---------- Box opening ---------- */
  const prizeModal = $("#prizeModal");
  const modalClose = $("#modalClose");
  const modalStatus = $("#modalStatus");
  const modalBody = $("#modalBody");
  const modalActions = $("#modalActions");
  const balanceHint = $("#balanceHint");

  modalClose.addEventListener("click", () => prizeModal.classList.remove("open"));
  prizeModal.addEventListener("click", (e) => { if (e.target === prizeModal) prizeModal.classList.remove("open"); });

  function weightedPick() {
    const weights = { common: 3, rare: 1.4, legendary: 0.3 };
    const pool = STOCKS.flatMap(s => Array(Math.round(weights[s.tier] * 10)).fill(s));
    return randOf(pool);
  }

  function openBox(card) {
    const cost = parseInt(card.dataset.cost, 10);

    if (!state.connected) {
      toast("Connect wallet to open — running in demo mode");
    }
    if (state.balance < cost) {
      toast("Insufficient balance");
      return;
    }

    prizeModal.classList.add("open");
    modalStatus.textContent = "Confirming on-chain…";
    modalBody.innerHTML = `<div class="prize-emoji">📦</div><div class="prize-sub">Opening…</div>`;
    modalActions.innerHTML = "";

    setTimeout(() => {
      modalStatus.textContent = "Opening…";
    }, 500);

    setTimeout(() => {
      state.balance -= cost;
      balanceHint.textContent = state.balance;

      const prize = weightedPick();
      const shares = Math.max(1, Math.floor(Math.random() * 4));
      owned.add(prize.ticker);
      renderCollection();
      pushFeedEntry(state.connected ? "0x71…3f9a" : "You", prize, shares);

      modalStatus.textContent = "You got";
      modalBody.innerHTML = `
        <div class="prize-emoji">🏆</div>
        <div class="prize-name">${shares} × ${prize.ticker}</div>
        <div class="prize-sub">shares · cost ${cost} RIPS</div>
      `;
      modalActions.innerHTML = `
        <button class="btn btn-ghost" id="prizeKeep">Add to collection</button>
        <button class="btn btn-primary" id="prizeAgain">Open another</button>
      `;
      $("#prizeKeep").addEventListener("click", () => prizeModal.classList.remove("open"));
      $("#prizeAgain").addEventListener("click", () => {
        prizeModal.classList.remove("open");
        setTimeout(() => openBox(card), 200);
      });
    }, 1400);
  }

  $$("[data-open-box]").forEach(el => {
    el.addEventListener("click", () => {
      const card = el.closest(".box-card");
      openBox(card);
    });
  });

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

  /* ---------- Live assets stat tick ---------- */
  const liveAssetsStat = $("#liveAssetsStat");
  setInterval(() => {
    const base = 128;
    liveAssetsStat.textContent = base + Math.floor(Math.random() * 6);
  }, 5000);
})();
