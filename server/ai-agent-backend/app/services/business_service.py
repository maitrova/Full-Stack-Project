import logging

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.repositories.business_repository import BusinessRepository
from app.schemas.business import BusinessCreate, BusinessPublic, BusinessUpdate
from app.schemas.user import UserPublic
from app.utils.object_id import object_id_to_str

logger = logging.getLogger(__name__)


class BusinessService:
    def __init__(self, business_repository: BusinessRepository):
        self.business_repository = business_repository

    async def get_current_business(self, current_user: UserPublic) -> BusinessPublic | None:
        business = await self.business_repository.find_by_owner_id(current_user.id)
        if business is None:
            return None
        return BusinessPublic.model_validate(object_id_to_str(business))

    async def create_business(self, payload: BusinessCreate, current_user: UserPublic) -> BusinessPublic:
        existing_business = await self.business_repository.find_by_owner_id(current_user.id)
        if existing_business is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Business already exists for this account",
            )

        try:
            business = await self.business_repository.create_business(
                owner_id=current_user.id,
                payload=payload.model_dump(),
            )
        except DuplicateKeyError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Business already exists for this account",
            ) from None

        logger.info("Created business %s for user %s", business["_id"], current_user.id)
        return BusinessPublic.model_validate(object_id_to_str(business))

    async def update_business(
        self,
        business_id: str,
        payload: BusinessUpdate,
        current_user: UserPublic,
    ) -> BusinessPublic:
        existing_business = await self.business_repository.find_by_id_and_owner_id(
            business_id=business_id,
            owner_id=current_user.id,
        )
        if existing_business is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

        business = await self.business_repository.update_business(
            business_id=business_id,
            owner_id=current_user.id,
            payload=payload.model_dump(exclude_unset=True),
        )
        if business is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Business not found")

        logger.info("Updated business %s for user %s", business["_id"], current_user.id)
        return BusinessPublic.model_validate(object_id_to_str(business))
