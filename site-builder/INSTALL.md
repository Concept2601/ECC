# Installing Think Different Visuals Studio

The studio has two parts:

- **The app:** what you see and design in. It runs in any modern browser (Chrome, Edge, Safari).
- **The studio server:** publishes your sites, hosts them on your domain and collects form messages. It needs a computer that can run Node.js: Windows, Mac, Linux or an online server.

An iPhone can't run the server, so it uses the studio from a computer or online server that does.

## Windows

1. **Install Node.js:** download the **LTS** version from <https://nodejs.org> and run the installer with the default options.
2. **Get the studio:** on GitHub, open the repository, switch to the branch `claude/website-builder-hosting-seo-q9knwm`, then **Code → Download ZIP**. Unzip it somewhere permanent, for example `Documents\TDV Studio`.
3. **Start it:** open the `site-builder` folder and double-click **`Start TDV Studio.bat`**.
   - The first run installs components and builds the app. This takes a few minutes and needs internet.
   - Chrome opens on <http://localhost:8787> when it's ready.
   - The black window shows your **publish token**. Paste it once into **Back-End → Hosting → Publish token**. It's also saved in `token.txt`.
4. **Keep the black window open** while you work. Closing it stops the studio and any sites it is hosting.

If Windows Firewall asks about Node.js, tick **Private networks**. That lets your iPhone reach the studio over your Wi-Fi.

Tip: right-click the `.bat` file and choose **Send to → Desktop (create shortcut)**.

## iPhone

### Option A: on the same Wi-Fi as your Windows PC

1. Start the studio on the PC as above.
2. Look in the black window for the line **"On your phone or other devices (same Wi-Fi): http://192.168.x.x:8787"**.
3. Open that address in **Safari** on the iPhone.
4. Tap **Share → Add to Home Screen**. The TDV icon then opens the studio full-screen, like an app.

It works while the PC is on and the studio window is open.

### Option B: from anywhere

Put the studio server online so it works on mobile data too:

1. Rent a small Linux server (a VPS) and follow **Production setup** in Back-End → Hosting, or the `README.md`.
2. Point an address such as `studio.yourdomain.com` at it. Caddy gives it HTTPS automatically.
3. In Safari, open `https://studio.yourdomain.com`, then **Share → Add to Home Screen**.

This is also the best setup for hosting client sites, because they stay online when your PC is off.

## Good to know

- **Projects live in each browser.** A site made on the PC doesn't appear on the iPhone automatically. To move one, use **Export & backup → Download backup** on one device, then **Import backup** on the other.
- **Upload large videos from the PC.** Phones can struggle with big files in the browser.
- **To update the studio,** download the new ZIP, copy your `token.txt` and `data` folder into it, then delete the `dist` folder so the next start rebuilds the app.
