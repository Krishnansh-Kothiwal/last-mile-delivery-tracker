"""Zones & Areas CRUD router (admin-only)."""
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_admin
from app.models import Zone, Area, User
from app.zones.schemas import (
    ZoneCreate, ZoneUpdate, ZoneResponse,
    AreaCreate, AreaUpdate, AreaResponse,
)

router = APIRouter()


# ─── Zones ────────────────────────────────────────────────────────────────────

@router.get("/zones", response_model=List[ZoneResponse])
def list_zones(db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    return db.query(Zone).all()


@router.post("/zones", response_model=ZoneResponse, status_code=status.HTTP_201_CREATED)
def create_zone(payload: ZoneCreate, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    if db.query(Zone).filter(Zone.name == payload.name).first():
        raise HTTPException(status_code=400, detail="Zone name already exists")
    zone = Zone(**payload.model_dump())
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return zone


@router.get("/zones/{zone_id}", response_model=ZoneResponse)
def get_zone(zone_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    return zone


@router.put("/zones/{zone_id}", response_model=ZoneResponse)
def update_zone(zone_id: int, payload: ZoneUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(zone, key, value)
    db.commit()
    db.refresh(zone)
    return zone


@router.delete("/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_zone(zone_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    zone = db.query(Zone).filter(Zone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=404, detail="Zone not found")
    db.delete(zone)
    db.commit()


# ─── Areas ────────────────────────────────────────────────────────────────────

@router.get("/areas", response_model=List[AreaResponse])
def list_areas(zone_id: int = None, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    query = db.query(Area)
    if zone_id:
        query = query.filter(Area.zone_id == zone_id)
    return query.all()


@router.post("/areas", response_model=AreaResponse, status_code=status.HTTP_201_CREATED)
def create_area(payload: AreaCreate, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    if not db.query(Zone).filter(Zone.id == payload.zone_id).first():
        raise HTTPException(status_code=400, detail="Zone not found")
    if db.query(Area).filter(Area.postal_code == payload.postal_code).first():
        raise HTTPException(status_code=400, detail="Postal code already registered")
    area = Area(**payload.model_dump())
    db.add(area)
    db.commit()
    db.refresh(area)
    return area


@router.get("/areas/{area_id}", response_model=AreaResponse)
def get_area(area_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    return area


@router.put("/areas/{area_id}", response_model=AreaResponse)
def update_area(area_id: int, payload: AreaUpdate, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(area, key, value)
    db.commit()
    db.refresh(area)
    return area


@router.delete("/areas/{area_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_area(area_id: int, db: Session = Depends(get_db), _: User = Depends(get_current_admin)):
    area = db.query(Area).filter(Area.id == area_id).first()
    if not area:
        raise HTTPException(status_code=404, detail="Area not found")
    db.delete(area)
    db.commit()
