"""
Trivaro MT5 Monitor — centralized account monitoring via MT5 investor passwords.

Connects to each client's MT5 account remotely on the broker's server (no client-
side software needed). Polls equity, balance, and closed trades. Writes equity
snapshots directly to Supabase and sends new trades to receive-trade for rule
evaluation.

Works regardless of how the client trades — desktop, mobile, or web terminal.

Requirements:
  - Windows VPS with MetaTrader 5 terminal installed (provides DLLs)
  - Python 3.9+ with MetaTrader5 and requests packages
  - Investor (read-only) password for each MT5 account

Usage:
  python mt5_bridge.py [--config config.json] [--once]
"""

import json
import logging
import os
import signal
import sys
import time
import traceback
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

# ---------------------------------------------------------------------------
# MT5 import — only available on Windows with MT5 installed
# ---------------------------------------------------------------------------
try:
    import MetaTrader5 as mt5
except ImportError:
    print("ERROR: MetaTrader5 package not found.")
    print("Install with: pip install MetaTrader5")
    print("MetaTrader5 requires Windows + an installed MT5 terminal for its DLLs.")
    sys.exit(1)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
POLL_MIN_SECONDS = 10
POLL_MAX_SECONDS = 300
HTTP_TIMEOUT = 30
MAX_RETRIES = 3

DEAL_ENTRY_IN = 0
DEAL_ENTRY_OUT = 1
DEAL_TYPE_BUY = 0
DEAL_TYPE_SELL = 1

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logger = logging.getLogger("mt5_monitor")


def setup_logging(log_file: Optional[str]) -> None:
    logger.setLevel(logging.DEBUG)

    fmt = logging.Formatter(
        "%(asctime)s | %(levelname)-8s | %(message)s", datefmt="%Y-%m-%d %H:%M:%S"
    )

    console = logging.StreamHandler(sys.stdout)
    console.setLevel(logging.INFO)
    console.setFormatter(fmt)
    logger.addHandler(console)

    if log_file:
        file_handler = logging.FileHandler(log_file, encoding="utf-8")
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(fmt)
        logger.addHandler(file_handler)


# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
def load_config(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        config = json.load(f)

    required_top = ["endpoint_url", "api_secret", "accounts"]
    for key in required_top:
        if key not in config:
            raise ValueError(f"Missing required config key: {key}")

    if not config["accounts"]:
        raise ValueError("accounts list is empty")

    interval = config.get("poll_interval_seconds", 60)
    config["poll_interval_seconds"] = max(POLL_MIN_SECONDS, min(interval, POLL_MAX_SECONDS))

    return config


# ---------------------------------------------------------------------------
# State file — tracks last-seen deal ticket per account so we only process new
# ---------------------------------------------------------------------------
def load_state(path: str) -> Dict[str, dict]:
    """Returns { account_number: { last_ticket: int, last_snapshot: str } }."""
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, TypeError):
        logger.warning("State file corrupt, starting fresh")
        return {}


def save_state(path: str, state: Dict[str, dict]) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(state, f, indent=2)
    os.replace(tmp, path)


# ---------------------------------------------------------------------------
# HTTP session
# ---------------------------------------------------------------------------
def build_session() -> requests.Session:
    session = requests.Session()
    retry = Retry(
        total=MAX_RETRIES,
        backoff_factor=1,
        status_forcelist=[429, 500, 502, 503, 504],
        allowed_methods=["POST"],
    )
    adapter = HTTPAdapter(max_retries=retry)
    session.mount("https://", adapter)
    session.mount("http://", adapter)
    return session


# ---------------------------------------------------------------------------
# Supabase REST API helpers (direct HTTP — no supabase SDK needed)
# ---------------------------------------------------------------------------

class SupabaseRest:
    """Minimal Supabase REST client using requests."""

    def __init__(self, url: str, service_role_key: str):
        self.base = url.rstrip("/") + "/rest/v1"
        self.session = requests.Session()
        self.session.headers.update({
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        })

    def get(self, table: str, query: str = "*", **filters) -> Optional[dict]:
        """GET /rest/v1/{table}?select=...&field=eq.value — returns first row."""
        params = {}
        if query:
            params["select"] = query
        for key, value in filters.items():
            # eq.col_name=value
            params[key] = f"eq.{value}"
        try:
            resp = self.session.get(f"{self.base}/{table}", params=params, timeout=HTTP_TIMEOUT)
            if resp.status_code == 200:
                rows = resp.json()
                return rows[0] if rows else None
            return None
        except requests.RequestException as exc:
            logger.debug("REST GET %s failed: %s", table, exc)
            return None

    def upsert(self, table: str, row: dict, on_conflict: str = "") -> bool:
        """POST /rest/v1/{table} with Prefer: resolution=merge-duplicates."""
        headers = {}
        if on_conflict:
            headers["Prefer"] = "resolution=merge-duplicates"
        try:
            resp = self.session.post(
                f"{self.base}/{table}",
                json=row,
                headers=headers,
                timeout=HTTP_TIMEOUT,
            )
            return resp.status_code in (200, 201, 204)
        except requests.RequestException as exc:
            logger.debug("REST POST %s failed: %s", table, exc)
            return False

    def count(self, table: str, **filters) -> int:
        """GET /rest/v1/{table}?select=count with filters — returns exact count."""
        headers = {"Prefer": "count=exact"}
        params = {}
        for key, value in filters.items():
            params[key] = f"eq.{value}"
        try:
            resp = self.session.get(
                f"{self.base}/{table}",
                headers=headers,
                params=params,
                timeout=HTTP_TIMEOUT,
            )
            if resp.status_code in (200, 206):
                content_range = resp.headers.get("content-range", "")
                # "0-0/15" → count is after the /
                parts = content_range.split("/")
                if len(parts) == 2:
                    return int(parts[1])
            return 0
        except requests.RequestException:
            return 0


def get_supabase(config: dict) -> Optional[SupabaseRest]:
    """Build a SupabaseRest client if credentials are configured."""
    url = config.get("supabase_url", "").strip()
    key = config.get("supabase_service_role_key", "").strip()
    if not url or not key:
        logger.warning("supabase_url or supabase_service_role_key not set — equity snapshots disabled")
        return None
    return SupabaseRest(url, key)


# ---------------------------------------------------------------------------
# Account-level MT5 operations
# ---------------------------------------------------------------------------

def connect_account(account_cfg: dict) -> bool:
    """Log into a single MT5 account on its broker server. Returns True on success."""
    login = int(account_cfg["mt5_login"])
    password = str(account_cfg["mt5_password"])
    server = str(account_cfg["mt5_server"])

    authorized = mt5.login(login=login, password=password, server=server)
    if not authorized:
        err = mt5.last_error()
        logger.error("Login failed for login=%d server=%s: code=%s", login, server, err)
        return False
    return True


def get_account_snapshot() -> Optional[dict]:
    """Return equity/balance/margin for the currently-logged-in MT5 account."""
    info = mt5.account_info()
    if info is None:
        err = mt5.last_error()
        logger.warning("account_info() failed: code=%s", err)
        return None
    return {
        "login": int(info.login),
        "balance": float(info.balance),
        "equity": float(info.equity),
        "margin": float(info.margin),
        "margin_free": float(info.margin_free),
        "margin_level": float(info.margin_level) if info.margin_level else None,
        "leverage": int(info.leverage),
        "currency": info.currency,
    }


def get_closed_positions(since: datetime) -> List[dict]:
    """
    Fetch positions closed since *since* for the currently-logged-in account.
    Pairs entry + exit deals to produce full trade records.
    """
    window_start = since
    window_end = datetime.now()

    deals_since = mt5.history_deals_get(window_start, window_end)
    if deals_since is None or len(deals_since) == 0:
        return []

    closed: List[dict] = []
    seen: Set[int] = set()

    for deal in deals_since:
        if deal.entry != DEAL_ENTRY_OUT:
            continue
        if deal.position_id in seen:
            continue
        seen.add(deal.position_id)

        pos_deals = mt5.history_deals_get(position=deal.position_id)
        if pos_deals is None:
            continue

        entry_deal = None
        exit_deal = None
        for d in pos_deals:
            if d.entry == DEAL_ENTRY_IN:
                entry_deal = d
            elif d.entry == DEAL_ENTRY_OUT:
                exit_deal = d

        if entry_deal is None or exit_deal is None:
            continue

        deal_type = "buy" if entry_deal.type == DEAL_TYPE_BUY else "sell"

        closed.append({
            "ticket": int(exit_deal.ticket),
            "position_id": int(exit_deal.position_id),
            "symbol": entry_deal.symbol,
            "type": deal_type,
            "lots": float(entry_deal.volume),
            "open_price": float(entry_deal.price),
            "close_price": float(exit_deal.price),
            "profit": float(exit_deal.profit),
            "open_time": datetime.fromtimestamp(entry_deal.time, tz=timezone.utc).isoformat(),
            "close_time": datetime.fromtimestamp(exit_deal.time, tz=timezone.utc).isoformat(),
        })

    return closed


# ---------------------------------------------------------------------------
# Supabase direct writes
# ---------------------------------------------------------------------------

def write_equity_snapshot(
    rest: SupabaseRest,
    challenge_id: str,
    equity: float,
    balance: float,
    trade_count: int,
) -> bool:
    """Upsert today's equity snapshot row for a challenge."""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return rest.upsert("equity_snapshots", {
        "challenge_id": challenge_id,
        "snapshot_date": today,
        "equity": equity,
        "balance": balance,
        "trade_count": trade_count,
    }, on_conflict="challenge_id,snapshot_date")


def lookup_challenge_id(rest: SupabaseRest, account_number: str) -> Optional[str]:
    """Resolve challenge UUID from TV-XXXXXX account number."""
    row = rest.get("challenges", query="id", **{"account_number": account_number})
    return row["id"] if row else None


# ---------------------------------------------------------------------------
# Trade forwarding (to receive-trade edge function)
# ---------------------------------------------------------------------------

def forward_trades(
    session: requests.Session,
    endpoint_url: str,
    api_secret: str,
    account_number: str,
    trades: List[dict],
) -> Tuple[bool, int, int]:
    """
    POST trades to receive-trade. Returns (ok, inserted, skipped).
    Strips internal fields (position_id) before sending.
    """
    clean = []
    for t in trades:
        clean.append({
            "ticket": t["ticket"],
            "symbol": t["symbol"],
            "type": t["type"],
            "lots": t["lots"],
            "open_price": t["open_price"],
            "close_price": t["close_price"],
            "profit": t["profit"],
            "open_time": t["open_time"],
            "close_time": t["close_time"],
        })

    payload = {"account_number": account_number, "trades": clean}

    try:
        resp = session.post(
            endpoint_url,
            json=payload,
            headers={
                "Authorization": f"Bearer {api_secret}",
                "Content-Type": "application/json",
            },
            timeout=HTTP_TIMEOUT,
        )
    except requests.RequestException as exc:
        logger.error("HTTP error for %s: %s", account_number, exc)
        return False, 0, 0

    if resp.status_code in (200, 201):
        data = resp.json()
        return True, data.get("inserted", 0), data.get("skipped", 0)
    else:
        logger.error("%s: HTTP %d — %s", account_number, resp.status_code, resp.text[:400])
        return False, 0, 0


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------

def process_account(
    account_cfg: dict,
    state: Dict[str, dict],
    session: requests.Session,
    rest: SupabaseRest,
    endpoint_url: str,
    api_secret: str,
    lookback_minutes: int,
) -> dict:
    """
    Process one account: connect → snapshot equity → fetch new trades → forward.
    Returns updated state entry for this account.
    """
    account_number = account_cfg["challenge_account_number"]
    login = account_cfg["mt5_login"]
    is_investor = account_cfg.get("is_investor", True)

    entry = state.get(account_number, {})
    last_ticket = entry.get("last_ticket", 0)

    # -- Connect ----------------------------------------------------------------
    if not connect_account(account_cfg):
        return entry

    logger.debug("%s: connected (investor=%s)", account_number, is_investor)

    # -- Equity snapshot --------------------------------------------------------
    snap = get_account_snapshot()
    if snap:
        logger.debug(
            "%s: equity=%.2f balance=%.2f margin=%.2f",
            account_number,
            snap["equity"],
            snap["balance"],
            snap["margin"],
        )
        challenge_id = lookup_challenge_id(rest, account_number)
        if challenge_id:
            # Count existing trades for this challenge to track trade_count
            trade_count = rest.count("trades", **{"challenge_id": f"eq.{challenge_id}"}) if rest else 0
            write_equity_snapshot(
                rest, challenge_id, snap["equity"], snap["balance"], trade_count
            )

    # -- Closed positions -------------------------------------------------------
    lookback = datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)
    trades = get_closed_positions(lookback)

    # Filter to trades newer than last_ticket
    new_trades = [t for t in trades if t["ticket"] > last_ticket]
    new_trades.sort(key=lambda t: t["ticket"])

    if not new_trades:
        logger.debug("%s: no new trades (last_ticket=%d)", account_number, last_ticket)
        return entry

    logger.info(
        "%s: %d new trade(s) — tickets %s",
        account_number,
        len(new_trades),
        [t["ticket"] for t in new_trades],
    )

    ok, inserted, skipped = forward_trades(
        session, endpoint_url, api_secret, account_number, new_trades
    )

    if ok and inserted > 0:
        # Advance the cursor to the highest ticket we just sent
        entry["last_ticket"] = new_trades[-1]["ticket"]

    entry["last_poll"] = datetime.now(timezone.utc).isoformat()
    return entry


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Trivaro MT5 Monitor")
    parser.add_argument(
        "--config", default="config.json",
        help="Path to config file (default: config.json)"
    )
    parser.add_argument(
        "--once", action="store_true",
        help="Run one poll cycle and exit"
    )
    parser.add_argument(
        "--lookback", type=int, default=1440,
        help="Lookback window in minutes for closed positions (default: 1440 = 24h)"
    )
    args = parser.parse_args()

    # Resolve paths relative to script directory
    script_dir = Path(__file__).resolve().parent
    config_path = script_dir / args.config if not os.path.isabs(args.config) else Path(args.config)

    config = load_config(str(config_path))
    setup_logging(config.get("log_file"))

    state_path = str(script_dir / config.get("state_file", "bridge_state.json"))
    state = load_state(state_path)
    logger.info("Loaded state for %d account(s)", len(state))

    # -- MT5 initialisation (loads DLLs; no terminal login needed) --------------
    logger.info("Initialising MT5 runtime...")
    if not mt5.initialize():
        err = mt5.last_error()
        logger.error("mt5.initialize() failed: code=%s", err)
        logger.error(
            "Make sure MetaTrader 5 is installed on this machine "
            "(the terminal provides the DLLs the Python package needs)."
        )
        sys.exit(1)

    logger.info("MT5 runtime ready (version %s)", mt5.version())

    # -- Signal handling --------------------------------------------------------
    running = True

    def handle_signal(signum, frame):
        nonlocal running
        sig_name = signal.Signals(signum).name
        logger.info("Received %s, shutting down...", sig_name)
        running = False

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    # -- Clients -----------------------------------------------------------------
    session = build_session()
    rest = get_supabase(config)
    endpoint_url = config["endpoint_url"]
    api_secret = config["api_secret"]
    interval = config["poll_interval_seconds"]

    if rest is None:
        logger.warning("Supabase REST client unavailable — equity snapshots will be skipped")

    logger.info(
        "Monitoring %d account(s) every %ds (lookback=%dm)",
        len(config["accounts"]),
        interval,
        args.lookback,
    )

    while running:
        cycle_start = datetime.now(timezone.utc)

        for account_cfg in config["accounts"]:
            acct_num = account_cfg["challenge_account_number"]
            try:
                state[acct_num] = process_account(
                    account_cfg, state, session, rest,
                    endpoint_url, api_secret, args.lookback,
                )
            except Exception:
                logger.error(
                    "Unhandled error processing %s:\n%s",
                    acct_num,
                    traceback.format_exc(),
                )

        # Persist state after each full cycle
        save_state(state_path, state)

        if args.once:
            logger.info("--once mode, exiting")
            break

        elapsed = (datetime.now(timezone.utc) - cycle_start).total_seconds()
        sleep_for = max(0, interval - elapsed)
        logger.debug("Cycle took %.1fs, sleeping %.1fs", elapsed, sleep_for)
        time.sleep(sleep_for)

    # Cleanup
    session.close()
    mt5.shutdown()
    save_state(state_path, state)
    logger.info("Monitor stopped, state saved (%d accounts)", len(state))


if __name__ == "__main__":
    main()
