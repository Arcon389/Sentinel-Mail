import os
import sys
from pathlib import Path

from cryptography.fernet import Fernet

# Allow `import worker.*` when running tests against the backend's installed
# app package without a separate editable install of the worker package.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "worker"))

os.environ.setdefault("ENCRYPTION_KEY", Fernet.generate_key().decode())
os.environ.setdefault("JWT_SECRET", "test-secret")
