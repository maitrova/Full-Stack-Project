"""Quality checks for catalogue records before they reach the AI agent."""

from dataclasses import dataclass, field
from typing import Any
from urllib.parse import urlparse


@dataclass
class CatalogueQualityReport:
    product_id: str
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)

    @property
    def is_searchable(self) -> bool:
        return not self.errors


def validate_catalogue_record(product: dict[str, Any]) -> CatalogueQualityReport:
    """Validate semantic catalogue facts that a schema alone cannot verify."""
    product_id = str(product.get("_id") or product.get("id") or "unknown")
    report = CatalogueQualityReport(product_id=product_id)

    if not str(product.get("name") or "").strip():
        report.errors.append("missing_name")
    if not str(product.get("category") or "").strip():
        report.errors.append("missing_category")
    if product.get("price") is None:
        report.errors.append("missing_price")
    if product.get("stock") is None:
        report.errors.append("missing_stock")

    sale_price = product.get("sale_price")
    price = product.get("price")
    if sale_price is not None and price is not None and sale_price > price:
        report.errors.append("sale_price_above_price")

    attributes = product.get("attributes") or {}
    product_url = attributes.get("product_url")
    if product_url:
        parsed = urlparse(str(product_url))
        if parsed.scheme != "https" or not parsed.netloc:
            report.errors.append("invalid_product_url")
    else:
        report.warnings.append("missing_product_url")

    if not product.get("images"):
        report.warnings.append("missing_images")

    variants = attributes.get("variants") or []
    if variants and not isinstance(variants, list):
        report.errors.append("invalid_variants")
    elif isinstance(variants, list):
        for index, variant in enumerate(variants):
            if not isinstance(variant, dict):
                report.errors.append(f"invalid_variant_{index}")
                continue
            if not variant.get("size"):
                report.warnings.append(f"variant_{index}_missing_size")
            if variant.get("stock") is not None and variant.get("stock") < 0:
                report.errors.append(f"variant_{index}_negative_stock")
    return report
