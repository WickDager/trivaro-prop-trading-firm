import json
import os
import sys
import tempfile
import types
import unittest
from pathlib import Path
from unittest.mock import patch

with patch.dict(sys.modules, {"MetaTrader5": types.ModuleType("MetaTrader5")}):
    from bridge.mt5_bridge import SupabaseRest, load_config


class BridgeConfigSecurityTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.config_path = Path(self.temp_dir.name) / "config.json"
        self.config = {
            "endpoint_url": "https://project.supabase.co/functions/v1/receive-trade",
            "supabase_url": "https://project.supabase.co",
            "accounts": [{"challenge_account_number": "test", "mt5_login": 0}],
            "api_secret": "legacy-config-secret",
            # A legacy key sitting in the config file must NOT be able to
            # substitute for a valid SUPABASE_SECRET_KEY from the environment.
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
                "SUPABASE_SECRET_KEY": "sb_secret_environment-key",
            },
        ):
            config = load_config(str(self.config_path))

        self.assertEqual(config["api_secret"], "environment-secret")
        self.assertEqual(config["supabase_secret_key"], "sb_secret_environment-key")

    def test_missing_environment_secrets_fail_closed(self):
        with patch.dict(
            os.environ,
            {"MT5_API_SECRET": "", "SUPABASE_SECRET_KEY": ""},
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
                "SUPABASE_SECRET_KEY": "sb_secret_environment-key",
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
                "SUPABASE_SECRET_KEY": "sb_secret_environment-key",
            },
        ):
            with self.assertRaisesRegex(ValueError, "same HTTPS host"):
                load_config(str(self.config_path))

    def test_legacy_service_role_jwt_is_rejected(self):
        """A legacy service_role JWT must be refused, not sent and rejected remotely."""
        legacy_jwt = "eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.signature"
        with patch.dict(
            os.environ,
            {"MT5_API_SECRET": "environment-secret", "SUPABASE_SECRET_KEY": legacy_jwt},
        ):
            with self.assertRaisesRegex(ValueError, "must be an sb_secret_"):
                load_config(str(self.config_path))

    def test_config_file_legacy_key_cannot_substitute_for_env(self):
        """config.json's supabase_service_role_key is ignored; env is the only source."""
        with patch.dict(
            os.environ,
            {"MT5_API_SECRET": "environment-secret", "SUPABASE_SECRET_KEY": ""},
        ):
            with self.assertRaisesRegex(ValueError, "Set MT5_API_SECRET"):
                load_config(str(self.config_path))

    def test_rest_client_refuses_a_legacy_key(self):
        """The client that puts the key on the wire refuses a legacy key too."""
        with self.assertRaisesRegex(ValueError, "must be an sb_secret_"):
            SupabaseRest("https://project.supabase.co", "legacy-config-key")

    def test_supabase_secret_is_not_sent_as_bearer_jwt(self):
        client = SupabaseRest("https://project.supabase.co", "sb_secret_test")
        try:
            self.assertEqual(client.session.headers["apikey"], "sb_secret_test")
            self.assertNotIn("Authorization", client.session.headers)
        finally:
            client.session.close()


if __name__ == "__main__":
    unittest.main()