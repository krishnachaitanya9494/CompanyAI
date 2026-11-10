# Local Windows startup

Start the backend from the project root in PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Start the React frontend from a second PowerShell window:

```powershell
Set-Location .\frontend
npm.cmd run dev -- --host 127.0.0.1
```

The frontend calls the local API at `http://127.0.0.1:8000/api` by default. Set `VITE_API_ROOT` only when the backend runs at a different URL. Schema initialization is additive and does not clear existing SQLite data. Resume uploads remain local until the recruiter separately confirms external embedding processing.
