"""Fernet symmetric encryption for platform passwords.

Encrypt before storing in Supabase, decrypt when agent needs them.
Requires CREDENTIAL_KEY env var (generate with: python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())")
"""

import os
from cryptography.fernet import Fernet

_key: bytes | None = None


def _get_fernet() -> Fernet:
    global _key
    if _key is None:
        raw = os.environ.get("CREDENTIAL_KEY")
        if not raw:
            raise RuntimeError(
                "CREDENTIAL_KEY env var is required. "
                "Generate one with: python -c \"from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())\""
            )
        _key = raw.encode()
    return Fernet(_key)


def encrypt(plaintext: str) -> str:
    """Encrypt a plaintext string, return base64-encoded ciphertext."""
    return _get_fernet().encrypt(plaintext.encode()).decode()


def decrypt(ciphertext: str) -> str:
    """Decrypt a base64-encoded ciphertext, return plaintext."""
    return _get_fernet().decrypt(ciphertext.encode()).decode()
