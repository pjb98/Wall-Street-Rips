# Wall Street Rips — tokenized-equity "mystery pack" landing page

A tokenized-equity "mystery pack" site: hero, pack-opening mechanic, odds
table, collection tracker, a live activity feed, a progressive jackpot pool,
and a token section. Plain HTML/CSS/JS, no build step or dependencies.

Modeled on `WallStreetRipsLiveV2.sol`: prizes are a USDG budget spent on a
live stock purchase at settlement (not a fixed share count), packs are
opened one at a time, and there's no pity floor or Rip Points ledger — none
of those exist in this contract version.

## Run it

Open `index.html` directly, or serve the folder:

```
python3 -m http.server 8080
```

## Wallet connect

Connecting MetaMask is real — it uses the browser's injected EIP-1193
provider (`eth_requestAccounts` / `eth_chainId`), discovered via EIP-6963
with a legacy `window.ethereum` fallback, and reacts to
`accountsChanged`/`chainChanged`. No dependencies or API key needed.

Note that connecting a wallet doesn't yet call the actual
`WallStreetRipsLiveV2.sol` contract — `CONTRACT_ADDRESS` is still `"TBA"`, so
pack-opening stays simulated locally until the contract is deployed and
wired up (see below).

## Rebrand it

- Swap the name: search/replace `RIPS` in `index.html` and `assets/js/main.js`.
- Swap the logo: replace `assets/img/logo.svg`.
- Swap colors: edit the CSS custom properties at the top of `assets/css/style.css`.
- Real data: `assets/js/main.js` has mock `PACKS` prize tables, balance, and
  activity feed — wire these to your deployed contract/API once it's live.
- Set the real contract address in `CONTRACT_ADDRESS` in `assets/js/main.js`
  once deployed — it feeds both the Token section and the odds blurb.
