# IDVize - IAM Program Dashboard

A cybersecurity-themed Identity & Access Management (IAM) program dashboard built with React, TypeScript, Tailwind CSS, and Recharts.

## Features

- **Program Insights** - Gauge charts for IGA, Access Management, and PAM maturity
- **IGA Warehouse** - Identity governance KPIs, orphan accounts, SOD coverage, app portfolio
- **Access Management** - MFA coverage, login performance, registration trends
- **PAM Dashboard** - Session activity, credential vault, privileged account management
- **CIAM Dashboard** - Customer identity registration, auth methods, geographic distribution
- **App Onboarding** - Application priority scale, quarterly status tracking
- **App Management** - Key risk & performance indicators, orphan/terminated accounts
- **Orphan Accounts** - Searchable detail table with bar chart visualization
- **CMDB Integration** - CSV upload, API fetch, customizable header mapping, 100 sample apps
- **Per-App Dashboard** - Click any CMDB app to see color-coded IAM control status with remediation recommendations

## Tech Stack

- React 18 + TypeScript
- Tailwind CSS
- Recharts
- Lucide Icons
- Vite

## Running on Windows Server 2022 — Step-by-Step Guide

### Prerequisites

#### 1. Install Node.js

1. Open a browser on the server and go to **https://nodejs.org/**
2. Download the **Windows Installer (.msi)** for the LTS version (v20 or v22 recommended)
3. Run the installer:
   - Accept the license agreement
   - Use the default installation path (`C:\Program Files\nodejs\`)
   - Check **"Automatically install the necessary tools"** if prompted
   - Click **Install**, then **Finish**
4. Open **PowerShell** (Run as Administrator) and verify the installation:
   ```powershell
   node --version
   npm --version
   ```
   You should see version numbers for both (e.g., `v22.x.x` and `10.x.x`).

#### 2. Install Git (if not already installed)

1. Download Git from **https://git-scm.com/download/win**
2. Run the installer with default settings
3. Verify in PowerShell:
   ```powershell
   git --version
   ```

### Clone and Run the Application

#### 3. Clone the Repository

Open **PowerShell** and run:

```powershell
cd C:\
git clone https://github.com/omobolu/DEV.git
cd DEV
```

#### 4. Install Dependencies

```powershell
npm install
```

This will download all required packages. Wait for it to complete (may take 1-2 minutes).

#### 5. Run in Development Mode

```powershell
npm run dev
```

The terminal will display:

```
  VITE vX.X.X  ready in XXX ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://X.X.X.X:5173/
```

Open a browser on the server and navigate to **http://localhost:5173/** to access IDVize.

#### 6. Build for Production (Optional)

To create an optimized production build:

```powershell
npm run build
```

The output will be in the `dist\` folder. You can serve it with any static file server.

#### 7. Serve the Production Build (Optional)

Install a simple static server and serve the build:

```powershell
npm install -g serve
serve dist
```

The app will be available at **http://localhost:3000/** by default.

### Firewall Configuration (Optional — for Remote Access)

If you want other machines on your network to access IDVize:

1. Open **Windows Defender Firewall with Advanced Security**
2. Click **Inbound Rules** → **New Rule...**
3. Select **Port** → **Next**
4. Select **TCP**, enter port **5173** (dev) or **3000** (production) → **Next**
5. Select **Allow the connection** → **Next**
6. Check all profiles (Domain, Private, Public) → **Next**
7. Name the rule (e.g., `IDVize Dashboard`) → **Finish**

Other machines can then access the app at `http://<server-ip>:5173/` or `http://<server-ip>:3000/`.

### Hosting with IIS (Alternative Production Setup)

If you prefer to use IIS instead of the `serve` command:

1. Open **Server Manager** → **Add Roles and Features** → install **Web Server (IIS)** if not already installed
2. Build the app: `npm run build`
3. Copy the contents of `dist\` to `C:\inetpub\wwwroot\idvize\`
4. Open **IIS Manager** → **Sites** → **Add Website**:
   - Site name: `IDVize`
   - Physical path: `C:\inetpub\wwwroot\idvize`
   - Port: `80` (or any port you prefer)
5. Add a `web.config` file in the `idvize` folder for SPA routing:
   ```xml
   <?xml version="1.0" encoding="UTF-8"?>
   <configuration>
     <system.webServer>
       <rewrite>
         <rules>
           <rule name="SPA" stopProcessing="true">
             <match url=".*" />
             <conditions logicalGrouping="MatchAll">
               <add input="{REQUEST_FILENAME}" matchType="IsFile" negate="true" />
               <add input="{REQUEST_FILENAME}" matchType="IsDirectory" negate="true" />
             </conditions>
             <action type="Rewrite" url="/index.html" />
           </rule>
         </rules>
       </rewrite>
     </system.webServer>
   </configuration>
   ```
6. Browse to **http://localhost/** to access IDVize

### Updating the Application

To pull the latest changes:

```powershell
cd C:\DEV
git pull origin main
npm install
npm run build
```

### Troubleshooting

| Issue | Solution |
|-------|----------|
| `node` is not recognized | Restart PowerShell after installing Node.js, or add `C:\Program Files\nodejs\` to your system PATH |
| `npm install` fails with permissions | Run PowerShell as Administrator |
| Port already in use | Change the port: `npm run dev -- --port 8080` |
| Cannot access from remote machine | Check Windows Firewall rules (see Firewall section above) |
| IIS URL Rewrite not working | Install the IIS URL Rewrite Module from https://www.iis.net/downloads/microsoft/url-rewrite |
