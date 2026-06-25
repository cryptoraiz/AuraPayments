# 🚀 VPS Deployment Guide (Arc Invoice)

This guide covers the professional process of deploying **Arc Invoice** live using a paid VPS (Virtual Private Server) and your domain `arcinvoice.xyz`.

---

## 🔄 The Correct Workflow (GitHub vs. Deploy)

> **Question:** *"Isn't it better to deploy first and then upload to GitHub?"*

**Answer:** No. The professional workflow is **Local PC** ➔ **GitHub** ➔ **VPS (Server)**.

1.  **Security:** GitHub is your "safe". If your PC breaks, the code is saved.
2.  **Sync:** The VPS "pulls" the code from GitHub. You don't upload files from your PC directly to the server (this is insecure and hard to maintain).
3.  **Continuous Deploy:** In the future, every time you `git push`, the server can update itself.

---

## 1️⃣ Creating the GitHub Repository

Since your user is `cryptoraiz`:

1.  Access [github.com/new](https://github.com/new).
2.  **Repository name:** `arc-invoice` (Important to keep the name we defined in the project).
3.  **Public/Private:** Choose *Public* (easier for deployment) or *Private* (needs SSH key configuration).
4.  **Do not check** "Add a README" or .gitignore (we already created this on your PC).
5.  Click on **Create repository**.
6.  Copy the commands that appear on the screen (section "...or push an existing repository"). They will look something like this:

```bash
git remote add origin https://github.com/cryptoraiz/arc-invoice.git
git push -u origin master
```

---

## 2️⃣ Preparing the VPS (Virtual Machine)

VPS Recommendation: **DigitalOcean (Droplet)**, **Vultr**, **Hetzner**, or **AWS Lightsail**.
*Operating System:* **Ubuntu 22.04 LTS** (Market Standard).

### A. SSH Access
Access your terminal (on Windows use PowerShell or Terminal):
```bash
ssh root@YOUR_VPS_IP
# Enter the password the provider sent you
```

### B. Basic Installation
Run in the VPS terminal:
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install process manager (PM2)
sudo npm install -g pm2

# Install Web Server (Nginx)
sudo apt install -y nginx

# Install Certbot (for HTTPS/Lock)
sudo apt install -y certbot python3-certbot-nginx
```

---

## 3️⃣ Configuring Backend and Frontend

### A. Clone the Project
On the VPS (`/var/www` is the standard for sites):
```bash
cd /var/www
git clone https://github.com/cryptoraiz/arc-invoice.git
cd arc-invoice
```

### B. Setup
```bash
# Install global dependencies
npm install

# Install Frontend and Backend dependencies
cd frontend && npm install
cd ../backend && npm install
```

### C. Build Frontend (React)
React needs to be "compiled" to static HTML/CSS/JS.
```bash
cd /var/www/arc-invoice/frontend
# Create production .env
nano .env
# (Paste your Arc Network keys here and save with Ctrl+X, Y, Enter)

# Compile
npm run build
```
This creates a `dist` folder with your ready-to-use site.

### D. Backend Setup (Node.js)
```bash
cd /var/www/arc-invoice/backend
nano .env.local
# (Paste the MongoDB connection string here)

# Start with PM2 (to keep running forever)
pm2 start server.js --name "arc-backend"
pm2 save
```

---

## 4️⃣ Configuring the Domain (arcinvoice.xyz)

1.  Go to where you bought the domain (Namecheap, GoDaddy, etc.).
2.  Look for **DNS** configuration.
3.  Create two **A** type records:
    *   **Host:** `@` ➔ **Value:** `YOUR_VPS_IP`
    *   **Host:** `www` ➔ **Value:** `YOUR_VPS_IP`

---

## 5️⃣ Going Live (Nginx)

Nginx will receive whoever types `arcinvoice.xyz` and show React. If it's an API call, it sends it to the Backend.

Delete the default config and create the Arc Invoice one:
```bash
sudo rm /etc/nginx/sites-enabled/default
sudo nano /etc/nginx/sites-available/arcinvoice
```

Paste this (adjust the domain):
```nginx
server {
    listen 80;
    server_name arcinvoice.xyz www.arcinvoice.xyz;

    # Frontend (React)
    location / {
        root /var/www/arc-invoice/frontend/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # Backend (API)
    location /api/ {
        proxy_pass http://localhost:3000; # Your backend port
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/arcinvoice /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 6️⃣ HTTPS (Security Lock)

Finish with free SSL certificate:
```bash
sudo certbot --nginx -d arcinvoice.xyz -d www.arcinvoice.xyz
```
Answer the questions and you're done! Your site will be secure at `https://arcinvoice.xyz`.

---

## ✅ Summary

1.  **Code:** Your PC ➔ GitHub.
2.  **Deploy:** GitHub ➔ VPS.
3.  **Build:** React becomes HTML in the `dist` folder.
4.  **Server:** Nginx serves HTML and routes APIs to Node.js.
