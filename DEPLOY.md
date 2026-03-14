# Deploy Elix Star Live to Hetzner

Your **API is already running** at `http://89.167.107.174:8080`. This guide deploys the **frontend** on the same server so users can open the app in the browser.

---

## 1. Build the frontend on your PC

In the project folder, ensure `.env` has the **public** URL (IP or domain) the app will be opened from:

```env
VITE_API_URL=http://89.167.107.174:8080
VITE_WS_URL=ws://89.167.107.174:8080
```

If you will use a domain (e.g. www.elixstarlive.co.uk), set those instead:

```env
VITE_API_URL=https://www.elixstarlive.co.uk
VITE_WS_URL=wss://www.elixstarlive.co.uk
```

Then build:

```powershell
cd "C:\Users\Sanda\Desktop\Elix Star Live"
npm run build
```

This creates the `dist` folder with the production app.

---

## 2. Upload `dist` and `.env` to the server

- **WinSCP:** Connect to `sanda@89.167.107.174`, then upload:
  - The whole **dist** folder → `/home/sanda/elix-star-live/dist`
  - Your **.env** file → `/home/sanda/elix-star-live/.env` (overwrite)

- **Or with scp (PowerShell):**
  ```powershell
  scp -i C:\Users\Sanda\.ssh\Elix-star-Live -r "C:\Users\Sanda\Desktop\Elix Star Live\dist" sanda@89.167.107.174:/home/sanda/elix-star-live/
  ```

---

## 3. On the server: Nginx (serve frontend + proxy API)

SSH in:

```bash
ssh -i C:\Users\Sanda\.ssh\Elix-star-Live sanda@89.167.107.174
```

Install Nginx if needed:

```bash
sudo apt-get update
sudo apt-get install -y nginx
```

Create a site config (replace `89.167.107.174` with your domain if you have one):

```bash
sudo nano /etc/nginx/sites-available/elix-star-live
```

Paste this (use your IP or domain in `server_name`):

```nginx
server {
    listen 80;
    server_name 89.167.107.174;
    root /home/sanda/elix-star-live/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /live {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
    }

    location /health {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
    }

    location /docs {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
    }
}
```

Enable and test:

```bash
sudo ln -sf /etc/nginx/sites-available/elix-star-live /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 4. CORS: update `.env` on the server

On the server, edit `/home/sanda/elix-star-live/.env` and set (use your real URL or IP):

```env
API_URL=http://89.167.107.174
ALLOWED_ORIGINS=http://89.167.107.174,http://localhost:5173,capacitor://localhost
```

If you use a domain:

```env
API_URL=https://www.elixstarlive.co.uk
ALLOWED_ORIGINS=https://www.elixstarlive.co.uk,http://89.167.107.174,capacitor://localhost
```

Restart the backend (in the SSH session where it runs, Ctrl+C then):

```bash
cd /home/sanda/elix-star-live/server
npm start
```

Or with pm2:

```bash
pm2 restart elix-server
```

---

## 5. Keep the backend running (pm2, optional)

```bash
cd /home/sanda/elix-star-live/server
npm install -g pm2
pm2 start "npm start" --name elix-server
pm2 save
pm2 startup
```

---

## 6. Open the app

- **By IP:** http://89.167.107.174  
- **By domain:** https://your-domain.com (after you add HTTPS with Certbot; see below)

---

## Optional: HTTPS with a domain

1. Point your domain’s A record to `89.167.107.174`.
2. In the Nginx config, set `server_name www.elixstarlive.co.uk;` (or your domain).
3. Install Certbot and get a certificate:

   ```bash
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d www.elixstarlive.co.uk
   ```

4. In `.env` use `https://` and `wss://` for `VITE_API_URL` and `VITE_WS_URL`, rebuild the frontend, and upload `dist` again.

---

## Quick checklist

- [ ] Built frontend with correct `VITE_API_URL` / `VITE_WS_URL`
- [ ] Uploaded `dist` to `/home/sanda/elix-star-live/dist`
- [ ] Nginx installed and config in place, `nginx -t` OK, reloaded
- [ ] `.env` on server has `ALLOWED_ORIGINS` including the app URL
- [ ] Backend running (npm start or pm2)
- [ ] App opens at http://89.167.107.174 (or your domain)
