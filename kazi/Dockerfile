# kazi web arayüzü. Build bağlamı kazi/ klasörüdür:
#   docker build -t kazi kazi/
#   docker run --rm -p 8000:8000 -e KAZI_TOKEN=en-az-16-karakterlik-sifre kazi
#
# JS (Playwright/Chromium) modu bilerek YOK: imajı yüzlerce MB büyütür ve ücretsiz planların
# belleği yetmez. Sunucuda KAZI_ALLOW_JS de kapalıdır. Gerekirse '.[web,extract,js]' kurup
# "playwright install --with-deps chromium" çalıştırın ve KAZI_ALLOW_JS=1 verin (ücretsiz planda önerilmez).

FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PORT=8000

WORKDIR /build
COPY pyproject.toml README.md ./
COPY src ./src
# hadolint ignore=DL3013
RUN pip install '.[web,extract]' \
 && rm -rf /build \
 && useradd --create-home --uid 10001 kazi

USER 10001
WORKDIR /home/kazi

EXPOSE 8000

# slim imajda curl yok; sağlık denetimi Python ile yapılır. Render kendi denetimini render.yaml'dan alır.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
    CMD ["python", "-c", "import os, urllib.request; urllib.request.urlopen('http://127.0.0.1:%s/api/health' % os.environ.get('PORT', '8000'), timeout=3)"]

# KAZI_TOKEN verilmezse sunucu başlamaz (bilerek). PORT'u çoğu barındırıcı (Render dahil) kendisi verir.
CMD ["sh", "-c", "exec kazi serve --host 0.0.0.0 --port \"$PORT\""]
