from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timezone, timedelta, date
import logging
import bcrypt
import jwt
import uuid

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# -----------------------------------------------------------------------------
# Auth utilities
# -----------------------------------------------------------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=7),
        "type": "access",
    }
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key="access_token", value=token, httponly=True, secure=False,
        samesite="lax", max_age=60 * 60 * 24 * 7, path="/",
    )

async def get_current_user(request: Request) -> dict:
    token = request.cookies.get("access_token")
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[JWT_ALGORITHM])
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token")
        user = await db.users.find_one({"id": payload["sub"]})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        user.pop("password_hash", None)
        user.pop("_id", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    name: Optional[str] = None

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class OnboardIn(BaseModel):
    initial_count: int = Field(ge=0)

class DayLogUpdate(BaseModel):
    date: str  # YYYY-MM-DD
    added: Optional[int] = None
    done: Optional[int] = None

class DayLogAction(BaseModel):
    kind: str  # 'add' or 'done'
    amount: int = Field(default=1, ge=1)

class TaskIn(BaseModel):
    text: str

# -----------------------------------------------------------------------------
# Helpers
# -----------------------------------------------------------------------------
def today_str() -> str:
    return datetime.now(timezone.utc).date().isoformat()

async def get_or_create_day(user_id: str, date_str: str) -> dict:
    doc = await db.day_logs.find_one({"user_id": user_id, "date": date_str})
    if doc:
        doc.pop("_id", None)
        return doc
    new_doc = {
        "id": str(uuid.uuid4()),
        "user_id": user_id,
        "date": date_str,
        "added": 0,
        "done": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.day_logs.insert_one(new_doc.copy())
    return new_doc

async def get_user_state(user_id: str) -> dict:
    st = await db.user_state.find_one({"user_id": user_id})
    if st is None:
        st = {
            "user_id": user_id,
            "counter": 0,
            "onboarded": False,
            "current_task": "",
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.user_state.insert_one(st.copy())
    st.pop("_id", None)
    return st

async def save_user_state(user_id: str, updates: dict) -> None:
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.user_state.update_one({"user_id": user_id}, {"$set": updates}, upsert=True)

# -----------------------------------------------------------------------------
# Auth Routes
# -----------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": payload.name or email.split("@")[0],
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    set_auth_cookie(response, token)
    return {"id": user_id, "email": email, "name": user_doc["name"], "token": token}

@api_router.post("/auth/login")
async def login(payload: LoginIn, response: Response):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], email)
    set_auth_cookie(response, token)
    return {"id": user["id"], "email": user["email"], "name": user.get("name", ""), "token": token}

@api_router.post("/auth/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}

@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "name": user.get("name", "")}

# -----------------------------------------------------------------------------
# UBC (Unacademy Backlog Counter) Routes
# -----------------------------------------------------------------------------
@api_router.get("/state")
async def get_state(user: dict = Depends(get_current_user)):
    st = await get_user_state(user["id"])
    day = await get_or_create_day(user["id"], today_str())
    return {
        "counter": st.get("counter", 0),
        "onboarded": st.get("onboarded", False),
        "current_task": st.get("current_task", ""),
        "today": {
            "date": day["date"],
            "added": day.get("added", 0),
            "done": day.get("done", 0),
            "overall": day.get("added", 0) - day.get("done", 0),
        },
    }

@api_router.post("/onboard")
async def onboard(payload: OnboardIn, user: dict = Depends(get_current_user)):
    await save_user_state(user["id"], {
        "counter": payload.initial_count,
        "onboarded": True,
    })
    await get_or_create_day(user["id"], today_str())
    return await get_state(user)

@api_router.post("/action")
async def apply_action(payload: DayLogAction, user: dict = Depends(get_current_user)):
    if payload.kind not in ("add", "done"):
        raise HTTPException(status_code=400, detail="Invalid action kind")
    st = await get_user_state(user["id"])
    today = today_str()
    day = await get_or_create_day(user["id"], today)

    delta = payload.amount
    if payload.kind == "add":
        new_counter = st.get("counter", 0) + delta
        new_added = day.get("added", 0) + delta
        await db.day_logs.update_one(
            {"user_id": user["id"], "date": today}, {"$set": {"added": new_added}}
        )
    else:  # done
        new_counter = max(0, st.get("counter", 0) - delta)
        new_done = day.get("done", 0) + delta
        await db.day_logs.update_one(
            {"user_id": user["id"], "date": today}, {"$set": {"done": new_done}}
        )
    await save_user_state(user["id"], {"counter": new_counter})
    return await get_state(user)

@api_router.post("/task")
async def set_task(payload: TaskIn, user: dict = Depends(get_current_user)):
    await save_user_state(user["id"], {"current_task": payload.text})
    return {"current_task": payload.text}

@api_router.get("/history")
async def get_history(user: dict = Depends(get_current_user), days: int = 60):
    cursor = db.day_logs.find({"user_id": user["id"]}).sort("date", -1).limit(days)
    items = []
    async for d in cursor:
        d.pop("_id", None)
        items.append({
            "date": d["date"],
            "added": d.get("added", 0),
            "done": d.get("done", 0),
            "overall": d.get("added", 0) - d.get("done", 0),
        })
    # sort ascending for charts
    items_sorted = sorted(items, key=lambda x: x["date"])
    # compute running counter series (based on current state)
    st = await get_user_state(user["id"])
    current = st.get("counter", 0)
    # walk backwards to get counter at each day end
    counters_desc = []
    running = current
    for it in reversed(items_sorted):
        counters_desc.append(running)
        # to get counter *before* this day started, reverse today's delta
        running = running - (it["added"] - it["done"])
    counters = list(reversed(counters_desc))
    for i, it in enumerate(items_sorted):
        it["counter"] = counters[i]
    return {"items": list(reversed(items_sorted))}  # return descending (recent first)

@api_router.post("/day")
async def update_day(payload: DayLogUpdate, user: dict = Depends(get_current_user)):
    """Manually edit a day's added/done (rare, for corrections)."""
    day = await get_or_create_day(user["id"], payload.date)
    updates = {}
    if payload.added is not None:
        updates["added"] = max(0, payload.added)
    if payload.done is not None:
        updates["done"] = max(0, payload.done)
    if updates:
        await db.day_logs.update_one({"user_id": user["id"], "date": payload.date}, {"$set": updates})
    # Recompute counter based on all days' deltas? Simpler: adjust counter by diff.
    old_delta = day.get("added", 0) - day.get("done", 0)
    new_added = updates.get("added", day.get("added", 0))
    new_done = updates.get("done", day.get("done", 0))
    new_delta = new_added - new_done
    st = await get_user_state(user["id"])
    new_counter = max(0, st.get("counter", 0) + (new_delta - old_delta))
    await save_user_state(user["id"], {"counter": new_counter})
    return await get_state(user)

# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "UBC API"}

# -----------------------------------------------------------------------------
# Include router + middleware
# -----------------------------------------------------------------------------
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

@app.on_event("startup")
async def on_startup():
    await db.users.create_index("email", unique=True)
    await db.day_logs.create_index([("user_id", 1), ("date", 1)], unique=True)
    await db.user_state.create_index("user_id", unique=True)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
