# 🧠 NeuroTrace — Parkinson's Disease Screening App

> A desktop application for early Parkinson's Disease screening using tremor analysis and machine learning, built for students and researchers.

![Platform](https://img.shields.io/badge/platform-Windows-blue)
![Python](https://img.shields.io/badge/python-3.10%2B-blue)
![Node](https://img.shields.io/badge/node-20%2B-green)
![License](https://img.shields.io/badge/license-MIT-lightgrey)

---

## 📖 Overview

NeuroTrace (Tremora) is a desktop application designed to assist students and researchers in screening for Parkinson's Disease through tremor detection and analysis. It combines a machine learning model with an intuitive Electron-based interface, allowing users to conduct screenings, view results, and analyse patient data — all from a local desktop environment.

---

## ✨ Features

- 🎯 **Parkinson's Screening** — Guided screening workflow with real-time tremor analysis
- 📊 **Results Visualisation** — Interactive metrics and visualisations of screening outcomes
- 🧠 **ML-Powered Analysis** — Machine learning model trained for Parkinson's tremor detection
- 🗂️ **Patient History** — View and manage past screening sessions
- 🔐 **Authentication** — User registration, login, and password reset
- 📦 **Offline-First** — Fully local SQLite database, no cloud dependency

---

## 🏗️ Tech Stack

| Layer | Technology |
|---|---|
| Desktop Shell | Electron.js |
| Frontend | React + Vite |
| Backend | Python FastAPI |
| Database | SQLite |
| ML Model | Python (scikit-learn / PyTorch) |
| CI/CD | GitHub Actions |

---

## 📁 Project Structure

```
fyp_neurotrace/
├── .github/
│   └── workflows/
│       ├── build.yml          # Windows release build (auto versioning)
│       └── deploy.yml         # Server deployment via SSH
├── neurotrace_app/
│   ├── app/                   # Electron + React frontend
│   │   ├── src/
│   │   │   ├── components/    # Reusable UI components
│   │   │   ├── pages/         # App pages (Login, Screening, Results, etc.)
│   │   │   └── App.jsx
│   │   ├── main.js            # Electron main process
│   │   └── package.json
│   └── backend/               # FastAPI backend
│       ├── venv/              # Python virtual environment
│       ├── requirements.txt
│       └── ...
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20+
- [Python](https://www.python.org/) 3.10+
- [Git](https://git-scm.com/)

---

### 1. Clone the Repository

```bash
git clone https://github.com/SandilJayasinghe/fyp_neurotrace.git
cd fyp_neurotrace
```

---

### 2. Set Up the Backend

```bash
cd neurotrace_app/backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate        # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the FastAPI server
uvicorn main:app --reload
```

The backend will be running at `http://localhost:8000`

---

### 3. Set Up the Frontend

```bash
cd neurotrace_app/app

# Install dependencies
npm install

# Run in development mode
npm run dev
```

---

### 4. Run the Electron App

```bash
cd neurotrace_app/app

# Start Electron in development mode
npm run electron:dev
```

---

## 📦 Download the App (Windows)

You can download the latest Windows installer directly:

**[⬇️ Download Latest Release](https://github.com/SandilJayasinghe/fyp_neurotrace/releases/latest)**

Or use the direct download link:
```
https://github.com/SandilJayasinghe/fyp_neurotrace/releases/latest/download/tremora-VERSION.exe
```

---

## ⚙️ CI/CD Pipeline

This project uses GitHub Actions for automated building and deployment.

### Build Workflow (`build.yml`)
- Triggers on every push to `main`
- Auto-increments the patch version in `package.json`
- Builds the Electron app for Windows
- Creates a GitHub Release with the `.exe` attached
- Skips release if the version tag already exists

### Deploy Workflow (`deploy.yml`)
- Triggers on every push to `main`
- SSHs into the production server
- Pulls latest code and restarts the backend service

---

## 🔐 Environment & Secrets

The following secrets must be configured in **GitHub → Settings → Secrets → Actions**:

| Secret | Description |
|---|---|
| `DROPLET_HOST` | Production server IP address |
| `DROPLET_USER` | SSH username on the server |
| `DEPLOY_KEY` | SSH private key for server authentication |

---

## 🧪 Research Context

This application was developed as a **Final Year Project (FYP)** to explore the feasibility of using tremor-based signals for early Parkinson's Disease screening. It is intended for **academic and research use only** and is not a certified medical diagnostic tool.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 👤 Author

**Sandil Jayasinghe**
- GitHub: [@SandilJayasinghe](https://github.com/SandilJayasinghe)

---

> ⚠️ **Disclaimer:** NeuroTrace is a research tool and is not intended to replace professional medical diagnosis. Always consult a qualified healthcare professional for medical advice.
