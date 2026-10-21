FROM python:3.12-slim

# tesseract enables OCR for scanned PDF pages
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr \
 && rm -rf /var/lib/apt/lists/*

ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata
WORKDIR /app
COPY pyproject.toml ./
COPY ddc_worker ./ddc_worker
RUN pip install --no-cache-dir .

RUN useradd --create-home worker
USER worker
CMD ["ddc-worker", "run"]
