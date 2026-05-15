# Airflow Dev Environment Setup Guide
> Running Apache Airflow from source — macOS, Linux, and WSL (without Docker)

---

## Prerequisites

### WSL Users (Windows Only)
Enable WSL2 and install Ubuntu via PowerShell (as Administrator):
```powershell
wsl --install
```
Restart when prompted, then open Ubuntu and create a user. Always work inside the WSL filesystem (e.g. `~/code/airflow`) rather than `/mnt/c/...` for better performance and to avoid file permission issues.

### System Dependencies

**macOS:**
```bash
brew install python node
```

**Ubuntu/Debian (and WSL):**
```bash
sudo apt update && sudo apt install -y \
  python3-pip python3-venv build-essential \
  libssl-dev libffi-dev python3-dev libpq-dev

# Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

> Python 3.12+ and Node.js 20+ are recommended.

---

## 1. Fork & Clone

Fork [apache/airflow](https://github.com/apache/airflow) on GitHub under your own account, then clone **your** fork (replace `YOUR_GITHUB_USERNAME`):

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/airflow.git
cd airflow
```

Add the upstream Apache repo so you can keep your fork in sync:
```bash
git remote add upstream https://github.com/apache/airflow.git
```

---

## 2. Python Virtual Environment

```bash
python3 -m venv .venv
source .venv/bin/activate
```

---

## 3. Set AIRFLOW_HOME

`AIRFLOW_HOME` is where Airflow stores its runtime files: config, logs, SQLite DB, and DAGs. Keep it separate from your source code.

Add to your `~/.bashrc` or `~/.zshrc`:
```bash
export AIRFLOW_HOME=~/airflow
```

Then reload: `source ~/.bashrc`

---

## 4. Install Airflow from Source

Airflow 3.x is split into sub-packages (`airflow-core`, `task-sdk`, etc.) that live inside the repo and may not yet be published to PyPI when working off `main`. Install them all together in one command so pip can resolve dependencies correctly:

```bash
pip install -e ./task-sdk -e ./airflow-core -e ".[devel]"
```

The `-e` (editable) flag means Python changes take effect immediately without reinstalling.

> If you hit a `Could not find a version` error for a sub-package, find its folder in the repo root and add it to the install command (e.g. `-e ./providers/common/compat`).

---

## 5. Build the Frontend

Airflow 3.x has two UIs that must be built from source. Run these once (or after making frontend changes):

**Main UI:**
```bash
cd airflow-core/src/airflow/ui
npm install --legacy-peer-deps
npm run build
```

**Auth Manager Login UI:**
```bash
cd airflow-core/src/airflow/api_fastapi/auth/managers/simple/ui
npm install --legacy-peer-deps
npm run build
```

---

## 6. Initialize the Database

```bash
airflow db migrate
```

---

## 7. Run Airflow

```bash
airflow standalone
```

This starts the webserver, scheduler, and triggerer together. Open **http://localhost:8080** in your browser.

On first run, an admin user is auto-generated. The credentials are printed in the terminal output and saved to:
```bash
cat $AIRFLOW_HOME/simple_auth_manager_passwords.json.generated
```
---

## Troubleshooting

| Error | Fix |
|---|---|
| `TemplateNotFound: /index.html` | UI hasn't been built — run the npm steps in Section 5 |
| `Could not find a version that satisfies apache-airflow-X` | Install the sub-package locally: add `-e ./package-folder` to your pip install command |
| `npm install` peer dependency conflict | Use `npm install --legacy-peer-deps` |
| Vite build error: missing `@emotion/react` | Run `npm install @emotion/react @emotion/styled --legacy-peer-deps` then retry |
| `airflow users create` command not found | Removed in Airflow 3.x — `airflow standalone` creates an admin user automatically |