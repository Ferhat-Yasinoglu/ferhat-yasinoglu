import json
from types import SimpleNamespace as NS

import anthropic
import httpx2
import pytest

import kazi.extract as ex
from kazi.extract import ExtractError, extract

SCHEMA = {
    "type": "object",
    "properties": {"baslik": {"type": "string"}, "fiyat": {"type": "number"}},
    "required": ["baslik"],
}
MD = "# Kahve Makinesi\n\nFiyat: 1250 TL\n"


def tool_resp(data, stop="tool_use", name="emit"):
    return NS(stop_reason=stop, content=[NS(type="text", text="tamam"), NS(type="tool_use", name=name, input=data)])


def text_resp():
    return NS(stop_reason="end_turn", content=[NS(type="text", text="işte sonuç")])


class FakeClient:
    """messages.create çağrılarını kaydeder; sırayla hazır yanıt (ya da istisna) döndürür."""

    def __init__(self, *responses):
        self.responses = list(responses)
        self.calls = []
        self.messages = self

    def create(self, **kw):
        self.calls.append(kw)
        r = self.responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r


def bad_request(msg):
    resp = httpx2.Response(400, request=httpx2.Request("POST", "https://x.test/v1/messages"),
                          json={"type": "error", "error": {"type": "invalid_request_error", "message": msg}})
    return anthropic.BadRequestError(msg, response=resp, body=None)


@pytest.fixture(autouse=True)
def _env(monkeypatch):
    monkeypatch.delenv("KAZI_MODEL", raising=False)
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)


def test_extract_data_and_tool_shape():
    c = FakeClient(tool_resp({"baslik": "Kahve Makinesi", "fiyat": 1250}))
    r = extract(MD, SCHEMA, prompt="Ürün bilgisini çıkar", model="claude-sonnet-5", client=c)
    assert r == {"data": {"baslik": "Kahve Makinesi", "fiyat": 1250}, "model": "claude-sonnet-5",
                 "truncated": False, "warnings": []}
    kw = c.calls[0]
    assert [t["name"] for t in kw["tools"]] == ["emit"]
    assert kw["tools"][0]["input_schema"] == SCHEMA
    assert kw["tool_choice"] == {"type": "tool", "name": "emit"}  # zorlamayı kabul eden model
    user = kw["messages"][0]["content"]
    assert "Kahve Makinesi" in user and "Ürün bilgisini çıkar" in user


def test_default_model_uses_auto_tool_choice():
    c = FakeClient(tool_resp({"a": 1}))
    r = extract(MD, client=c)
    assert r["model"] == "claude-sonnet-5-5"
    assert c.calls[0]["model"] == "claude-sonnet-5-5"
    assert c.calls[0]["tool_choice"] == {"type": "auto"}  # 5.5 zorunlu tool_choice'u reddeder
    assert "emit" in c.calls[0]["system"]


def test_free_schema_when_none():
    c = FakeClient(tool_resp({"x": "y"}))
    extract(MD, client=c)
    assert c.calls[0]["tools"][0]["input_schema"] == {"type": "object"}
    assert "Şema verilmedi" in c.calls[0]["messages"][0]["content"]


def test_model_env_and_explicit_override(monkeypatch):
    monkeypatch.setenv("KAZI_MODEL", "claude-haiku-5-5")
    c = FakeClient(tool_resp({}), tool_resp({}))
    assert extract(MD, client=c)["model"] == "claude-haiku-5-5"
    assert extract(MD, model="claude-opus-5", client=c)["model"] == "claude-opus-5"
    assert [k["model"] for k in c.calls] == ["claude-haiku-5-5", "claude-opus-5"]


def test_schema_without_type_gets_object_and_non_object_rejected():
    c = FakeClient(tool_resp({}))
    extract(MD, {"properties": {"a": {"type": "string"}}}, client=c)
    assert c.calls[0]["tools"][0]["input_schema"]["type"] == "object"
    with pytest.raises(ValueError):
        extract(MD, {"type": "array", "items": {"type": "string"}}, client=FakeClient())


def test_truncation_reported_and_content_bounded():
    md = "\n".join(f"satır {i:04d} son" for i in range(2000))
    c = FakeClient(tool_resp({"a": 1}))
    r = extract(md, client=c, max_chars=1000)
    assert r["truncated"] is True
    assert "kırpıldı" in r["warnings"][0] and f"{len(md):,}" in r["warnings"][0]
    sent = c.calls[0]["messages"][0]["content"]
    assert "[... içerik kırpıldı ...]" in sent and len(sent) < 1500
    assert "satır 1999 son" not in sent
    kept = sent.split("\n\n[... içerik")[0].split("<belge>\n")[1]
    assert kept.splitlines()[-1] in set(md.splitlines())  # satır ortasından kesilmez


def test_short_content_not_truncated():
    r = extract(MD, client=FakeClient(tool_resp({"a": 1})), max_chars=1000)
    assert r["truncated"] is False and r["warnings"] == []


def test_default_limit_is_applied():
    big = "a " * (ex.MAX_CHARS)
    c = FakeClient(tool_resp({"a": 1}))
    r = extract(big, client=c)
    assert r["truncated"] is True and len(c.calls[0]["messages"][0]["content"]) < ex.MAX_CHARS + 500


def test_missing_api_key_gives_clear_error():
    with pytest.raises(ExtractError, match="ANTHROPIC_API_KEY"):
        extract(MD, SCHEMA)


def test_api_key_from_env_builds_client(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    made = {}
    fake = FakeClient(tool_resp({"a": 1}))

    def fake_anthropic(**kw):
        made.update(kw)
        return fake

    monkeypatch.setattr(ex.anthropic, "Anthropic", fake_anthropic)
    assert extract(MD)["data"] == {"a": 1}
    assert made["api_key"] == "sk-ant-test"


def test_empty_markdown_rejected():
    with pytest.raises(ExtractError, match="boş"):
        extract("  \n ", client=FakeClient())


def test_auto_mode_retries_once_when_no_tool_call():
    c = FakeClient(text_resp(), tool_resp({"a": 1}))
    assert extract(MD, client=c)["data"] == {"a": 1}
    assert len(c.calls) == 2
    assert "düz metin yazma" in c.calls[1]["messages"][0]["content"]
    assert "düz metin yazma" not in c.calls[0]["messages"][0]["content"]


def test_gives_up_after_second_miss():
    c = FakeClient(text_resp(), text_resp())
    with pytest.raises(ExtractError, match="emit"):
        extract(MD, client=c)
    assert len(c.calls) == 2


def test_wrong_tool_name_is_ignored():
    c = FakeClient(tool_resp({"a": 1}, name="baska"), tool_resp({"a": 2}))
    assert extract(MD, client=c)["data"] == {"a": 2}


def test_forced_rejected_falls_back_to_auto():
    c = FakeClient(bad_request('tool_choice: type "tool" and "any" are not supported for this model.'),
                   tool_resp({"a": 1}))
    assert extract(MD, model="claude-yeni-model", client=c)["data"] == {"a": 1}
    assert [k["tool_choice"]["type"] for k in c.calls] == ["tool", "auto"]


def test_unrelated_bad_request_not_swallowed():
    c = FakeClient(bad_request("max_tokens: too large"))
    with pytest.raises(ExtractError, match="400"):
        extract(MD, model="claude-yeni-model", client=c)
    assert len(c.calls) == 1


def test_refusal_and_max_tokens_errors():
    refusal = NS(stop_reason="refusal", content=[], stop_details=NS(category="cyber"))
    with pytest.raises(ExtractError, match="reddetti.*cyber"):
        extract(MD, client=FakeClient(refusal))
    with pytest.raises(ExtractError, match="max_tokens"):
        extract(MD, client=FakeClient(tool_resp({"a": 1}, stop="max_tokens")))


def test_non_dict_input_rejected():
    with pytest.raises(ExtractError, match="geçersiz"):
        extract(MD, client=FakeClient(tool_resp("düz metin")))


# Gerçek SDK + sahte taşıma: istek gövdesi ve hata eşlemesi (ağ yok).
def sdk_client(handler):
    return anthropic.Anthropic(api_key="sk-test", max_retries=0,
                               http_client=anthropic.DefaultHttpxClient(transport=httpx2.MockTransport(handler)))


def msg_json(content, stop):
    return {"id": "msg_1", "type": "message", "role": "assistant", "model": "claude-sonnet-5-5",
            "content": content, "stop_reason": stop, "stop_sequence": None,
            "usage": {"input_tokens": 5, "output_tokens": 5}}


def test_real_sdk_request_body_and_parse():
    seen = {}

    def handler(req):
        seen["path"], seen["body"], seen["key"] = req.url.path, json.loads(req.content), req.headers["x-api-key"]
        return httpx2.Response(200, json=msg_json(
            [{"type": "tool_use", "id": "tu_1", "name": "emit", "input": {"baslik": "K"}}], "tool_use"))

    r = extract(MD, SCHEMA, model="claude-sonnet-5", client=sdk_client(handler))
    assert r["data"] == {"baslik": "K"}
    b = seen["body"]
    assert seen["path"] == "/v1/messages" and seen["key"] == "sk-test"
    assert b["model"] == "claude-sonnet-5" and b["tool_choice"] == {"type": "tool", "name": "emit"}
    assert b["tools"][0]["name"] == "emit" and b["tools"][0]["input_schema"] == SCHEMA
    assert "Kahve Makinesi" in b["messages"][0]["content"]


@pytest.mark.parametrize("status,etype,pattern", [
    (401, "authentication_error", "ANTHROPIC_API_KEY"),
    (429, "rate_limit_error", "hız sınırı"),
    (500, "api_error", "500"),
])
def test_real_sdk_error_mapping(status, etype, pattern):
    def handler(req):
        return httpx2.Response(status, json={"type": "error", "error": {"type": etype, "message": "hata"}})

    with pytest.raises(ExtractError, match=pattern):
        extract(MD, client=sdk_client(handler))


def test_real_sdk_connection_error_mapped():
    def handler(req):
        raise httpx2.ConnectError("bağlanamadı", request=req)

    with pytest.raises(ExtractError, match="bağlanılamadı"):
        extract(MD, client=sdk_client(handler))


@pytest.mark.parametrize("bad", ["sk-ant-te\nst", "sk-ant te", "sk-ant-ğ", "sk-ant\rx"])
def test_invalid_api_key_chars_give_clear_error_not_connection_error(monkeypatch, bad):
    monkeypatch.setenv("ANTHROPIC_API_KEY", bad)

    def no_client(**kw):
        raise AssertionError("istemci kurulmamalıydı")
    monkeypatch.setattr(ex.anthropic, "Anthropic", no_client)
    with pytest.raises(ExtractError, match="ANTHROPIC_API_KEY geçersiz karakter") as ei:
        extract(MD)
    assert "sk-ant" not in str(ei.value)
