"""Zones & Areas CRUD schemas."""
from pydantic import BaseModel
from typing import Optional


class ZoneCreate(BaseModel):
    name: str
    description: Optional[str] = None


class ZoneUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None


class ZoneResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]

    class Config:
        from_attributes = True


class AreaCreate(BaseModel):
    name: str
    postal_code: str
    zone_id: int
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AreaUpdate(BaseModel):
    name: Optional[str] = None
    postal_code: Optional[str] = None
    zone_id: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None


class AreaResponse(BaseModel):
    id: int
    name: str
    postal_code: str
    zone_id: int
    latitude: Optional[float]
    longitude: Optional[float]
    zone: Optional[ZoneResponse] = None

    class Config:
        from_attributes = True
