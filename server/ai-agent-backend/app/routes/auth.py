from fastapi import APIRouter, Depends, status

from app.database.mongodb import get_database
from app.dependencies.auth import get_current_user
from app.repositories.user_repository import UserRepository
from app.schemas.user import TokenResponse, UserCreate, UserLogin, UserPublic
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


def get_auth_service() -> AuthService:
    return AuthService(UserRepository(get_database()))


@router.post(
    "/register",
    response_model=TokenResponse,
    response_model_by_alias=False,
    status_code=status.HTTP_201_CREATED,
)
async def register(payload: UserCreate, auth_service: AuthService = Depends(get_auth_service)):
    return await auth_service.register(payload)


@router.post("/login", response_model=TokenResponse, response_model_by_alias=False)
async def login(payload: UserLogin, auth_service: AuthService = Depends(get_auth_service)):
    return await auth_service.login(payload)


@router.get("/me", response_model=UserPublic, response_model_by_alias=False)
async def get_me(current_user: UserPublic = Depends(get_current_user)):
    return current_user
