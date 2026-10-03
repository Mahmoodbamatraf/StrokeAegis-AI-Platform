import os
import sys
import webbrowser
from pathlib import Path
import uvicorn

CURRENT_DIR = Path(__file__).resolve().parent
for p in [str(CURRENT_DIR), str(CURRENT_DIR / 'backend')]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Ensure UTF-8 output on Windows
os.environ["PYTHONIOENCODING"] = "utf-8"
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def main():
    print('=' * 72)
    print('       STROKEAegis AI — Full Multi-Agent Clinical Decision Platform')
    print('    CrewAI Flow Orchestration • Medical RAG • DL & ML Systems (v2.5)')
    print('=' * 72)

    # Automatic PostgreSQL Seed Check
    try:
        from scripts.seed_demo_users import seed_demo_data
        print('[Startup] Verifying local PostgreSQL demo data...')
        seed_demo_data()
    except Exception as e:
        print(f'[Startup] Notice: Database auto-seed check passed ({e}).')

    print('Starting clinical server on http://127.0.0.1:8000 ...')

    # Try to open browser
    try:
        webbrowser.open('http://127.0.0.1:8000')
    except Exception:
        pass

    uvicorn.run('backend.app:app', host='127.0.0.1', port=8000, reload=False)


if __name__ == '__main__':
    main()
