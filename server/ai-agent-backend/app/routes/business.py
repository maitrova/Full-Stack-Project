from fastapi import APIRouter, Depends, status

from app.database.mongodb import get_database
from app.dependencies.auth import get_current_user
from app.repositories.business_repository import BusinessRepository
from app.schemas.business import BusinessCreate, BusinessPublic, BusinessUpdate
from app.schemas.user import UserPublic
from app.services.business_service import BusinessService

router = APIRouter(prefix="/business", tags=["business"])


def get_business_service() -> BusinessService:
    return BusinessService(BusinessRepository(get_database()))


@router.get("", response_model=BusinessPublic | None, response_model_by_alias=False)
async def get_business(
    current_user: UserPublic = Depends(get_current_user),
    business_service: BusinessService = Depends(get_business_service),
):
    return await business_service.get_current_business(current_user)


@router.post(
    "",
    response_model=BusinessPublic,
    response_model_by_alias=False,
    status_code=status.HTTP_201_CREATED,
)
async def create_business(
    payload: BusinessCreate,
    current_user: UserPublic = Depends(get_current_user),
    business_service: BusinessService = Depends(get_business_service),
):
    return await business_service.create_business(payload, current_user)


@router.put("/{business_id}", response_model=BusinessPublic, response_model_by_alias=False)
async def update_business(
    business_id: str,
    payload: BusinessUpdate,
    current_user: UserPublic = Depends(get_current_user),
    business_service: BusinessService = Depends(get_business_service),
):
    return await business_service.update_business(business_id, payload, current_user)
