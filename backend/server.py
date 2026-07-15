from dotenv import load_dotenv
from pathlib import Path
import os

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends
from fastapi.responses import PlainTextResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
import logging
import bcrypt
import jwt
import uuid
import secrets
import io
import csv
import asyncio
import resend

# -----------------------------------------------------------------------------
# Setup
# -----------------------------------------------------------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_ALGORITHM = "HS256"
APP_NAME = "Track.It"

def get_jwt_secret() -> str:
    return os.environ["JWT_SECRET"]

app = FastAPI()
api_router = APIRouter(prefix="/api")

# -----------------------------------------------------------------------------
# Email (Resend)
# -----------------------------------------------------------------------------
RESEND_API_KEY = os.environ.get("RESEND_API_KEY", "")
SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "Track.It <onboarding@resend.dev>")
APP_URL = os.environ.get("APP_URL", "").rstrip("/")
if RESEND_API_KEY:
    resend.api_key = RESEND_API_KEY

def _reset_email_html(name: str, link: str) -> str:
    display = name or "there"
    return f"""
<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#0A0B0E;font-family:Arial,Helvetica,sans-serif;color:#F4F0EA;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0A0B0E;padding:40px 16px;">
      <tr><td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#121419;border:1px solid #22252D;border-radius:16px;padding:40px;">
          <tr><td>
            <div style="font-size:12px;letter-spacing:4px;text-transform:uppercase;color:#8E94A3;">Track.It</div>
            <h1 style="margin:12px 0 8px 0;font-size:28px;font-weight:900;color:#F4F0EA;letter-spacing:-1px;">Reset your password</h1>
            <p style="margin:0 0 24px 0;color:#8E94A3;font-size:15px;line-height:1.6;">
              Hi {display}, we got a request to reset your Track.It password. Click the button below to choose a new one. This link expires in 1 hour.
            </p>
            <table role="presentation" cellpadding="0" cellspacing="0">
              <tr><td style="border-radius:12px;background:#88A090;">
                <a href="{link}" style="display:inline-block;padding:14px 28px;color:#0D1410;font-weight:700;text-decoration:none;font-size:15px;border-radius:12px;">Reset password</a>
              </td></tr>
            </table>
            <p style="margin:28px 0 0 0;color:#8E94A3;font-size:12px;line-height:1.6;">
              If the button doesn't work, paste this link into your browser:<br/>
              <a href="{link}" style="color:#88A090;word-break:break-all;">{link}</a>
            </p>
            <p style="margin:24px 0 0 0;color:#8E94A3;font-size:12px;">
              Didn't request this? You can safely ignore this email — your password won't change.
            </p>
          </td></tr>
        </table>
        <div style="margin-top:16px;color:#8E94A3;font-size:11px;letter-spacing:2px;text-transform:uppercase;">Track.It · count what matters</div>
      </td></tr>
    </table>
  </body>
</html>
"""

async def send_reset_email(to_email: str, name: str, link: str) -> bool:
    if not RESEND_API_KEY:
        logging.getLogger(__name__).warning("RESEND_API_KEY not set — skipping email send")
        return False
    params = {
        "from": SENDER_EMAIL,
        "to": [to_email],
        "subject": "Reset your Track.It password",
        "html": _reset_email_html(name, link),
    }
    try:
        result = await asyncio.to_thread(resend.Emails.send, params)
        logging.getLogger(__name__).info(f"Resend email sent: {result}")
        return True
    except Exception as e:
        logging.getLogger(__name__).error(f"Resend email failed: {e}")
        return False

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
    payload = {"sub": user_id, "email": email,
               "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, get_jwt_secret(), algorithm=JWT_ALGORITHM)

def set_auth_cookie(response: Response, token: str) -> None:
    response.set_cookie(key="access_token", value=token, httponly=True, secure=False,
                       samesite="lax", max_age=60 * 60 * 24 * 7, path="/")

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
        user.pop("password_hash", None); user.pop("_id", None)
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# -----------------------------------------------------------------------------
# Timezone helper
# -----------------------------------------------------------------------------
def get_tz(request: Request) -> ZoneInfo:
    tz_name = request.headers.get("X-Timezone", "").strip()
    if not tz_name:
        return ZoneInfo("UTC")
    try:
        return ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        return ZoneInfo("UTC")

def today_str_tz(tz: ZoneInfo) -> str:
    return datetime.now(tz).date().isoformat()

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

class ForgotPasswordIn(BaseModel):
    email: EmailStr

class ResetPasswordIn(BaseModel):
    token: str
    password: str = Field(min_length=6)

class TrackerCreate(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    initial_count: int = Field(default=0, ge=0)
    color: Optional[str] = None  # e.g. "sage", "terracotta", "amber"
    icon: Optional[str] = None   # optional lucide name

class TrackerUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=80)
    color: Optional[str] = None
    icon: Optional[str] = None
    archived: Optional[bool] = None

class ActionIn(BaseModel):
    kind: str  # 'add' | 'done'
    amount: int = Field(default=1, ge=1)
    tag: Optional[str] = None

class CounterSetIn(BaseModel):
    value: int = Field(ge=0)

class DayLogUpdate(BaseModel):
    date: str
    added: Optional[int] = None
    done: Optional[int] = None

class TaskIn(BaseModel):
    text: str

class TaskItemIn(BaseModel):
    text: str

class TaskItemUpdate(BaseModel):
    text: Optional[str] = None
    done: Optional[bool] = None

class SettingsUpdate(BaseModel):
    daily_goal: Optional[int] = Field(default=None, ge=0)
    task_mode: Optional[str] = None
    timezone: Optional[str] = None
    theme: Optional[str] = None

class TagPresetIn(BaseModel):
    name: str

# -----------------------------------------------------------------------------
# State / migration helpers
# -----------------------------------------------------------------------------
DEFAULT_SETTINGS = {"daily_goal": 5, "task_mode": "single", "timezone": "UTC", "theme": "midnight"}

async def get_user_state(user_id: str) -> dict:
    st = await db.user_state.find_one({"user_id": user_id})
    if st is None:
        st = {"user_id": user_id, "settings": DEFAULT_SETTINGS.copy(),
              "updated_at": datetime.now(timezone.utc).isoformat()}
        await db.user_state.insert_one(st.copy())
    st.pop("_id", None)
    settings = st.get("settings") or {}
    for k, v in DEFAULT_SETTINGS.items():
        settings.setdefault(k, v)
    st["settings"] = settings
    return st

async def save_user_settings(user_id: str, settings: dict) -> None:
    await db.user_state.update_one(
        {"user_id": user_id},
        {"$set": {"settings": settings, "updated_at": datetime.now(timezone.utc).isoformat()}},
        upsert=True,
    )

async def get_tracker(user_id: str, tracker_id: str) -> dict:
    doc = await db.trackers.find_one({"id": tracker_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Tracker not found")
    doc.pop("_id", None)
    return doc

async def update_tracker(user_id: str, tracker_id: str, updates: dict) -> None:
    updates["updated_at"] = datetime.now(timezone.utc).isoformat()
    await db.trackers.update_one({"id": tracker_id, "user_id": user_id}, {"$set": updates})

async def ensure_migration(user_id: str) -> None:
    """One-shot migration: create default tracker for legacy users and backfill relations."""
    n = await db.trackers.count_documents({"user_id": user_id})
    if n > 0:
        return
    # Do we have any legacy per-user data?
    legacy = (
        await db.day_logs.count_documents({"user_id": user_id, "tracker_id": {"$exists": False}}) +
        await db.actions.count_documents({"user_id": user_id, "tracker_id": {"$exists": False}}) +
        await db.tasks.count_documents({"user_id": user_id, "tracker_id": {"$exists": False}})
    )
    st = await db.user_state.find_one({"user_id": user_id}) or {}
    onboarded = bool(st.get("onboarded"))
    if not onboarded and legacy == 0:
        return
    tid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    await db.trackers.insert_one({
        "id": tid, "user_id": user_id,
        "name": "Unacademy Backlog",
        "counter": int(st.get("counter", 0)),
        "current_task": st.get("current_task", ""),
        "color": "sage",
        "icon": "BookOpen",
        "archived": False,
        "created_at": st.get("created_at") or now,
        "updated_at": now,
    })
    for coll in ("day_logs", "actions", "tasks"):
        await db[coll].update_many(
            {"user_id": user_id, "tracker_id": {"$exists": False}},
            {"$set": {"tracker_id": tid}},
        )

async def get_or_create_day(tracker_id: str, user_id: str, date_str: str) -> dict:
    doc = await db.day_logs.find_one({"tracker_id": tracker_id, "date": date_str})
    if doc:
        doc.pop("_id", None)
        return doc
    new_doc = {
        "id": str(uuid.uuid4()),
        "tracker_id": tracker_id,
        "user_id": user_id,
        "date": date_str,
        "added": 0,
        "done": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.day_logs.insert_one(new_doc.copy())
    return new_doc

async def compute_streak(tracker_id: str, today: str) -> int:
    cursor = db.day_logs.find({"tracker_id": tracker_id}).sort("date", -1).limit(90)
    logs = {}
    async for d in cursor:
        logs[d["date"]] = d.get("done", 0)
    from datetime import date as _date
    y, m, d = map(int, today.split("-"))
    cur = _date(y, m, d)
    if logs.get(today, 0) < 1:
        cur = cur - timedelta(days=1)
    streak = 0
    while True:
        key = cur.isoformat()
        if logs.get(key, 0) >= 1:
            streak += 1
            cur = cur - timedelta(days=1)
        else:
            break
    return streak

async def week_summary(tracker_id: str, tz: ZoneInfo) -> dict:
    today = datetime.now(tz).date()
    monday = today - timedelta(days=today.weekday())
    days = [(monday + timedelta(days=i)).isoformat() for i in range(7)]
    cursor = db.day_logs.find({"tracker_id": tracker_id, "date": {"$in": days}})
    added = 0; done = 0; best_done = 0; best_day = None
    per_day = {d: {"added": 0, "done": 0} for d in days}
    async for d in cursor:
        a = d.get("added", 0); dn = d.get("done", 0)
        added += a; done += dn
        per_day[d["date"]] = {"added": a, "done": dn}
        if dn > best_done:
            best_done = dn; best_day = d["date"]
    return {"week_start": monday.isoformat(), "added": added, "done": done,
            "best_day": best_day, "best_done": best_done,
            "per_day": [{"date": d, **per_day[d]} for d in days]}

async def tracker_public(t: dict, tz: ZoneInfo, include_projection: bool = True) -> dict:
    today = today_str_tz(tz)
    day = await db.day_logs.find_one({"tracker_id": t["id"], "date": today})
    added_today = day.get("added", 0) if day else 0
    done_today = day.get("done", 0) if day else 0
    streak = await compute_streak(t["id"], today)
    projected = None; avg_done = 0.0
    if include_projection:
        seven_days_ago = (datetime.now(tz).date() - timedelta(days=7)).isoformat()
        cursor = db.day_logs.find({"tracker_id": t["id"], "date": {"$gte": seven_days_ago}})
        total = 0; count = 0
        async for d in cursor:
            total += d.get("done", 0); count += 1
        avg_done = (total / count) if count > 0 else 0.0
        if avg_done > 0 and t.get("counter", 0) > 0:
            days_left = t.get("counter", 0) / avg_done
            projected = (datetime.now(tz).date() + timedelta(days=int(round(days_left)))).isoformat()
    return {
        "id": t["id"],
        "name": t.get("name", ""),
        "counter": t.get("counter", 0),
        "current_task": t.get("current_task", ""),
        "color": t.get("color", "sage"),
        "icon": t.get("icon", "BookOpen"),
        "archived": t.get("archived", False),
        "created_at": t.get("created_at"),
        "updated_at": t.get("updated_at"),
        "streak": streak,
        "avg_done_7d": round(avg_done, 2),
        "projected_finish": projected,
        "today": {"date": today, "added": added_today, "done": done_today,
                  "overall": added_today - done_today},
    }

# -----------------------------------------------------------------------------
# Auth Routes
# -----------------------------------------------------------------------------
@api_router.post("/auth/register")
async def register(payload: RegisterIn, response: Response):
    email = payload.email.lower().strip()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {"id": user_id, "email": email,
                "name": payload.name or email.split("@")[0],
                "password_hash": hash_password(payload.password),
                "created_at": datetime.now(timezone.utc).isoformat()}
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
    await ensure_migration(user["id"])
    return {"id": user["id"], "email": user["email"], "name": user.get("name", "")}

@api_router.post("/auth/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    email = payload.email.lower().strip()
    user = await db.users.find_one({"email": email})
    if user:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(hours=1)
        await db.password_reset_tokens.insert_one({
            "token": token, "user_id": user["id"], "email": email,
            "expires_at": expires_at, "used": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        base = APP_URL or os.environ.get("FRONTEND_URL", "")
        reset_link = f"{base}/reset-password?token={token}" if base else f"/reset-password?token={token}"
        email_sent = await send_reset_email(email, user.get("name", ""), reset_link)
        logging.getLogger(__name__).info(f"[Track.It] Password reset link for {email}: {reset_link}")
        return {"ok": True, "email_sent": email_sent,
                "message": "If an account exists, a reset link has been sent to that email." if email_sent
                           else "Reset link generated. Email delivery is not configured — check server logs."}
    return {"ok": True, "email_sent": False, "message": "If an account exists, a reset link has been sent."}

@api_router.post("/auth/reset-password")
async def reset_password(payload: ResetPasswordIn):
    doc = await db.password_reset_tokens.find_one({"token": payload.token})
    if not doc or doc.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or used reset token")
    expires_at = doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="Reset token has expired")
    await db.users.update_one({"id": doc["user_id"]}, {"$set": {"password_hash": hash_password(payload.password)}})
    await db.password_reset_tokens.update_one({"token": payload.token}, {"$set": {"used": True}})
    return {"ok": True}

# -----------------------------------------------------------------------------
# Trackers — list / create / get / update / delete
# -----------------------------------------------------------------------------
@api_router.get("/trackers")
async def list_trackers(request: Request, user: dict = Depends(get_current_user)):
    await ensure_migration(user["id"])
    tz = get_tz(request)
    cursor = db.trackers.find({"user_id": user["id"]}).sort("created_at", 1)
    items = []
    async for t in cursor:
        t.pop("_id", None)
        items.append(await tracker_public(t, tz, include_projection=False))
    return {"items": items}

@api_router.post("/trackers")
async def create_tracker(request: Request, payload: TrackerCreate, user: dict = Depends(get_current_user)):
    now = datetime.now(timezone.utc).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "user_id": user["id"],
        "name": payload.name.strip(),
        "counter": payload.initial_count,
        "current_task": "",
        "color": payload.color or "sage",
        "icon": payload.icon or "BookOpen",
        "archived": False,
        "created_at": now,
        "updated_at": now,
    }
    await db.trackers.insert_one(doc.copy())
    tz = get_tz(request)
    return await tracker_public(doc, tz)

@api_router.get("/trackers/{tracker_id}")
async def get_tracker_route(request: Request, tracker_id: str, user: dict = Depends(get_current_user)):
    t = await get_tracker(user["id"], tracker_id)
    tz = get_tz(request)
    result = await tracker_public(t, tz)
    st = await get_user_state(user["id"])
    result["settings"] = st.get("settings", DEFAULT_SETTINGS)
    return result

@api_router.patch("/trackers/{tracker_id}")
async def patch_tracker(tracker_id: str, payload: TrackerUpdate, user: dict = Depends(get_current_user)):
    await get_tracker(user["id"], tracker_id)
    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name.strip()
    if payload.color is not None:
        updates["color"] = payload.color
    if payload.icon is not None:
        updates["icon"] = payload.icon
    if payload.archived is not None:
        updates["archived"] = bool(payload.archived)
    if updates:
        await update_tracker(user["id"], tracker_id, updates)
    t = await get_tracker(user["id"], tracker_id)
    return t

@api_router.delete("/trackers/{tracker_id}")
async def delete_tracker(tracker_id: str, user: dict = Depends(get_current_user)):
    await get_tracker(user["id"], tracker_id)
    await db.trackers.delete_one({"id": tracker_id, "user_id": user["id"]})
    await db.day_logs.delete_many({"tracker_id": tracker_id})
    await db.actions.delete_many({"tracker_id": tracker_id})
    await db.tasks.delete_many({"tracker_id": tracker_id})
    return {"ok": True}

# -----------------------------------------------------------------------------
# Tracker actions
# -----------------------------------------------------------------------------
@api_router.post("/trackers/{tracker_id}/action")
async def apply_action(request: Request, tracker_id: str, payload: ActionIn, user: dict = Depends(get_current_user)):
    if payload.kind not in ("add", "done"):
        raise HTTPException(status_code=400, detail="Invalid action kind")
    tz = get_tz(request)
    today = today_str_tz(tz)
    t = await get_tracker(user["id"], tracker_id)
    day = await get_or_create_day(tracker_id, user["id"], today)
    delta = payload.amount
    prev_counter = t.get("counter", 0)
    if payload.kind == "add":
        new_counter = prev_counter + delta
        await db.day_logs.update_one({"tracker_id": tracker_id, "date": today},
                                    {"$set": {"added": day.get("added", 0) + delta}})
    else:
        new_counter = max(0, prev_counter - delta)
        await db.day_logs.update_one({"tracker_id": tracker_id, "date": today},
                                    {"$set": {"done": day.get("done", 0) + delta}})
    await update_tracker(user["id"], tracker_id, {"counter": new_counter})
    action_doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "tracker_id": tracker_id,
                  "date": today, "kind": payload.kind, "amount": delta,
                  "tag": (payload.tag or "").strip() or None,
                  "undone": False, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.actions.insert_one(action_doc)
    milestone = None
    if payload.kind == "done":
        crossed = (prev_counter // 25) - (new_counter // 25)
        if crossed >= 1 and new_counter <= prev_counter:
            milestone = int((prev_counter // 25) * 25)
        if new_counter == 0 and prev_counter > 0:
            milestone = 0
    t2 = await get_tracker(user["id"], tracker_id)
    state = await tracker_public(t2, tz)
    st = await get_user_state(user["id"])
    state["settings"] = st.get("settings", DEFAULT_SETTINGS)
    state["last_action_id"] = action_doc["id"]
    state["milestone"] = milestone
    return state

@api_router.post("/trackers/{tracker_id}/undo")
async def undo_last(request: Request, tracker_id: str, user: dict = Depends(get_current_user)):
    action = await db.actions.find_one(
        {"user_id": user["id"], "tracker_id": tracker_id, "undone": False},
        sort=[("created_at", -1)],
    )
    if not action:
        raise HTTPException(status_code=404, detail="Nothing to undo")
    action.pop("_id", None)
    day = await get_or_create_day(tracker_id, user["id"], action["date"])
    t = await get_tracker(user["id"], tracker_id)
    if action["kind"] == "add":
        new_added = max(0, day.get("added", 0) - action["amount"])
        await db.day_logs.update_one({"tracker_id": tracker_id, "date": action["date"]},
                                    {"$set": {"added": new_added}})
        new_counter = max(0, t.get("counter", 0) - action["amount"])
    else:
        new_done = max(0, day.get("done", 0) - action["amount"])
        await db.day_logs.update_one({"tracker_id": tracker_id, "date": action["date"]},
                                    {"$set": {"done": new_done}})
        new_counter = t.get("counter", 0) + action["amount"]
    await update_tracker(user["id"], tracker_id, {"counter": new_counter})
    await db.actions.update_one({"id": action["id"]}, {"$set": {"undone": True}})
    tz = get_tz(request)
    t2 = await get_tracker(user["id"], tracker_id)
    state = await tracker_public(t2, tz)
    state["undone_action"] = {"kind": action["kind"], "amount": action["amount"]}
    return state

@api_router.post("/trackers/{tracker_id}/reset-today")
async def reset_today(request: Request, tracker_id: str, user: dict = Depends(get_current_user)):
    tz = get_tz(request)
    today = today_str_tz(tz)
    day = await get_or_create_day(tracker_id, user["id"], today)
    net_delta = day.get("added", 0) - day.get("done", 0)
    t = await get_tracker(user["id"], tracker_id)
    new_counter = max(0, t.get("counter", 0) - net_delta)
    await db.day_logs.update_one({"tracker_id": tracker_id, "date": today},
                                {"$set": {"added": 0, "done": 0}})
    await update_tracker(user["id"], tracker_id, {"counter": new_counter})
    await db.actions.update_many(
        {"tracker_id": tracker_id, "date": today, "undone": False},
        {"$set": {"undone": True}},
    )
    t2 = await get_tracker(user["id"], tracker_id)
    return await tracker_public(t2, tz)

@api_router.post("/trackers/{tracker_id}/counter/set")
async def set_counter(request: Request, tracker_id: str, payload: CounterSetIn, user: dict = Depends(get_current_user)):
    await get_tracker(user["id"], tracker_id)
    await update_tracker(user["id"], tracker_id, {"counter": payload.value})
    tz = get_tz(request)
    t = await get_tracker(user["id"], tracker_id)
    return await tracker_public(t, tz)

@api_router.post("/trackers/{tracker_id}/task")
async def set_task(tracker_id: str, payload: TaskIn, user: dict = Depends(get_current_user)):
    await get_tracker(user["id"], tracker_id)
    await update_tracker(user["id"], tracker_id, {"current_task": payload.text})
    return {"current_task": payload.text}

@api_router.get("/trackers/{tracker_id}/history")
async def history(tracker_id: str, user: dict = Depends(get_current_user), days: int = 60):
    await get_tracker(user["id"], tracker_id)
    cursor = db.day_logs.find({"tracker_id": tracker_id}).sort("date", -1).limit(days)
    items = []
    async for d in cursor:
        d.pop("_id", None)
        items.append({"date": d["date"], "added": d.get("added", 0),
                      "done": d.get("done", 0),
                      "overall": d.get("added", 0) - d.get("done", 0)})
    items_sorted = sorted(items, key=lambda x: x["date"])
    t = await get_tracker(user["id"], tracker_id)
    running = t.get("counter", 0)
    counters_desc = []
    for it in reversed(items_sorted):
        counters_desc.append(running)
        running = running - (it["added"] - it["done"])
    counters = list(reversed(counters_desc))
    for i, it in enumerate(items_sorted):
        it["counter"] = counters[i]
    return {"items": list(reversed(items_sorted))}

@api_router.get("/trackers/{tracker_id}/history/csv", response_class=PlainTextResponse)
async def history_csv(tracker_id: str, user: dict = Depends(get_current_user)):
    hist = await history(tracker_id, user, days=3650)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["date", "added", "done", "overall", "counter"])
    for it in reversed(hist["items"]):
        writer.writerow([it["date"], it["added"], it["done"], it["overall"], it["counter"]])
    t = await get_tracker(user["id"], tracker_id)
    fname = f"trackit_{t['name'].replace(' ', '_').lower()}.csv"
    return PlainTextResponse(content=output.getvalue(), media_type="text/csv",
                             headers={"Content-Disposition": f'attachment; filename="{fname}"'})

@api_router.post("/trackers/{tracker_id}/day")
async def update_day(request: Request, tracker_id: str, payload: DayLogUpdate, user: dict = Depends(get_current_user)):
    await get_tracker(user["id"], tracker_id)
    day = await get_or_create_day(tracker_id, user["id"], payload.date)
    updates = {}
    if payload.added is not None:
        updates["added"] = max(0, payload.added)
    if payload.done is not None:
        updates["done"] = max(0, payload.done)
    if updates:
        await db.day_logs.update_one({"tracker_id": tracker_id, "date": payload.date}, {"$set": updates})
    old_delta = day.get("added", 0) - day.get("done", 0)
    new_added = updates.get("added", day.get("added", 0))
    new_done = updates.get("done", day.get("done", 0))
    new_delta = new_added - new_done
    t = await get_tracker(user["id"], tracker_id)
    new_counter = max(0, t.get("counter", 0) + (new_delta - old_delta))
    await update_tracker(user["id"], tracker_id, {"counter": new_counter})
    tz = get_tz(request)
    t2 = await get_tracker(user["id"], tracker_id)
    return await tracker_public(t2, tz)

@api_router.get("/trackers/{tracker_id}/summary/week")
async def summary_week(request: Request, tracker_id: str, user: dict = Depends(get_current_user)):
    await get_tracker(user["id"], tracker_id)
    tz = get_tz(request)
    return await week_summary(tracker_id, tz)

@api_router.get("/trackers/{tracker_id}/tags/summary")
async def tags_summary(tracker_id: str, user: dict = Depends(get_current_user), days: int = 30):
    await get_tracker(user["id"], tracker_id)
    cutoff = (datetime.now(timezone.utc).date() - timedelta(days=days)).isoformat()
    pipeline = [
        {"$match": {"tracker_id": tracker_id, "undone": False, "kind": "done",
                    "date": {"$gte": cutoff}, "tag": {"$ne": None}}},
        {"$group": {"_id": "$tag", "count": {"$sum": "$amount"}}},
        {"$sort": {"count": -1}},
    ]
    result = []
    async for d in db.actions.aggregate(pipeline):
        result.append({"tag": d["_id"], "count": d["count"]})
    return {"items": result}

# Tasks (list mode) — per-tracker
@api_router.get("/trackers/{tracker_id}/tasks")
async def list_tasks(tracker_id: str, user: dict = Depends(get_current_user)):
    await get_tracker(user["id"], tracker_id)
    cursor = db.tasks.find({"tracker_id": tracker_id}).sort("created_at", 1)
    items = []
    async for d in cursor:
        d.pop("_id", None)
        items.append(d)
    return {"items": items}

@api_router.post("/trackers/{tracker_id}/tasks")
async def create_task(tracker_id: str, payload: TaskItemIn, user: dict = Depends(get_current_user)):
    await get_tracker(user["id"], tracker_id)
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Task text is required")
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "tracker_id": tracker_id,
           "text": text, "done": False,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.tasks.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api_router.patch("/trackers/{tracker_id}/tasks/{task_id}")
async def patch_task(tracker_id: str, task_id: str, payload: TaskItemUpdate, user: dict = Depends(get_current_user)):
    updates = {}
    if payload.text is not None:
        updates["text"] = payload.text.strip()
    if payload.done is not None:
        updates["done"] = bool(payload.done)
    if not updates:
        raise HTTPException(status_code=400, detail="Nothing to update")
    res = await db.tasks.update_one({"id": task_id, "tracker_id": tracker_id, "user_id": user["id"]},
                                    {"$set": updates})
    if res.matched_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    task = await db.tasks.find_one({"id": task_id, "tracker_id": tracker_id, "user_id": user["id"]})
    task.pop("_id", None)
    return task

@api_router.delete("/trackers/{tracker_id}/tasks/{task_id}")
async def delete_task(tracker_id: str, task_id: str, user: dict = Depends(get_current_user)):
    res = await db.tasks.delete_one({"id": task_id, "tracker_id": tracker_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Task not found")
    return {"ok": True}

# -----------------------------------------------------------------------------
# User-wide: settings + tag presets
# -----------------------------------------------------------------------------
@api_router.get("/settings")
async def get_settings(user: dict = Depends(get_current_user)):
    st = await get_user_state(user["id"])
    return {"settings": st.get("settings", DEFAULT_SETTINGS)}

@api_router.patch("/settings")
async def patch_settings(payload: SettingsUpdate, user: dict = Depends(get_current_user)):
    st = await get_user_state(user["id"])
    settings = st.get("settings", DEFAULT_SETTINGS.copy())
    if payload.daily_goal is not None:
        settings["daily_goal"] = payload.daily_goal
    if payload.task_mode is not None:
        if payload.task_mode not in ("single", "list"):
            raise HTTPException(status_code=400, detail="task_mode must be 'single' or 'list'")
        settings["task_mode"] = payload.task_mode
    if payload.timezone is not None:
        try:
            ZoneInfo(payload.timezone)
            settings["timezone"] = payload.timezone
        except ZoneInfoNotFoundError:
            raise HTTPException(status_code=400, detail="Invalid timezone")
    if payload.theme is not None:
        allowed = {"midnight", "paper", "ocean", "forest"}
        if payload.theme not in allowed:
            raise HTTPException(status_code=400, detail=f"theme must be one of {sorted(allowed)}")
        settings["theme"] = payload.theme
    await save_user_settings(user["id"], settings)
    return {"settings": settings}

DEFAULT_PRESETS = ["Physics", "Chemistry", "Math", "Biology"]

async def ensure_default_presets(user_id: str) -> None:
    existing = await db.tag_presets.count_documents({"user_id": user_id})
    if existing == 0:
        for name in DEFAULT_PRESETS:
            await db.tag_presets.insert_one({
                "id": str(uuid.uuid4()), "user_id": user_id, "name": name,
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

@api_router.get("/tag-presets")
async def list_tag_presets(user: dict = Depends(get_current_user)):
    await ensure_default_presets(user["id"])
    cursor = db.tag_presets.find({"user_id": user["id"]}).sort("created_at", 1)
    items = []
    async for d in cursor:
        d.pop("_id", None)
        items.append(d)
    return {"items": items}

@api_router.post("/tag-presets")
async def create_tag_preset(payload: TagPresetIn, user: dict = Depends(get_current_user)):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Preset name required")
    if await db.tag_presets.find_one({"user_id": user["id"], "name": name}):
        raise HTTPException(status_code=400, detail="Preset already exists")
    doc = {"id": str(uuid.uuid4()), "user_id": user["id"], "name": name,
           "created_at": datetime.now(timezone.utc).isoformat()}
    await db.tag_presets.insert_one(doc.copy())
    doc.pop("_id", None)
    return doc

@api_router.delete("/tag-presets/{preset_id}")
async def delete_tag_preset(preset_id: str, user: dict = Depends(get_current_user)):
    res = await db.tag_presets.delete_one({"id": preset_id, "user_id": user["id"]})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Preset not found")
    return {"ok": True}

# -----------------------------------------------------------------------------
# Health
# -----------------------------------------------------------------------------
@api_router.get("/")
async def root():
    return {"message": "Track.It API", "app": APP_NAME}

# -----------------------------------------------------------------------------
# App wiring
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
    # Migrate any legacy users (day_logs w/o tracker_id) BEFORE creating the new unique index
    legacy_user_ids = set()
    async for d in db.day_logs.find({"tracker_id": {"$exists": False}}, {"user_id": 1}):
        legacy_user_ids.add(d.get("user_id"))
    async for a in db.actions.find({"tracker_id": {"$exists": False}}, {"user_id": 1}):
        legacy_user_ids.add(a.get("user_id"))
    async for tk in db.tasks.find({"tracker_id": {"$exists": False}}, {"user_id": 1}):
        legacy_user_ids.add(tk.get("user_id"))
    for uid in legacy_user_ids:
        if uid:
            await ensure_migration(uid)
    # Drop legacy per-user unique day_logs index if present
    try:
        await db.day_logs.drop_index("user_id_1_date_1")
    except Exception:
        pass
    await db.day_logs.create_index([("tracker_id", 1), ("date", 1)], unique=True)
    await db.user_state.create_index("user_id", unique=True)
    await db.actions.create_index([("tracker_id", 1), ("created_at", -1)])
    await db.tasks.create_index([("tracker_id", 1), ("created_at", 1)])
    await db.tag_presets.create_index([("user_id", 1), ("name", 1)], unique=True)
    await db.trackers.create_index([("user_id", 1), ("created_at", 1)])
    await db.password_reset_tokens.create_index("token", unique=True)
    await db.password_reset_tokens.create_index("expires_at", expireAfterSeconds=0)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
