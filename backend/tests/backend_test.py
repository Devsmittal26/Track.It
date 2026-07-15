"""UBC iteration-2 backend tests. Covers new endpoints: undo, actions/recent, tags/summary,
action-with-tag, patch settings, tasks CRUD, forgot/reset password, history CSV,
week summary, X-Timezone header, milestone response."""
import os
import time
import pytest
import requests

BASE = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") + "/api"
TZ = "Asia/Kolkata"


def _headers(token=None, tz=TZ):
    h = {"Content-Type": "application/json", "X-Timezone": tz}
    if token:
        h["Authorization"] = f"Bearer {token}"
    return h


@pytest.fixture(scope="module")
def user_ctx():
    email = f"ubc.iter2.{int(time.time())}@example.com"
    password = "TestPass123"
    r = requests.post(f"{BASE}/auth/register", json={"email": email, "password": password, "name": "Iter2"}, headers=_headers())
    assert r.status_code == 200, r.text
    token = r.json()["token"]
    # onboard with counter 176 so we can test milestone (176 -> 174 crosses 175)
    r = requests.post(f"{BASE}/onboard", json={"initial_count": 176}, headers=_headers(token))
    assert r.status_code == 200, r.text
    return {"email": email, "password": password, "token": token}


def test_state_with_timezone(user_ctx):
    r = requests.get(f"{BASE}/state", headers=_headers(user_ctx["token"], tz="Pacific/Kiritimati"))
    assert r.status_code == 200
    data = r.json()
    assert "today" in data and "date" in data["today"]
    assert "settings" in data and data["settings"]["daily_goal"] == 5
    assert "streak" in data
    assert "avg_done_7d" in data
    assert "projected_finish" in data
    assert data["counter"] == 176


def test_action_with_tag(user_ctx):
    r = requests.post(f"{BASE}/action", json={"kind": "done", "amount": 1, "tag": "Physics"}, headers=_headers(user_ctx["token"]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["counter"] == 175
    assert "milestone" in data
    # 176 -> 175 does NOT cross a boundary (175//25=7, 175//25=7)
    # Actually 176//25=7 and 175//25=7 so no milestone yet
    assert data["milestone"] is None
    assert "last_action_id" in data


def test_action_milestone_crossing(user_ctx):
    # 175 -> 174 crosses 175 (175//25=7, 174//25=6)
    r = requests.post(f"{BASE}/action", json={"kind": "done", "amount": 1}, headers=_headers(user_ctx["token"]))
    assert r.status_code == 200
    data = r.json()
    assert data["counter"] == 174
    assert data["milestone"] == 175


def test_undo_last(user_ctx):
    r = requests.post(f"{BASE}/undo", headers=_headers(user_ctx["token"]))
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["counter"] == 175  # undid the 174 done
    assert data["undone_action"]["kind"] == "done"


def test_recent_actions(user_ctx):
    r = requests.get(f"{BASE}/actions/recent?limit=10", headers=_headers(user_ctx["token"]))
    assert r.status_code == 200
    items = r.json()["items"]
    assert isinstance(items, list)
    # at least the tagged done should still be there
    assert any(it.get("tag") == "Physics" for it in items)


def test_tags_summary(user_ctx):
    r = requests.get(f"{BASE}/tags/summary?days=30", headers=_headers(user_ctx["token"]))
    assert r.status_code == 200
    items = r.json()["items"]
    tags = {it["tag"]: it["count"] for it in items}
    assert tags.get("Physics", 0) >= 1


def test_patch_settings(user_ctx):
    r = requests.patch(f"{BASE}/settings", json={"daily_goal": 8, "task_mode": "list"}, headers=_headers(user_ctx["token"]))
    assert r.status_code == 200
    s = r.json()["settings"]
    assert s["daily_goal"] == 8
    assert s["task_mode"] == "list"
    # verify via state
    r = requests.get(f"{BASE}/state", headers=_headers(user_ctx["token"]))
    assert r.json()["settings"]["daily_goal"] == 8

    # invalid task_mode
    r = requests.patch(f"{BASE}/settings", json={"task_mode": "bogus"}, headers=_headers(user_ctx["token"]))
    assert r.status_code == 400


def test_tasks_crud(user_ctx):
    token = user_ctx["token"]
    # create
    r = requests.post(f"{BASE}/tasks", json={"text": "TEST_Math Ch1"}, headers=_headers(token))
    assert r.status_code == 200
    task = r.json()
    tid = task["id"]
    assert task["done"] is False
    # list
    r = requests.get(f"{BASE}/tasks", headers=_headers(token))
    assert r.status_code == 200
    assert any(t["id"] == tid for t in r.json()["items"])
    # toggle
    r = requests.patch(f"{BASE}/tasks/{tid}", json={"done": True}, headers=_headers(token))
    assert r.status_code == 200
    assert r.json()["done"] is True
    # delete
    r = requests.delete(f"{BASE}/tasks/{tid}", headers=_headers(token))
    assert r.status_code == 200
    r = requests.get(f"{BASE}/tasks", headers=_headers(token))
    assert not any(t["id"] == tid for t in r.json()["items"])


def test_history_csv(user_ctx):
    r = requests.get(f"{BASE}/history/csv", headers=_headers(user_ctx["token"]))
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert r.text.splitlines()[0] == "date,added,done,overall,counter"


def test_week_summary(user_ctx):
    r = requests.get(f"{BASE}/summary/week", headers=_headers(user_ctx["token"]))
    assert r.status_code == 200
    d = r.json()
    assert "week_start" in d
    assert isinstance(d["per_day"], list) and len(d["per_day"]) == 7
    assert "added" in d and "done" in d and "best_done" in d


def test_edit_day(user_ctx):
    token = user_ctx["token"]
    st = requests.get(f"{BASE}/state", headers=_headers(token)).json()
    today = st["today"]["date"]
    counter_before = st["counter"]
    added_before = st["today"]["added"]
    done_before = st["today"]["done"]
    # edit day to added=added_before+2, done=done_before (net delta +2)
    r = requests.post(f"{BASE}/day", json={"date": today, "added": added_before + 2, "done": done_before}, headers=_headers(token))
    assert r.status_code == 200
    new = r.json()
    assert new["counter"] == counter_before + 2
    assert new["today"]["added"] == added_before + 2
    # revert
    requests.post(f"{BASE}/day", json={"date": today, "added": added_before, "done": done_before}, headers=_headers(token))


def test_forgot_and_reset_password(user_ctx):
    email = user_ctx["email"]
    r = requests.post(f"{BASE}/auth/forgot-password", json={"email": email}, headers=_headers())
    assert r.status_code == 200
    data = r.json()
    assert "reset_link" in data and "token=" in data["reset_link"]
    token = data["reset_link"].split("token=")[-1]

    new_pw = "NewPass456"
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": token, "password": new_pw}, headers=_headers())
    assert r.status_code == 200

    # old password should fail
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": user_ctx["password"]}, headers=_headers())
    assert r.status_code == 401
    # new password succeeds
    r = requests.post(f"{BASE}/auth/login", json={"email": email, "password": new_pw}, headers=_headers())
    assert r.status_code == 200
    user_ctx["password"] = new_pw
    user_ctx["token"] = r.json()["token"]

    # reusing token should fail
    r = requests.post(f"{BASE}/auth/reset-password", json={"token": token, "password": "AnotherPass1"}, headers=_headers())
    assert r.status_code == 400


def test_forgot_password_unknown_email_ok():
    r = requests.post(f"{BASE}/auth/forgot-password", json={"email": "nobody.unknown@example.com"}, headers=_headers())
    # should still 200 (no enumeration) but no reset_link
    assert r.status_code == 200
    assert "reset_link" not in r.json()
