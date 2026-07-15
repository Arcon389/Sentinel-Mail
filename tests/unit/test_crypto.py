import pytest
from cryptography.fernet import Fernet

from app.security import crypto


def test_encrypt_decrypt_roundtrip():
    plaintext = "super-secret-imap-password"
    ciphertext = crypto.encrypt(plaintext)

    assert ciphertext != plaintext
    assert crypto.decrypt(ciphertext) == plaintext


def test_decrypt_with_wrong_key_raises(monkeypatch):
    ciphertext = crypto.encrypt("some-password")

    crypto._fernet.cache_clear()
    monkeypatch.setenv("ENCRYPTION_KEY", Fernet.generate_key().decode())
    from app.config import get_settings

    get_settings.cache_clear()

    with pytest.raises(crypto.DecryptionError):
        crypto.decrypt(ciphertext)

    crypto._fernet.cache_clear()
    get_settings.cache_clear()


def test_decrypt_garbage_raises():
    with pytest.raises(crypto.DecryptionError):
        crypto.decrypt("not-a-valid-fernet-token")
