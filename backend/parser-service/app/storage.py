"""Получение файла: file:// (локальная разработка) или s3://bucket/key (приватный бакет)."""

import os
import tempfile
from pathlib import Path
from urllib.parse import unquote, urlparse
from urllib.request import url2pathname


def fetch_to_local(file_url: str, file_name: str) -> tuple[str, bool]:
    """Возвращает (локальный путь, нужно_ли_удалить_после_разбора)."""
    parsed = urlparse(file_url)

    if parsed.scheme == "file":
        path = url2pathname(unquote(parsed.path))
        if not Path(path).is_file():
            raise FileNotFoundError(f"Файл не найден: {path}")
        return path, False

    if parsed.scheme == "s3":
        import boto3  # ленивый импорт: нужен только в проде

        client = boto3.client(
            "s3",
            endpoint_url=os.getenv("S3_ENDPOINT") or None,
            aws_access_key_id=os.getenv("S3_ACCESS_KEY_ID"),
            aws_secret_access_key=os.getenv("S3_SECRET_ACCESS_KEY"),
        )
        fd, tmp_path = tempfile.mkstemp(suffix=Path(file_name).suffix.lower())
        os.close(fd)
        client.download_file(parsed.netloc, parsed.path.lstrip("/"), tmp_path)
        return tmp_path, True

    raise ValueError(f"Неподдерживаемая схема file_url: {parsed.scheme!r}")
