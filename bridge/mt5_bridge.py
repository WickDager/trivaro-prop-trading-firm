"""
Trivaro MT5 Monitor — centralized account monitoring via MT5 investor passwords.

Connects to each client's MT5 account remotely on the broker's server (no client-
side software needed). Polls equity, balance, and closed trades. Writes equity
snapshots directly to Supabase and sends new trades to receive-trade for rule
evaluation.

Works regardless of how the client trades — desktop, mobile, or web terminal.

Requirements:
  - Windows VPS with MetaTrader 5 terminal installed (provides DLLs) and a
    logged-on interactive session — the terminal cannot run in session 0
  - Python 3.10+ with the exact packages pinned in requirements.txt
  - Investor (read-only) password for each MT5 account

Usage:
  python mt5_bridge.py [--config config.json] [--once]

Config keys:
  poll_interval_seconds    Poll cycle length (default 60, clamped 10..300)
  server_utc_offset_hours  Broker server clock offset from UTC (default 0).
                           MT5 returns the server's wall clock as the epoch, so
                           set this (e.g. 3 for a UTC+3 broker) when the server
                           is not on UTC; otherwise trade times and the history
                           query window are shifted by that many hours.
"""

import json
import logging
import logging.handlers
import os
import signal
import sys
import threading
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
# How many consecutive MT5 failures before the runtime is torn down and
# re-initialized (a terminal restart or dropped session otherwise never recovers).
MAX_MT5_FAILURES_BEFORE_RECONNECT = 5

DEAL_ENTRY_IN = 0
DEAL_ENTRY_OUT = 1
DEAL_TYPE_BUY = 0
DEAL_TYPE_SELL = 1

# Consecutive MT5 failures, used to trigger a reconnect from note_mt5_result().
_consecutive_mt5_failures = 0

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
        # The bridge runs 24/7 at DEBUG; a plain FileHandler would grow without
        # bound and eventually fill the VPS disk.
        file_handler = logging.handlers.RotatingFileHandler(
            log_file, maxBytes=10_000_000, backupCount=5, encoding="utf-8"
        )
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

    # Broker server clock offset from UTC. MT5 returns the server's wall clock as
    # the epoch, so a non-zero offset would otherwise shift every trade timestamp
    # and the history query window by that many hours.
    config["server_utc_offset_hours"] = float(config.get("server_utc_offset_hours", 0))

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
    # tmp + os.replace is atomic, which keeps the state file readable if the
    # process dies mid-write. There is no lock file, so two bridge processes
    # pointed at the same state path will fight over these writes — run only
    # one instance per state file.
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
        except requests.RequestException as exc:
            logger.warning("REST GET %s failed: %s", table, exc)
            return None
        if resp.status_code != 200:
            logger.warning("REST GET %s -> HTTP %d: %s", table, resp.status_code, resp.text[:300])
            return None
        try:
            rows = resp.json()
        except ValueError:
            # A captive portal / proxy answers 200 with HTML; JSONDecodeError is
            # not a RequestException, so it used to escape and abort the account
            # cycle (skipping trade forwarding entirely).
            logger.warning("REST GET %s returned a non-JSON body: %s", table, resp.text[:300])
            return None
        return rows[0] if rows else None

    def upsert(self, table: str, row: dict, on_conflict: str = "") -> bool:
        """POST /rest/v1/{table} with Prefer: resolution=merge-duplicates."""
        headers = {}
        params = None
        if on_conflict:
            headers["Prefer"] = "resolution=merge-duplicates"
            # PostgREST resolves merge-duplicates against the PRIMARY KEY unless
            # the conflict target is named. The payload has no `id`, so omitting
            # this made every poll a plain INSERT — ~1440 duplicate rows per
            # account per day on a 60s interval.
            params = {"on_conflict": on_conflict}
        try:
            resp = self.session.post(
                f"{self.base}/{table}",
                json=row,
                headers=headers,
                params=params,
                timeout=HTTP_TIMEOUT,
            )
        except requests.RequestException as exc:
            logger.warning("REST POST %s failed: %s", table, exc)
            return False
        if resp.status_code in (200, 201, 204):
            return True
        logger.warning("REST POST %s -> HTTP %d: %s", table, resp.status_code, resp.text[:300])
        return False

    def count(self, table: str, **filters) -> int:
        """GET /rest/v1/{table}?select=count with filters — returns exact count.

        Callers pass bare values; the "eq." prefix is added here.
        """
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
        except requests.RequestException as exc:
            logger.warning("REST count %s failed: %s", table, exc)
            return 0
        if resp.status_code not in (200, 206):
            # A failed count used to return 0 with no log, making it
            # indistinguishable from a real zero.
            logger.warning("REST count %s -> HTTP %d: %s", table, resp.status_code, resp.text[:300])
            return 0
        content_range = resp.headers.get("content-range", "")
        # "0-0/15" → count is after the /
        parts = content_range.split("/")
        if len(parts) == 2:
            try:
                return int(parts[1])
            except ValueError:
                logger.warning("REST count %s: unparseable Content-Range %r", table, content_range)
                return 0
        logger.warning("REST count %s: missing Content-Range header", table)
        return 0


def get_supabase(config: dict) -> Optional[SupabaseRest]:
    """Build a SupabaseRest client if credentials are configured."""
    url = config.get("supabase_url", "").strip()
    key = config.get("supabase_service_role_key", "").strip()
    if not url or not key:
        logger.warning(
            "supabase_url or supabase_service_role_key not set — equity snapshots "
            "disabled (trade forwarding still runs)"
        )
        return None
    return SupabaseRest(url, key)


# ---------------------------------------------------------------------------
# Account-level MT5 operations
# ---------------------------------------------------------------------------

def mt5_terminal_connected() -> bool:
    """True while the terminal process is alive and its session is up."""
    info = mt5.terminal_info()
    return bool(info is not None and info.connected)


def note_mt5_result(ok: bool) -> None:
    """Track consecutive MT5 failures and re-initialize after too many.

    mt5.initialize() ran exactly once at startup, so a terminal restart or a
    dropped session left every later call failing forever with no recovery path.
    """
    global _consecutive_mt5_failures

    if ok:
        _consecutive_mt5_failures = 0
        return

    _consecutive_mt5_failures += 1
    if _consecutive_mt5_failures < MAX_MT5_FAILURES_BEFORE_RECONNECT:
        return

    logger.warning("MT5 failed %d times in a row — shutting down and re-initializing", _consecutive_mt5_failures)
    _consecutive_mt5_failures = 0
    try:
        mt5.shutdown()
        time.sleep(2)  # let the terminal finish tearing down before re-initializing
        if mt5.initialize():
            logger.info("MT5 re-initialized (version %s)", mt5.version())
        else:
            logger.error("mt5.initialize() failed during reconnect: code=%s", mt5.last_error())
    except Exception:
        logger.error("MT5 reconnect raised:\n%s", traceback.format_exc())


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


def _naive_utc(dt: datetime) -> datetime:
    """Normalize to a naive datetime in UTC (what MT5's API expects)."""
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(timezone.utc).replace(tzinfo=None)


def get_closed_positions(since: datetime, server_utc_offset_hours: float = 0.0) -> List[dict]:
    """
    Fetch positions closed since *since* for the currently-logged-in account.
    Pairs entry + exit deals to produce full trade records.

    *since* is a real-UTC instant. MT5 interprets naive datetimes as UTC, so
    both bounds are built as naive UTC of the broker server's clock. The old
    code used datetime.now() (naive LOCAL) for window_end, which on a VPS behind
    UTC excluded trades that had just closed — notifications fired a cycle late.
    """
    offset = timedelta(hours=server_utc_offset_hours)
    window_start = _naive_utc(since) + offset
    window_end = _naive_utc(datetime.now(timezone.utc)) + offset

    deals_since = mt5.history_deals_get(window_start, window_end)
    if deals_since is None or len(deals_since) == 0:
        return []

    def deal_time(ts: int) -> str:
        # MT5 hands back the broker server's wall clock as the epoch; subtract
        # the server offset so the timestamp is the real UTC instant.
        return datetime.fromtimestamp(ts - server_utc_offset_hours * 3600, tz=timezone.utc).isoformat()

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
            "open_time": deal_time(entry_deal.time),
            "close_time": deal_time(exit_deal.time),
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


def lookup_challenge_id(rest: Optional[SupabaseRest], account_number: str) -> Optional[str]:
    """Resolve challenge UUID from TV-XXXXXX account number."""
    # rest is None when Supabase is not configured. Dereferencing it used to
    # raise AttributeError, which escaped process_account() before
    # forward_trades() — so no trades were forwarded for ANY account while the
    # log claimed only equity snapshots were affected.
    if rest is None:
        return None
    row = rest.get("challenges", query="id", account_number=account_number)
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
        try:
            data = resp.json()
        except ValueError:
            # A proxy/captive portal can answer 2xx with HTML; a JSONDecodeError
            # is not a RequestException and used to abort the whole cycle.
            logger.error("%s: non-JSON response body: %s", account_number, resp.text[:300])
            return False, 0, 0
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
    rest: Optional[SupabaseRest],
    endpoint_url: str,
    api_secret: str,
    lookback_minutes: int,
    server_utc_offset_hours: float = 0.0,
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
    # A dead terminal / dropped session is what triggers the reconnect inside
    # note_mt5_result(); login is still attempted so behaviour is unchanged when
    # terminal_info() is merely stale.
    if not mt5_terminal_connected():
        logger.warning("%s: MT5 terminal reports no session, attempting login anyway", account_number)
        note_mt5_result(False)

    if not connect_account(account_cfg):
        note_mt5_result(False)
        return entry

    note_mt5_result(True)
    logger.debug("%s: connected (investor=%s)", account_number, is_investor)

    # -- Equity snapshot --------------------------------------------------------
    # This whole block is best-effort: an exception here used to escape
    # process_account() and skip trade forwarding for the account entirely.
    try:
        snap = get_account_snapshot()
        if snap is None:
            # account_info() failing means the terminal/session is unhealthy.
            note_mt5_result(False)
        else:
            logger.debug(
                "%s: equity=%.2f balance=%.2f margin=%.2f",
                account_number,
                snap["equity"],
                snap["balance"],
                snap["margin"],
            )
            if rest is None:
                logger.debug("%s: Supabase not configured, snapshot skipped", account_number)
            else:
                challenge_id = lookup_challenge_id(rest, account_number)
                if challenge_id:
                    # count() adds the "eq." prefix itself; passing it here too
                    # produced "challenge_id=eq.eq.<uuid>" → HTTP 400 → count 0.
                    trade_count = rest.count("trades", challenge_id=challenge_id)
                    if not write_equity_snapshot(
                        rest, challenge_id, snap["equity"], snap["balance"], trade_count
                    ):
                        logger.warning("%s: equity snapshot write failed", account_number)
                else:
                    logger.warning(
                        "%s: no challenge row found, snapshot skipped", account_number
                    )
    except Exception:
        logger.error(
            "%s: snapshot step failed (continuing with trades):\n%s",
            account_number,
            traceback.format_exc(),
        )

    # -- Closed positions -------------------------------------------------------
    lookback = datetime.now(timezone.utc) - timedelta(minutes=lookback_minutes)
    trades = get_closed_positions(lookback, server_utc_offset_hours)

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

    if ok:
        # Advance whenever the server accepted the batch — tickets it did not
        # insert were deduplicated server-side, so re-sending them every cycle
        # could never help (it used to POST the same batch forever).
        entry["last_ticket"] = new_trades[-1]["ticket"]
        logger.debug(
            "%s: forwarded %d trade(s) (inserted=%d skipped=%d)",
            account_number,
            len(new_trades),
            inserted,
            skipped,
        )

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
    # Set by SIGINT/SIGTERM so the poll sleep returns immediately; a plain
    # time.sleep() delayed shutdown by up to poll_interval_seconds.
    shutdown = threading.Event()

    def handle_signal(signum, frame):
        nonlocal running
        sig_name = signal.Signals(signum).name
        logger.info("Received %s, shutting down...", sig_name)
        running = False
        shutdown.set()

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    # -- Clients -----------------------------------------------------------------
    session = build_session()
    rest = get_supabase(config)
    endpoint_url = config["endpoint_url"]
    api_secret = config["api_secret"]
    interval = config["poll_interval_seconds"]
    server_utc_offset_hours = config["server_utc_offset_hours"]

    if rest is None:
        logger.warning("Supabase REST client unavailable — equity snapshots will be skipped")

    logger.info(
        "Monitoring %d account(s) every %ds (lookback=%dm, server_utc_offset=%+.1fh)",
        len(config["accounts"]),
        interval,
        args.lookback,
        server_utc_offset_hours,
    )

    while running:
        cycle_start = datetime.now(timezone.utc)

        for account_cfg in config["accounts"]:
            acct_num = account_cfg["challenge_account_number"]
            try:
                state[acct_num] = process_account(
                    account_cfg, state, session, rest,
                    endpoint_url, api_secret, args.lookback,
                    server_utc_offset_hours,
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
        shutdown.wait(sleep_for)

    # Cleanup
    session.close()
    mt5.shutdown()
    save_state(state_path, state)
    logger.info("Monitor stopped, state saved (%d accounts)", len(state))


if __name__ == "__main__":
    main()
