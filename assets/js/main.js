(() => {
  const RARITY_ORDER = ["common", "uncommon", "rare", "epic", "legendary", "jackpot"];
  const RARITY_LABEL = {
    common: "Common",
    uncommon: "Uncommon",
    rare: "Rare",
    epic: "Epic",
    legendary: "Legendary",
    jackpot: "Jackpot",
  };

  const STOCK_NAMES = {
    AAPL: "Apple", MSFT: "Microsoft", AMZN: "Amazon", NVDA: "Nvidia",
    TSLA: "Tesla", GOOG: "Alphabet", META: "Meta", BRK: "Berkshire",
  };

  // Approximate live share price, used only to simulate the on-chain live
  // purchase (the contract spends a fixed USDG budget per prize and buys
  // whatever amount of stock that gets you at settlement time — it does not
  // pay out a fixed share count).
  const STOCK_PRICES = {
    AAPL: 212.40, MSFT: 441.90, AMZN: 196.30, NVDA: 134.80,
    TSLA: 268.15, GOOG: 178.55, META: 602.20, BRK: 705.00,
  };

  // Mirrors each on-chain Pack: its own prize weight table, bps splits, and
  // jackpot participation. Every prize is a USDG budget spent on a live
  // purchase, capped so it can never exceed what that one payment funds
  // after treasury/community/jackpot cuts.
  const PACKS = {
    mini: {
      id: 1,
      price: 10,
      treasuryBps: 1000, communityBps: 500, jackpotContributionBps: 200,
      jackpotWeight: 0, jackpotTarget: 0, // feeds the pool, can't win it
      prizes: [
        { ticker: "AAPL", weight: 380, rarity: "common",    purchaseValue: 3 },
        { ticker: "MSFT", weight: 300, rarity: "common",    purchaseValue: 3 },
        { ticker: "AMZN", weight: 220, rarity: "uncommon",  purchaseValue: 5 },
        { ticker: "NVDA", weight: 90,  rarity: "rare",      purchaseValue: 7 },
        { ticker: "TSLA", weight: 10,  rarity: "epic",      purchaseValue: 8 },
      ],
    },
    standard: {
      id: 2,
      price: 35,
      treasuryBps: 1000, communityBps: 500, jackpotContributionBps: 300,
      jackpotWeight: 15, jackpotTarget: 500,
      prizes: [
        { ticker: "AAPL", weight: 300, rarity: "common",    purchaseValue: 10 },
        { ticker: "MSFT", weight: 260, rarity: "common",    purchaseValue: 10 },
        { ticker: "TSLA", weight: 200, rarity: "uncommon",  purchaseValue: 15 },
        { ticker: "GOOG", weight: 150, rarity: "rare",      purchaseValue: 20 },
        { ticker: "META", weight: 70,  rarity: "epic",      purchaseValue: 25 },
        { ticker: "NVDA", weight: 20,  rarity: "legendary", purchaseValue: 28 },
      ],
    },
    deluxe: {
      id: 3,
      price: 100,
      treasuryBps: 1000, communityBps: 500, jackpotContributionBps: 500,
      jackpotWeight: 40, jackpotTarget: 2000,
      prizes: [
        { ticker: "MSFT", weight: 260, rarity: "common",    purchaseValue: 25 },
        { ticker: "AMZN", weight: 240, rarity: "uncommon",  purchaseValue: 35 },
        { ticker: "GOOG", weight: 220, rarity: "rare",      purchaseValue: 50 },
        { ticker: "META", weight: 180, rarity: "epic",      purchaseValue: 65 },
        { ticker: "BRK",  weight: 100, rarity: "legendary", purchaseValue: 78 },
      ],
    },
  };

  const NAMES = ["0x4a2f…9c31", "0x81ab…44e2", "0xffa0…12bd", "0x22c9…7a0f", "0x9de4…c831", "0x0f5b…88aa"];
  const CONTRACT_ADDRESS = "TBA"; // set once the contract is deployed

  const CHAIN_NAMES = {
    "0x1": "Ethereum",
    "0x89": "Polygon",
    "0xa4b1": "Arbitrum One",
    "0xa": "Optimism",
    "0x2105": "Base",
    "0x38": "BNB Chain",
    "0xaa36a7": "Sepolia",
    "0x14a34": "Base Sepolia",
  };

  const state = {
    lang: "en",
    connected: false,
    address: null,
    chainId: null,
    provider: null,
    balance: 250,
    feed: [],
    requestCounter: 18_420,
    jackpotPool: 460,   // seeded partway toward Standard's $500 target for the demo
    jackpotLocked: 0,
  };

  // EIP-6963 multi-wallet discovery: each installed wallet announces itself
  // with a stable rdns (e.g. "io.metamask"), which is a more reliable way to
  // tell wallets apart than the legacy window.ethereum.isMetaMask flags that
  // some wallets set on themselves for compatibility.
  const discoveredWallets = new Map();
  window.addEventListener("eip6963:announceProvider", (event) => {
    discoveredWallets.set(event.detail.info.rdns, event.detail);
  });
  window.dispatchEvent(new Event("eip6963:requestProvider"));

  function truncateAddress(addr) {
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
  }

  function chainName(hexChainId) {
    return CHAIN_NAMES[hexChainId] || `Chain ${parseInt(hexChainId, 16)}`;
  }

  function formatShares(n) {
    return n >= 1 ? n.toFixed(2) : n.toFixed(4);
  }

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

  /* ---------- Wallet connect (real EIP-1193 injected-wallet connection) ---------- */
  const connectBtn = $("#connectBtn");
  const walletModal = $("#walletModal");
  const walletModalClose = $("#walletModalClose");

  let onAccountsChanged = null;
  let onChainChanged = null;

  function findInjectedProvider(rdns, legacyFlag) {
    const announced = discoveredWallets.get(rdns);
    if (announced) return announced.provider;
    if (typeof window.ethereum === "undefined") return null;
    const candidates = window.ethereum.providers || [window.ethereum];
    return candidates.find(p => p[legacyFlag]) || null;
  }

  function applyConnected(provider, address, chainId) {
    state.provider = provider;
    state.address = address;
    state.chainId = chainId;
    state.connected = true;
    connectBtn.textContent = truncateAddress(address);
    connectBtn.title = chainName(chainId);
    connectBtn.classList.add("connected");

    onAccountsChanged = (accounts) => {
      if (accounts.length === 0) {
        disconnectWallet();
        toast("Wallet disconnected");
        return;
      }
      state.address = accounts[0];
      connectBtn.textContent = truncateAddress(accounts[0]);
    };
    onChainChanged = (newChainId) => {
      state.chainId = newChainId;
      connectBtn.title = chainName(newChainId);
      toast(`Switched to ${chainName(newChainId)}`);
    };
    provider.on?.("accountsChanged", onAccountsChanged);
    provider.on?.("chainChanged", onChainChanged);
  }

  function disconnectWallet() {
    if (state.provider) {
      state.provider.removeListener?.("accountsChanged", onAccountsChanged);
      state.provider.removeListener?.("chainChanged", onChainChanged);
    }
    state.provider = null;
    state.address = null;
    state.chainId = null;
    state.connected = false;
    connectBtn.textContent = "Connect wallet";
    connectBtn.removeAttribute("title");
    connectBtn.classList.remove("connected");
  }

  async function connectInjected(provider, label) {
    const accounts = await provider.request({ method: "eth_requestAccounts" });
    const chainId = await provider.request({ method: "eth_chainId" });
    applyConnected(provider, accounts[0], chainId);
    walletModal.classList.remove("open");
    toast(`Connected to ${label} on ${chainName(chainId)}`);
  }

  connectBtn.addEventListener("click", () => {
    if (state.connected) {
      disconnectWallet();
      toast("Wallet disconnected");
      return;
    }
    walletModal.classList.add("open");
  });
  walletModalClose.addEventListener("click", () => walletModal.classList.remove("open"));
  walletModal.addEventListener("click", (e) => { if (e.target === walletModal) walletModal.classList.remove("open"); });

  $$(".wallet-opt").forEach(btn => {
    btn.addEventListener("click", async () => {
      const wallet = btn.dataset.wallet;
      const provider = findInjectedProvider("io.metamask", "isMetaMask");

      if (!provider) {
        toast(`${wallet} not detected — opening install page`);
        window.open("https://metamask.io/download", "_blank", "noopener");
        return;
      }

      btn.disabled = true;
      try {
        await connectInjected(provider, wallet);
      } catch (err) {
        toast(err?.code === 4001 ? "Connection request rejected" : `Couldn't connect to ${wallet}`);
      } finally {
        btn.disabled = false;
      }
    });
  });

  /* ---------- Weighted draw, including the progressive jackpot ---------- */
  function weightedPickFromRoll(prizes, roll) {
    for (const p of prizes) {
      roll -= p.weight;
      if (roll < 0) return p;
    }
    return prizes[prizes.length - 1];
  }

  function weightedPick(prizes) {
    const totalWeight = prizes.reduce((sum, p) => sum + p.weight, 0);
    return weightedPickFromRoll(prizes, Math.random() * totalWeight);
  }

  // Mirrors _draw(): jackpot only enters the roll when it's eligible (already
  // fully funded by prior contributions), and when it hits, the underlying
  // stock is picked via a second normal draw and tagged Rarity.Jackpot.
  function drawPrize(tier, jackpotEligible) {
    const pack = PACKS[tier];
    const normalWeight = pack.prizes.reduce((sum, p) => sum + p.weight, 0);
    const totalWeight = normalWeight + (jackpotEligible ? pack.jackpotWeight : 0);
    let roll = Math.random() * totalWeight;

    if (jackpotEligible && roll < pack.jackpotWeight) {
      const underlying = weightedPick(pack.prizes);
      return { jackpot: true, prize: underlying };
    }
    if (jackpotEligible) roll -= pack.jackpotWeight;
    return { jackpot: false, prize: weightedPickFromRoll(pack.prizes, roll) };
  }

  function isJackpotEligible(pack) {
    const available = state.jackpotPool - state.jackpotLocked;
    return pack.jackpotWeight > 0 && pack.jackpotTarget > 0 && available >= pack.jackpotTarget;
  }

  /* ---------- Odds tables (one independent weight table per pack) ---------- */
  const oddsBody = $("#oddsTable tbody");
  const oddsJackpotLine = $("#oddsJackpotLine");
  const oddsTabs = $$(".odds-tab");
  let activeOddsTier = "mini";

  function renderOddsTable(tier) {
    const pack = PACKS[tier];
    const normalWeight = pack.prizes.reduce((sum, p) => sum + p.weight, 0);

    oddsBody.innerHTML = pack.prizes
      .slice()
      .sort((a, b) => b.weight - a.weight)
      .map(p => {
        const pct = (p.weight / normalWeight) * 100;
        return `
          <tr>
            <td>
              <div class="ticker-cell">
                <span class="ticker-badge">${p.ticker.slice(0, 2)}</span>
                ${p.ticker} <span style="color:var(--text-muted);font-weight:400">· ${STOCK_NAMES[p.ticker]}</span>
              </div>
            </td>
            <td><span class="rarity-pill rarity-${p.rarity}">${RARITY_LABEL[p.rarity]}</span></td>
            <td class="price-val">$${p.purchaseValue}</td>
            <td class="odds-val">${pct.toFixed(1)}%</td>
          </tr>
        `;
      })
      .join("");

    renderJackpotLine(tier);
  }

  function renderJackpotLine(tier) {
    const pack = PACKS[tier];
    if (pack.jackpotWeight === 0) {
      oddsJackpotLine.innerHTML = `This pack doesn't roll for the jackpot, but ${(pack.jackpotContributionBps / 100).toFixed(0)}% of every payment still feeds the shared pool.`;
      return;
    }
    const available = state.jackpotPool - state.jackpotLocked;
    const normalWeight = pack.prizes.reduce((sum, p) => sum + p.weight, 0);
    const oddsPct = (pack.jackpotWeight / (normalWeight + pack.jackpotWeight)) * 100;

    if (available >= pack.jackpotTarget) {
      oddsJackpotLine.innerHTML = `<strong>🎰 Jackpot is live</strong> — ${oddsPct.toFixed(2)}% chance per open, pays out $${pack.jackpotTarget} of stock. Pool: $${available.toFixed(0)}.`;
    } else {
      const pct = Math.min(100, (available / pack.jackpotTarget) * 100);
      oddsJackpotLine.innerHTML = `<strong>🎰 Jackpot locked</strong> — needs the pool to reach $${pack.jackpotTarget} before it's winnable (currently $${available.toFixed(0)}, ${pct.toFixed(0)}% funded).`;
    }
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

  /* ---------- Live activity feed + jackpot pool panel ---------- */
  const feedList = $("#feedList");
  const jackpotPoolAmountEl = $("#jackpotPoolAmount");
  const jackpotStatusList = $("#jackpotStatusList");

  function randOf(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  function pushFeedEntry(who, entry) {
    state.feed.unshift({ who, entry, ts: Date.now() });
    state.feed = state.feed.slice(0, 12);
    renderFeed();
  }

  function renderFeed() {
    feedList.innerHTML = state.feed.map(f => {
      const secs = Math.max(1, Math.floor((Date.now() - f.ts) / 1000));
      const when = secs < 60 ? `${secs}s ago` : `${Math.floor(secs / 60)}m ago`;
      return `<li>
        <span class="who">${f.who}</span>
        <span class="what">won <strong>${formatShares(f.entry.shares)} ${f.entry.ticker}</strong>
          <span class="rarity-pill rarity-${f.entry.rarity}">${RARITY_LABEL[f.entry.rarity]}</span>
        </span>
        <span class="when">${when}</span>
      </li>`;
    }).join("") || `<li><span class="who">—</span><span class="what">No activity yet</span></li>`;
  }

  function renderJackpotPanel() {
    jackpotPoolAmountEl.textContent = `$${state.jackpotPool.toFixed(0)}`;
    const available = state.jackpotPool - state.jackpotLocked;

    jackpotStatusList.innerHTML = Object.entries(PACKS)
      .filter(([, pack]) => pack.jackpotWeight > 0)
      .map(([tier, pack]) => {
        const pct = Math.min(100, (available / pack.jackpotTarget) * 100);
        const live = available >= pack.jackpotTarget;
        const label = tier.charAt(0).toUpperCase() + tier.slice(1);
        return `
          <li class="jackpot-status-row">
            <div class="jackpot-status-top">
              <span>${label} pack</span>
              <span class="jackpot-status-badge ${live ? "live" : "locked"}">${live ? "LIVE" : "LOCKED"}</span>
            </div>
            <div class="jackpot-bar"><div class="jackpot-bar-fill" style="width:${pct}%"></div></div>
            <div class="jackpot-status-sub">$${pack.jackpotTarget} target${live ? "" : ` · ${pct.toFixed(0)}% funded`}</div>
          </li>
        `;
      })
      .join("");

    renderJackpotLine(activeOddsTier);
  }

  // Runs a full open (contribution + draw + payout) against the shared
  // jackpot state, used by both simulated background activity and the
  // player's own opens. Returns the settled result for display.
  function settlePack(tier, jackpotEligible) {
    const pack = PACKS[tier];
    const draw = drawPrize(tier, jackpotEligible);

    state.jackpotPool += pack.price * pack.jackpotContributionBps / 10_000;

    let stableSpent, rarity, ticker;
    if (draw.jackpot) {
      stableSpent = pack.jackpotTarget;
      state.jackpotPool -= stableSpent;
      if (jackpotEligible) state.jackpotLocked -= pack.jackpotTarget;
      rarity = "jackpot";
      ticker = draw.prize.ticker;
    } else {
      stableSpent = draw.prize.purchaseValue;
      if (jackpotEligible) state.jackpotLocked -= pack.jackpotTarget;
      rarity = draw.prize.rarity;
      ticker = draw.prize.ticker;
    }

    const jitter = 1 + (Math.random() * 0.02 - 0.01); // ±1% live-price wiggle
    const shares = (stableSpent / STOCK_PRICES[ticker]) * jitter;

    return { jackpotWon: draw.jackpot, ticker, rarity, stableSpent, shares };
  }

  function simulateActivity() {
    const who = randOf(NAMES);
    const tier = randOf(Object.keys(PACKS));
    const pack = PACKS[tier];
    const eligible = isJackpotEligible(pack);
    if (eligible) state.jackpotLocked += pack.jackpotTarget;

    const result = settlePack(tier, eligible);
    pushFeedEntry(who, result);
    renderJackpotPanel();
  }
  for (let i = 0; i < 3; i++) simulateActivity();
  setInterval(simulateActivity, 9000);
  setInterval(renderFeed, 15000);
  renderJackpotPanel();

  /* ---------- Pack opening: request -> randomness -> live settlement -> reveal ---------- */
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
    const cost = pack.price;

    if (!state.connected) {
      toast("Connect wallet to open — running in demo mode");
    }
    if (state.balance < cost) {
      toast("Insufficient balance");
      return;
    }

    // Payment escrows as soon as the request is submitted, exactly like
    // openPack() on-chain — jackpot eligibility is also locked in here, at
    // request time, so a later request can't double-spend the same pool.
    state.balance -= cost;
    balanceHint.textContent = state.balance;
    const who = state.connected ? truncateAddress(state.address) : "You";

    const jackpotEligible = isJackpotEligible(pack);
    if (jackpotEligible) state.jackpotLocked += pack.jackpotTarget;

    state.requestCounter += 1;
    const requestId = state.requestCounter;

    prizeModal.classList.add("open");
    modalStatus.textContent = "Submitting request…";
    modalBody.innerHTML = `
      <div class="prize-emoji">${OPENING_PACK_SVG}</div>
      <div class="prize-sub">Escrowing ${cost} USDG · requesting randomness</div>
    `;
    modalActions.innerHTML = "";

    setTimeout(() => {
      modalStatus.textContent = "Awaiting verifiable randomness…";
      modalBody.innerHTML = `
        <div class="prize-emoji">${OPENING_PACK_SVG}</div>
        <div class="prize-sub">Coordinator is fulfilling the request</div>
        <div class="request-id">Request #${requestId}</div>
      `;
    }, 450);

    setTimeout(() => {
      modalStatus.textContent = "Buying stock live…";
      modalBody.innerHTML = `
        <div class="prize-emoji">${OPENING_PACK_SVG}</div>
        <div class="prize-sub">Settling on-chain — purchasing the selected stock</div>
        <div class="request-id">Request #${requestId}</div>
      `;
    }, 1050);

    setTimeout(() => {
      const result = settlePack(tier, jackpotEligible);
      owned.add(result.ticker);
      renderCollection();
      pushFeedEntry(who, result);
      renderJackpotPanel();

      const sharesLabel = formatShares(result.shares);
      modalStatus.textContent = result.jackpotWon ? "🎰 JACKPOT!" : "You got";
      modalBody.innerHTML = `
        <div class="prize-emoji">${result.jackpotWon ? "🎰" : "🏆"}</div>
        <div class="prize-name">${sharesLabel} × ${result.ticker}</div>
        <span class="rarity-pill rarity-${result.rarity}">${RARITY_LABEL[result.rarity]}</span>
        <div class="prize-sub">bought $${result.stableSpent.toFixed(2)} of ${STOCK_NAMES[result.ticker]} · cost ${cost} USDG · request #${requestId}</div>
      `;
      modalActions.innerHTML = `
        <button class="btn btn-ghost" id="prizeKeep">Add to collection</button>
        <button class="btn btn-primary" id="prizeAgain">Open another</button>
      `;
      $("#prizeKeep").addEventListener("click", () => prizeModal.classList.remove("open"));
      $("#prizeAgain").addEventListener("click", () => {
        prizeModal.classList.remove("open");
        setTimeout(() => openPack(card), 200);
      });
    }, 1750);
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
