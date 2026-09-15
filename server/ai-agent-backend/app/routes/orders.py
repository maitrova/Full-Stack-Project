from fastapi import APIRouter, Depends, status

from app.database.mongodb import get_database
from app.dependencies.auth import get_current_user
from app.repositories.business_repository import BusinessRepository
from app.repositories.conversation_repository import ConversationRepository
from app.repositories.order_repository import OrderRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.order import OrderCreate, OrderPublic, OrderUpdate
from app.schemas.user import UserPublic
from app.services.order_service import OrderService

router = APIRouter(prefix="/orders", tags=["orders"])


def get_order_service() -> OrderService:
    database = get_database()
    return OrderService(
        business_repository=BusinessRepository(database),
        order_repository=OrderRepository(database),
        product_repository=ProductRepository(database),
        conversation_repository=ConversationRepository(database),
    )


@router.get("", response_model=list[OrderPublic], response_model_by_alias=False)
async def list_orders(
    current_user: UserPublic = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service),
):
    return await order_service.list_orders(current_user)


@router.post("", response_model=OrderPublic, response_model_by_alias=False, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreate,
    current_user: UserPublic = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service),
):
    return await order_service.create_order(payload, current_user)


@router.patch("/{order_id}", response_model=OrderPublic, response_model_by_alias=False)
async def update_order(
    order_id: str,
    payload: OrderUpdate,
    current_user: UserPublic = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service),
):
    return await order_service.update_order(order_id, payload, current_user)
