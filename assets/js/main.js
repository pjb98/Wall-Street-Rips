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

  // Get a free project ID at https://cloud.walletconnect.com and paste it here
  // to enable the WalletConnect option (it's the only wallet option that needs
  // an external credential — MetaMask/Coinbase connect via the browser's
  // injected provider and need nothing extra).
  const WALLETCONNECT_PROJECT_ID = "";

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
    qty: { mini: 1, standard: 1, deluxe: 1 },
    opensByPack: { mini: 0, standard: 0, deluxe: 0 },
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

      if (wallet === "WalletConnect") {
        if (!WALLETCONNECT_PROJECT_ID) {
          toast("WalletConnect needs a free Project ID — see main.js");
          return;
        }
        btn.disabled = true;
        try {
          const { EthereumProvider } = await import(
            "https://esm.sh/@walletconnect/ethereum-provider@2"
          );
          const wcProvider = await EthereumProvider.init({
            projectId: WALLETCONNECT_PROJECT_ID,
            showQrModal: true,
            chains: [1],
            optionalChains: [8453, 42161, 10, 137],
          });
          await wcProvider.connect();
          const chainId = "0x" + wcProvider.chainId.toString(16);
          applyConnected(wcProvider, wcProvider.accounts[0], chainId);
          walletModal.classList.remove("open");
          toast(`Connected via WalletConnect on ${chainName(chainId)}`);
        } catch (err) {
          toast(err?.message === "User rejected the request." ? "Connection rejected" : "WalletConnect connection failed");
        } finally {
          btn.disabled = false;
        }
        return;
      }

      const rdns = wallet === "MetaMask" ? "io.metamask" : "com.coinbase.wallet";
      const legacyFlag = wallet === "MetaMask" ? "isMetaMask" : "isCoinbaseWallet";
      const provider = findInjectedProvider(rdns, legacyFlag);

      if (!provider) {
        const installUrl = wallet === "MetaMask" ? "https://metamask.io/download" : "https://www.coinbase.com/wallet/downloads";
        toast(`${wallet} not detected — opening install page`);
        window.open(installUrl, "_blank", "noopener");
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
    const who = state.connected ? truncateAddress(state.address) : "You";
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
