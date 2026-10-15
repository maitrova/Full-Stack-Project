import logging

from fastapi import HTTPException, status

from app.repositories.business_repository import BusinessRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductCreate, ProductPublic, ProductUpdate
from app.schemas.user import UserPublic
from app.utils.object_id import object_id_to_str

logger = logging.getLogger(__name__)


class ProductService:
    def __init__(
        self,
        business_repository: BusinessRepository,
        product_repository: ProductRepository,
    ):
        self.business_repository = business_repository
        self.product_repository = product_repository

    async def _get_owned_business(self, current_user: UserPublic) -> dict:
        business = await self.business_repository.find_by_owner_id(current_user.id)
        if business is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Create a business before managing products",
            )
        return business

    async def list_products(self, current_user: UserPublic) -> list[ProductPublic]:
        business = await self._get_owned_business(current_user)
        products = await self.product_repository.list_products(str(business["_id"]))
        return [ProductPublic.model_validate(object_id_to_str(product)) for product in products]

    async def get_product(self, product_id: str, current_user: UserPublic) -> ProductPublic:
        business = await self._get_owned_business(current_user)
        product = await self.product_repository.find_by_id(product_id, str(business["_id"]))
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        return ProductPublic.model_validate(object_id_to_str(product))

    async def create_product(self, payload: ProductCreate, current_user: UserPublic) -> ProductPublic:
        business = await self._get_owned_business(current_user)
        product = await self.product_repository.create_product(
            business_id=str(business["_id"]),
            payload=self._normalize_payload(payload.model_dump()),
        )
        logger.info("Created product %s for business %s", product["_id"], business["_id"])
        return ProductPublic.model_validate(object_id_to_str(product))

    async def update_product(
        self,
        product_id: str,
        payload: ProductUpdate,
        current_user: UserPublic,
    ) -> ProductPublic:
        business = await self._get_owned_business(current_user)
        existing_product = await self.product_repository.find_by_id(product_id, str(business["_id"]))
        if existing_product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        update_payload = self._normalize_payload(payload.model_dump(exclude_unset=True))
        final_price = update_payload.get("price", existing_product["price"])
        final_sale_price = update_payload.get("sale_price", existing_product.get("sale_price"))
        if final_sale_price is not None and final_sale_price > final_price:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="sale_price cannot be greater than price",
            )

        product = await self.product_repository.update_product(
            product_id=product_id,
            business_id=str(business["_id"]),
            payload=update_payload,
        )
        if product is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")

        logger.info("Updated product %s for business %s", product["_id"], business["_id"])
        return ProductPublic.model_validate(object_id_to_str(product))

    async def delete_product(self, product_id: str, current_user: UserPublic) -> None:
        business = await self._get_owned_business(current_user)
        deleted = await self.product_repository.delete_product(product_id, str(business["_id"]))
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
        logger.info("Deleted product %s for business %s", product_id, business["_id"])

    def _normalize_payload(self, payload: dict) -> dict:
        attributes = payload.get("attributes")
        if isinstance(attributes, dict) and isinstance(attributes.get("attributes"), dict):
            payload["attributes"] = attributes["attributes"]
        return payload
