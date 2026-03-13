# How to push this project to GitHub (step by step)

## Where to run the commands

You run them in **PowerShell** or **Command Prompt** on your **Windows PC** (not on the server).

### How to open PowerShell

1. Press the **Windows key** on your keyboard.
2. Type: **PowerShell**
3. Click **Windows PowerShell** (or "Terminal") when it appears.
4. A blue or black window opens. You will see a line like:
   ```
   PS C:\Users\Sanda>
   ```
   That is where you paste and run the commands.

---

## How to paste and run a command

1. **Copy** the command (select it, then Ctrl+C).
2. **Click inside** the PowerShell window (so it’s focused).
3. **Right‑click** in the window — that pastes the text.
   - Or press **Ctrl+V** to paste.
4. Press **Enter** to run the command.
5. Wait until it finishes (no new `PS C:\...>` line means it’s still running).

---

## Commands to run (one by one)

Run these **in order**, in the same PowerShell window.

### Step 1 – Go to your project folder

Paste this and press Enter:

```powershell
cd "C:\Users\Sanda\Desktop\Elix Star Live"
```

You should see the prompt change to something like:
`PS C:\Users\Sanda\Desktop\Elix Star Live>`

---

### Step 2 – Turn this folder into a Git repo (if not already)

Paste and press Enter:

```powershell
git init
```

Then:

```powershell
git branch -M main
```

---

### Step 3 – Connect to your GitHub repo

Paste and press Enter:

```powershell
git remote add origin https://github.com/bericaandrei1-arch/Elix-Star-Live.git
```

If it says "remote origin already exists", run this instead:

```powershell
git remote set-url origin https://github.com/bericaandrei1-arch/Elix-Star-Live.git
```

---

### Step 4 – Add all files and commit

Paste and press Enter:

```powershell
git add .
```

Then:

```powershell
git commit -m "Initial Elix Star Live project"
```

---

### Step 5 – Push to GitHub

Paste and press Enter:

```powershell
git push -u origin main
```

- A browser or login window may open so you can sign in to GitHub.
- If it asks for username: your GitHub username (e.g. bericaandrei1-arch).
- If it asks for password: use a **Personal Access Token** from GitHub (Settings → Developer settings → Personal access tokens), not your normal password.

When you see something like "Branch 'main' set up to track remote branch 'main'", the push is done.

---

## Summary

- **Where:** PowerShell on your PC (Windows key → type "PowerShell" → open it).
- **How:** Copy each command → click in the PowerShell window → right‑click to paste (or Ctrl+V) → press Enter.
- **Order:** Run the steps in this file one after another in the same window.
