"""Audit the normalized live catalogue before it is exposed to the agent.

Usage:
    python scripts/audit_catalogue.py --business-id <business-object-id>

The command is read-only. It exits with status 1 when any hard catalogue
errors are found, which makes it suitable for a deployment/CI gate.
"""

import argparse
import asyncio
import json
import sys
from pathlib import Path

from motor.motor_asyncio import AsyncIOMotorClient

sys.path.insert(0, str(Path(__file__).parents[1]))

from app.config.settings import settings  # noqa: E402
from app.repositories.ecommerce_product_repository import EcommerceProductRepository  # noqa: E402
from app.services.catalogue_quality import validate_catalogue_record  # noqa: E402
from app.utils.object_id import parse_object_id  # noqa: E402


async def audit(business_id: str) -> dict:
    url = settings.ecommerce_mongodb_url or settings.mongoose_url or settings.primary_mongodb_url
    client = AsyncIOMotorClient(url, serverSelectionTimeoutMS=5000)
    try:
        database = client[settings.ecommerce_mongodb_db_name]
        repository = EcommerceProductRepository(database)
        # Validate the same normalized records that ProductTools consumes.
        products = await repository._load_catalogue(str(parse_object_id(business_id)))
        reports = [validate_catalogue_record(product) for product in products]
        return {
            "business_id": business_id,
            "total_products": len(reports),
            "searchable_products": sum(report.is_searchable for report in reports),
            "error_products": sum(bool(report.errors) for report in reports),
            "warning_products": sum(bool(report.warnings) for report in reports),
            "errors_by_type": _count_issues(reports, "errors"),
            "warnings_by_type": _count_issues(reports, "warnings"),
            "products": [
                {
                    "product_id": report.product_id,
                    "errors": report.errors,
                    "warnings": report.warnings,
                }
                for report in reports
                if report.errors or report.warnings
            ],
        }
    finally:
        client.close()


def _count_issues(reports, attribute: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for report in reports:
        for issue in getattr(report, attribute):
            counts[issue] = counts.get(issue, 0) + 1
    return dict(sorted(counts.items(), key=lambda item: (-item[1], item[0])))


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit normalized ecommerce catalogue quality")
    parser.add_argument("--business-id", required=True, help="Business ObjectId used by the AI catalogue adapter")
    parser.add_argument("--json-out", type=Path, help="Optional path for the complete JSON report")
    args = parser.parse_args()
    result = asyncio.run(audit(args.business_id))
    rendered = json.dumps(result, ensure_ascii=False, indent=2, default=str)
    print(rendered)
    if args.json_out:
        args.json_out.write_text(rendered + "\n", encoding="utf-8")
    return 1 if result["error_products"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
