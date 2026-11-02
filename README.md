# Discord Quest Completer

A simple Discord quest completer. Paste one script into the Discord desktop app console and let it handle your Discord quests for you.

![Platform](https://img.shields.io/badge/platform-Discord%20Desktop-5865F2)
![Language](https://img.shields.io/badge/language-JavaScript-F7DF1E)
![Status](https://img.shields.io/badge/status-active-brightgreen)

## Features

- Automates Discord quests from inside the Discord desktop app
- No installation of extra programs besides Vencord
- One file (`Tomst.js`), just copy and paste
- Free and open source

## Requirements

- **Discord desktop app** (the web version will not work)
- **[Vencord](https://vencord.dev)** installed on your Discord desktop app (it enables the developer console)

## Installation and usage

1. **Download the Discord desktop app** from the [official Discord website](https://discord.com/download). Do not use the web version.
2. **Install Vencord** from the official site: [vencord.dev](https://vencord.dev).
3. **Restart Discord** and open it.
4. **Accept the quest** you want to complete in the Discord **Quests** tab.
5. Press **Ctrl + Shift + I** (Windows/Linux) or **Cmd + Option + I** (macOS) to open Developer Tools.
6. Open the **Console** tab.
7. Open [`Tomst.js`](./Tomst.js) in this repository, click **Copy raw file**, and **paste** the whole script into the console.
8. Press **Enter**. The script will start running.

## Troubleshooting

| Problem | Fix |
| --- | --- |
| Console says pasting is blocked | Type `allow pasting` in the console, press Enter, then paste the script again |
| Ctrl + Shift + I does nothing | Make sure Vencord is installed, then fully restart Discord |
| Script does nothing | Make sure you are using the desktop app and have accepted the quest first |
| Errors after pasting | Copy the **entire** file, from the first line to the last |

## FAQ

**Does it work on the Discord website?**
No. Use the Discord desktop app.

**Do I need to reinstall anything each time?**
No. Open the console and paste the script again whenever you need it.

**Is it safe?**
The whole script is in `Tomst.js`, so you can read it before running it. Only paste code into the console that you trust.

## Disclaimer

This project is for educational purposes only. Using client mods and automation scripts may go against Discord's Terms of Service and could put your account at risk. Use it at your own risk. The author is not responsible for any bans or other consequences.

## Support

If this helped you, leave a star on the repo. Found a bug? Open an [issue](../../issues).

Thanks for using Discord Quest Completer!
