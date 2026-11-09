from pydantic import BaseModel, Field


class ParseRequest(BaseModel):
    file_name: str
    file_url: str = Field(description="s3://... путь в приватный бакет")


class PageText(BaseModel):
    page: int
    text: str
    char_start: int
    char_end: int


class ParseMetadata(BaseModel):
    total_pages: int
    pages: list[PageText]


class ParseResponse(BaseModel):
    sha256_hash: str = Field(min_length=64, max_length=64)
    extracted_text: str
    metadata: ParseMetadata
