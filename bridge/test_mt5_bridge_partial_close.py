"""Regression tests for partial-close aggregation in the MT5 bridge.

A position closed in several deals used to be reported with only the final
partial's profit and volume. `pair_position_deals` sums every deal and rejects
a position that is still partially open (which would otherwise be counted again
when the remainder closes).
"""

import sys
import types
import unittest
from types import SimpleNamespace
from unittest.mock import patch

# MetaTrader5 only exists on the Windows VPS (it ships the terminal DLLs). The
# module under test calls sys.exit(1) when it is missing, so stub it for the
# import — the pairing logic below never touches the MT5 API.
with patch.dict(sys.modules, {"MetaTrader5": types.ModuleType("MetaTrader5")}):
    from bridge.mt5_bridge import (
        DEAL_ENTRY_IN,
        DEAL_ENTRY_OUT,
        DEAL_TYPE_BUY,
        DEAL_TYPE_SELL,
        pair_position_deals,
    )


def make_deal(
    entry,
    volume,
    price,
    profit,
    ticket,
    timestamp,
    type_=DEAL_TYPE_BUY,
    symbol="EURUSD",
    position_id=777,
):
    return SimpleNamespace(
        entry=entry,
        volume=volume,
        price=price,
        profit=profit,
        ticket=ticket,
        time=timestamp,
        type=type_,
        symbol=symbol,
        position_id=position_id,
    )


def fake_deal_time(ts):
    return f"t{ts}"


class PartialCloseTests(unittest.TestCase):
    def test_single_close_is_unchanged(self):
        deals = [
            make_deal(DEAL_ENTRY_IN, 1.0, 1.1000, 0.0, 1, 100),
            make_deal(DEAL_ENTRY_OUT, 1.0, 1.1050, 50.0, 2, 200),
        ]
        trade = pair_position_deals(deals, fake_deal_time)
        self.assertIsNotNone(trade)
        self.assertEqual(trade["profit"], 50.0)
        self.assertEqual(trade["lots"], 1.0)
        self.assertAlmostEqual(trade["open_price"], 1.1000)
        self.assertAlmostEqual(trade["close_price"], 1.1050)
        self.assertEqual(trade["ticket"], 2)
        self.assertEqual(trade["type"], "buy")

    def test_partial_closes_are_summed_and_volume_weighted(self):
        deals = [
            make_deal(DEAL_ENTRY_IN, 2.0, 1.1000, 0.0, 1, 100),
            make_deal(DEAL_ENTRY_OUT, 1.0, 1.1050, 30.0, 2, 200),
            make_deal(DEAL_ENTRY_OUT, 1.0, 1.1090, 40.0, 3, 300),
        ]
        trade = pair_position_deals(deals, fake_deal_time)
        self.assertIsNotNone(trade)
        # Was 40.0 — only the final partial's profit.
        self.assertEqual(trade["profit"], 70.0)
        self.assertEqual(trade["lots"], 2.0)
        self.assertAlmostEqual(trade["close_price"], (1.1050 + 1.1090) / 2)
        self.assertEqual(trade["ticket"], 3)

    def test_still_open_position_is_not_reported(self):
        deals = [
            make_deal(DEAL_ENTRY_IN, 2.0, 1.1000, 0.0, 1, 100),
            make_deal(DEAL_ENTRY_OUT, 1.0, 1.1050, 30.0, 2, 200),
        ]
        self.assertIsNone(pair_position_deals(deals, fake_deal_time))

    def test_sell_position_direction_is_preserved(self):
        deals = [
            make_deal(DEAL_ENTRY_IN, 1.0, 1.1000, 0.0, 1, 100, type_=DEAL_TYPE_SELL),
            make_deal(DEAL_ENTRY_OUT, 1.0, 1.0950, 50.0, 2, 200, type_=DEAL_TYPE_SELL),
        ]
        trade = pair_position_deals(deals, fake_deal_time)
        self.assertIsNotNone(trade)
        self.assertEqual(trade["type"], "sell")

    def test_missing_entry_or_exit_is_skipped(self):
        self.assertIsNone(
            pair_position_deals([make_deal(DEAL_ENTRY_IN, 1.0, 1.1, 0.0, 1, 100)], fake_deal_time)
        )
        self.assertIsNone(
            pair_position_deals([make_deal(DEAL_ENTRY_OUT, 1.0, 1.1, 5.0, 2, 200)], fake_deal_time)
        )


if __name__ == "__main__":
    unittest.main()
