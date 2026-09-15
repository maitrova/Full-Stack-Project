from fastapi import APIRouter, Depends, Response, status

from app.database.mongodb import get_database
from app.dependencies.auth import get_current_user
from app.repositories.business_repository import BusinessRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.product import ProductCreate, ProductPublic, ProductUpdate
from app.schemas.user import UserPublic
from app.services.product_service import ProductService

router = APIRouter(prefix="/products", tags=["products"])


def get_product_service() -> ProductService:
    database = get_database()
    return ProductService(
        business_repository=BusinessRepository(database),
        product_repository=ProductRepository(database),
    )


@router.get("", response_model=list[ProductPublic], response_model_by_alias=False)
async def list_products(
    current_user: UserPublic = Depends(get_current_user),
    product_service: ProductService = Depends(get_product_service),
):
    return await product_service.list_products(current_user)


@router.post(
    "",
    response_model=ProductPublic,
    response_model_by_alias=False,
    status_code=status.HTTP_201_CREATED,
)
async def create_product(
    payload: ProductCreate,
    current_user: UserPublic = Depends(get_current_user),
    product_service: ProductService = Depends(get_product_service),
):
    return await product_service.create_product(payload, current_user)


@router.get("/{product_id}", response_model=ProductPublic, response_model_by_alias=False)
async def get_product(
    product_id: str,
    current_user: UserPublic = Depends(get_current_user),
    product_service: ProductService = Depends(get_product_service),
):
    return await product_service.get_product(product_id, current_user)


@router.put("/{product_id}", response_model=ProductPublic, response_model_by_alias=False)
async def update_product(
    product_id: str,
    payload: ProductUpdate,
    current_user: UserPublic = Depends(get_current_user),
    product_service: ProductService = Depends(get_product_service),
):
    return await product_service.update_product(product_id, payload, current_user)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_product(
    product_id: str,
    current_user: UserPublic = Depends(get_current_user),
    product_service: ProductService = Depends(get_product_service),
):
    await product_service.delete_product(product_id, current_user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
