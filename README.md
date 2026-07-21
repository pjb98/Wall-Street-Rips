# RIPS — tokenized-equity "mystery box" landing page

A static recreation of the stox-onchain.fun layout: hero, box-opening
mechanic, odds table, collection tracker, live activity feed + leaderboard,
and a token section. Plain HTML/CSS/JS, no build step or dependencies.

## Run it

Open `index.html` directly, or serve the folder:

```
python3 -m http.server 8080
```

## Rebrand it

- Swap the name: search/replace `RIPS` in `index.html` and `assets/js/main.js`.
- Swap the logo: replace `assets/img/logo.svg`.
- Swap colors: edit the CSS custom properties at the top of `assets/css/style.css`.
- Real data: `assets/js/main.js` has mock `STOCKS`, balance, and activity feed —
  wire these to your contract/API and replace the mock wallet-connect modal
  with a real wallet library (e.g. wagmi/RainbowKit or viem) when you're
  ready to go on-chain.
- Set the real contract address in the `#contractAddr` element once deployed.
