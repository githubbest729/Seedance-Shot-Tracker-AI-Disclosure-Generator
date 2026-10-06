# Seedance Shot Tracker & AI Disclosure Generator

An offline production tracker for the AI Film Award. Plan your film scene by scene, log the exact Seedance prompts behind every shot, link each prompt to the video file you downloaded, and export a clean AI disclosure document for your submission.

Everything runs in your browser. There is no account, no server, and no tracking. Your data stays on your device.

## Features

- **Scenes and shots:** organize a 5 to 7 minute film into ordered scenes, each with shots marked planned, prompted, generated, or edited.
- **Prompt logger:** save the visual, motion, and audio prompts you entered into Seedance for each shot.
- **Asset linker:** record the filename of each downloaded clip (for example `scene_03_take_02.mp4`) so you can find it quickly when editing in CapCut. The header shows how many shots are still unlinked.
- **AI disclosure exporter:** download a `.txt` file, or print or save as PDF, containing your film details, tools used, human contribution, and the full prompt log.
- **Backup and restore:** save your project as a JSON file and load it back on any device.
- **Works offline** once installed.

## Install the app

Open the live app: **https://YOUR-USERNAME.github.io/YOUR-REPO/**

**Desktop (Chrome or Edge):** click the install icon in the address bar, or open the browser menu and choose *Install Shot Tracker*.

**Android (Chrome):** open the menu and tap *Install app* (or *Add to Home screen*).

**iPhone and iPad (Safari):** tap the Share button, then *Add to Home Screen*, then *Add*. iOS only offers this in Safari.

## Your data

Projects are saved in your browser's local storage on one device. Clearing site data or browsing history can erase them, and they do not sync between devices. Use **Backup** regularly and keep the JSON file somewhere safe. Use **Restore** to move a project to another device.

## Deploy your own copy

1. Create a public GitHub repository and upload every file in this project to the root.
2. Go to **Settings > Pages**, choose the `main` branch and the `/ (root)` folder, and save.
3. Open the URL GitHub gives you and install the app.

## Updating

After changing any file, edit the `CACHE` name in `sw.js` (for example `shot-tracker-v3`). Installed copies then download the new version the next time they are opened online, and may need to be closed and reopened once.

## Files

| File | Purpose |
| --- | --- |
| `index.html`, `style.css`, `app.js` | The app |
| `manifest.json` | Install name, colors, and icons |
| `sw.js` | Service worker for offline use |
| `icon.svg`, `favicon.ico`, `apple-touch-icon.png`, `icon-*.png` | App icons |

## Disclaimer

This is an unofficial helper tool. Check the contest rules for the exact disclosure format and requirements before you submit.
