import logging

from fastapi import HTTPException, status
from pymongo.errors import DuplicateKeyError

from app.repositories.user_repository import UserRepository
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserPublic
from app.services.security import create_access_token, hash_password, verify_password
from app.utils.object_id import object_id_to_str

logger = logging.getLogger(__name__)


class AuthService:
    def __init__(self, user_repository: UserRepository):
        self.user_repository = user_repository

    async def register(self, payload: UserCreate) -> TokenResponse:
        existing_user = await self.user_repository.find_by_email(payload.email)
        if existing_user is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            )

        try:
            user = await self.user_repository.create_user(
                name=payload.name,
                email=payload.email,
                password_hash=hash_password(payload.password),
            )
        except DuplicateKeyError:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="An account with this email already exists",
            ) from None

        logger.info("Registered user %s", user["_id"])
        return self._token_response(user)

    async def login(self, payload: UserLogin) -> TokenResponse:
        user = await self.user_repository.find_by_email(payload.email)
        if user is None or not verify_password(payload.password, user["password_hash"]):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid email or password",
            )

        logger.info("User %s logged in", user["_id"])
        return self._token_response(user)

    def _token_response(self, user: dict) -> TokenResponse:
        public_user = UserPublic.model_validate(object_id_to_str(user))
        return TokenResponse(
            access_token=create_access_token(subject=public_user.id),
            user=public_user,
        )
