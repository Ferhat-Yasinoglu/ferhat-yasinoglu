import pytest

_PROXY_VARS = ("HTTP_PROXY", "HTTPS_PROXY", "ALL_PROXY", "http_proxy", "https_proxy", "all_proxy")


@pytest.fixture(autouse=True)
def _no_proxy_for_localhost(monkeypatch):
    """Yerel test sunucularına istekler ortamdaki vekilden (HTTP_PROXY) geçmesin; testler makineden bağımsız olsun."""
    for v in _PROXY_VARS:
        monkeypatch.delenv(v, raising=False)
    for v in ("NO_PROXY", "no_proxy"):
        monkeypatch.setenv(v, "127.0.0.1,localhost,::1")
