from fastapi import APIRouter, Depends, status

from app.database.mongodb import get_database
from app.dependencies.auth import get_current_user
from app.repositories.business_repository import BusinessRepository
from app.schemas.business import BusinessCreate, BusinessPublic, BusinessUpdate, MerchantPromptPublic, MerchantPromptUpdate
from app.utils.datetime import utc_now
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


@router.get("/prompt", response_model=MerchantPromptPublic | None)
async def get_merchant_prompt(
    current_user: UserPublic = Depends(get_current_user),
):
    repository = BusinessRepository(get_database())
    business = await repository.find_by_owner_id(current_user.id)
    return business.get("ai_prompt_config") if business else None


@router.put("/prompt", response_model=MerchantPromptPublic)
async def update_merchant_prompt(
    payload: MerchantPromptUpdate,
    current_user: UserPublic = Depends(get_current_user),
):
    repository = BusinessRepository(get_database())
    business = await repository.find_by_owner_id(current_user.id)
    if business is None:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Business not found")
    previous = business.get("ai_prompt_config") or {}
    config = {
        "version": int(previous.get("version") or 0) + 1,
        "instructions": payload.instructions.strip(),
        "enabled": payload.enabled,
        "updated_at": utc_now(),
    }
    database = get_database()
    await database.merchant_prompt_versions.insert_one({
        "business_id": business["_id"], **config,
    })
    await repository.collection.update_one(
        {"_id": business["_id"]},
        {"$set": {"ai_prompt_config": config, "updated_at": config["updated_at"]}},
    )
    return config


@router.put("/{business_id}", response_model=BusinessPublic, response_model_by_alias=False)
async def update_business(
    business_id: str,
    payload: BusinessUpdate,
    current_user: UserPublic = Depends(get_current_user),
    business_service: BusinessService = Depends(get_business_service),
):
    return await business_service.update_business(business_id, payload, current_user)
