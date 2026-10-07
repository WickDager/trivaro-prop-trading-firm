import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

with patch.dict(sys.modules, {"MetaTrader5": types.ModuleType("MetaTrader5")}):
    from bridge.mt5_bridge import load_config


class BridgeConfigSecurityTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_path = Path(self.temp_dir.name) / "config.json"
        self.config = {
            "endpoint_url": "https://project.supabase.co/functions/v1/receive-trade",
            "supabase_url": "https://project.supabase.co",
            "accounts": [{"challenge_account_number": "test", "mt5_login": 0}],
            "api_secret": "legacy-config-secret",
            "supabase_service_role_key": "legacy-config-key",
        }
        self.write_config()

    def tearDown(self):
        self.temp_dir.cleanup()

    def write_config(self):
        self.config_path.write_text(json.dumps(self.config), encoding="utf-8")

    def test_secrets_are_read_from_environment(self):
        with patch.dict(
            os.environ,
            {
                "MT5_API_SECRET": "environment-secret",
                "SUPABASE_SERVICE_ROLE_KEY": "environment-key",
            },
        ):
            config = load_config(str(self.config_path))

        self.assertEqual(config["api_secret"], "environment-secret")
        self.assertEqual(config["supabase_service_role_key"], "environment-key")

    def test_missing_environment_secrets_fail_closed(self):
        with patch.dict(
            os.environ,
            {"MT5_API_SECRET": "", "SUPABASE_SERVICE_ROLE_KEY": ""},
        ):
            with self.assertRaisesRegex(ValueError, "Set MT5_API_SECRET"):
                load_config(str(self.config_path))

    def test_non_https_endpoint_is_rejected(self):
        self.config["endpoint_url"] = "http://project.supabase.co/functions/v1/receive-trade"
        self.write_config()

        with patch.dict(
            os.environ,
            {
                "MT5_API_SECRET": "environment-secret",
                "SUPABASE_SERVICE_ROLE_KEY": "environment-key",
            },
        ):
            with self.assertRaisesRegex(ValueError, "same HTTPS host"):
                load_config(str(self.config_path))

    def test_different_endpoint_host_is_rejected(self):
        self.config["endpoint_url"] = "https://attacker.example/receive-trade"
        self.write_config()

        with patch.dict(
            os.environ,
            {
                "MT5_API_SECRET": "environment-secret",
                "SUPABASE_SERVICE_ROLE_KEY": "environment-key",
            },
        ):
            with self.assertRaisesRegex(ValueError, "same HTTPS host"):
                load_config(str(self.config_path))


if __name__ == "__main__":
    unittest.main()