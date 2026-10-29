"""Offline regression tests for the strict mounted journey's expectations."""
import unittest
import re
from pathlib import Path
from browser_journey_contract import SCREEN_TITLES, is_unauthorized_api_request


class Phase4610BrowserJourneyContract(unittest.TestCase):
    def test_frozen_workspace_identifiers_and_titles(self):
        self.assertEqual(len(SCREEN_TITLES), 3)
        registry = (Path(__file__).resolve().parents[1] / 'src' / 'screenRegistry.ts').read_text()
        for screen_id, expected_title in SCREEN_TITLES.items():
            with self.subTest(screen_id=screen_id):
                match = re.search(r'\["' + re.escape(screen_id) + r'","([^"]+)"', registry)
                self.assertIsNotNone(match, 'Canonical screen absent from registry')
                self.assertEqual(match.group(1), expected_title)

    def test_same_origin_api_is_rejected(self):
        base = 'http://127.0.0.1:4174'
        for url in [base + '/api', base + '/api/v1/assets', base + '/api/v1?q=1']:
            with self.subTest(url=url):
                self.assertTrue(is_unauthorized_api_request(url, base))

    def test_static_and_external_requests_are_not_misclassified(self):
        base = 'http://127.0.0.1:4174'
        for url in [base + '/assets/index.js', base + '/apiary', base + '/foo/api/v1',
                    'https://fonts.googleapis.com/css', 'https://other.invalid/api/v1/assets']:
            with self.subTest(url=url):
                self.assertFalse(is_unauthorized_api_request(url, base))

    def test_host_and_port_must_match(self):
        base = 'http://127.0.0.1:4174'
        self.assertFalse(is_unauthorized_api_request('http://127.0.0.1:4173/api',base))
        self.assertFalse(is_unauthorized_api_request('https://127.0.0.1:4174/api',base))


if __name__ == '__main__':
    unittest.main()
