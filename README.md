# Huzz Hunter

The Huzz Hunter web app (Node, no dependencies: `node server.js`).

Deployment is automatic. This repository is watched by the server at `100.123.64.57`,
which checks `main` every 5 minutes, and publishes whatever it finds.

## How a change goes live

1. Push (or merge) to **`main`**. No review or approval step — the push is the deploy.
2. Within ~5 minutes the server fetches the commit, checks it, and swaps it in.
3. If the new code is broken, it is **not** deployed: the server stays on the previous
   version and logs why. If it deploys but the app then fails to start, the server
   automatically restores the previous version.

So a push that does not work can never take the site down for long.

## Rules that keep it safe

- **Files that go live:** `server.js`, `index.html`, `extras.js`, `extras.css`,
  `package.json`, `assets/`, `ma-bridge.js`. Anything else in here is ignored by the server.
- **Never commit runtime data.** `data.json`, `snapshots/`, `uploads/` are live user data
  and are in `.gitignore`. Committing them would overwrite real user content.
- **Keep it syntax-valid.** Before deploying, the server runs `node --check` on every `.js`
  file and a brace check on every `.css` file, then boots the app on a spare port against a
  throwaway copy of the data. Only a clean boot is published.
- No build step, no dependencies: keep `package.json` free of `dependencies` unless you
  really need to, because nothing gets `npm install`ed on the server.

## Working locally

```bash
git clone <this repo>
cd <repo>
cp /path/to/a/data.json .   # optional, for realistic content
PORT=3200 node server.js    # http://127.0.0.1:3200/huzz-hunter/
```

## If you break `main`

The server refuses to deploy code that fails its checks, so `main` can be broken and the
site will keep running. Fix it with a new commit — the next check picks it up. To see what
happened, ask the owner to run `bash ~/huzz-updater/status.sh` on the server.
