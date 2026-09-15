from bson import ObjectId
from fastapi import HTTPException, status


def serialize_object_ids(value):
    if isinstance(value, ObjectId):
        return str(value)
    if isinstance(value, list):
        return [serialize_object_ids(item) for item in value]
    if isinstance(value, dict):
        return {key: serialize_object_ids(item) for key, item in value.items()}
    return value


def object_id_to_str(document: dict | None) -> dict | None:
    if document is None:
        return None

    return serialize_object_ids(dict(document))


def parse_object_id(value: str) -> ObjectId:
    if not ObjectId.is_valid(value):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid resource id")
    return ObjectId(value)
