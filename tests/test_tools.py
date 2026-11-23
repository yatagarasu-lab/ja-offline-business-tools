import unittest

from check_mac_local_ai_env import detect_mac_specs
from check_mcp_server import diagnose_mcp_stdio_server
from ec_margin_gmroi import calculate_ec_metrics
from invoice_2026_check import estimate_oct2026_deduction_delta, verify_corporate_t_number
from pii_redactor import redact_text, restore_text


class TestOfflineBusinessTools(unittest.TestCase):
    def test_mac_local_ai_env_diagnostic(self) -> None:
        rep = detect_mac_specs()
        self.assertIn(rep["os"], ("Darwin", "Linux", "Windows"))
        self.assertIn("packages_installed", rep)
        self.assertIn("recommended_llm", rep)

    def test_mcp_doctor_rejects_non_json_pollution(self) -> None:
        import sys
        res = diagnose_mcp_stdio_server(
            [sys.executable, "-c", "print('NOT_JSON_POLLUTION')"],
            timeout_sec=2.0,
        )
        self.assertFalse(res["ok"])
        self.assertGreaterEqual(res["stdout_pollution_count"], 1)

    def test_ec_margin_and_gmroi(self) -> None:
        res = calculate_ec_metrics(price_yen=5480, cost_yen=2400, shipping_yen=530, platform="mercari", expected_sell_days=10)
        self.assertEqual(res["pass_strict_gate"], True)
        self.assertGreater(int(res["net_profit_yen"]), 1800)

    def test_pii_redact_and_restore(self) -> None:
        src = "Contact: alice@example.org / 090-1234-5678 / key sk_live_abcdefghijklmn"
        masked, mapping = redact_text(src)
        self.assertNotIn("alice@example.org", masked)
        self.assertNotIn("090-1234-5678", masked)
        self.assertNotIn("sk_live_abcdefghijklmn", masked)
        self.assertEqual(restore_text(masked, mapping), src)

    def test_invoice_2026_delta_and_t_number(self) -> None:
        est = estimate_oct2026_deduction_delta(amount_incl_tax_yen=110000, count=10)
        self.assertEqual(est["additional_tax_burden_yen"], 10000)
        # NTA National Tax Agency corporate number 7000012050002 -> check digit 7
        chk = verify_corporate_t_number("T7000012050002")
        self.assertTrue(chk["valid_format"])
        self.assertTrue(chk["check_digit_ok"])


if __name__ == "__main__":
    unittest.main()
