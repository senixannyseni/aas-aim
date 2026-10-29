"""Offline coverage for the mounted proof validator; does not claim browser execution."""
import importlib.util
import unittest
import subprocess
import sys
from pathlib import Path

MODULE = Path(__file__).with_name('browser-phase46-36-visual-proof.py')
spec = importlib.util.spec_from_file_location('visual_proof', MODULE)
proof = importlib.util.module_from_spec(spec)
spec.loader.exec_module(proof)


class ProofContract(unittest.TestCase):
    def test_offline_import_does_not_require_playwright(self):
        # -S disables site packages even if the developer has Playwright
        # installed. The offline gate must remain independent of it.
        probe = f"""import importlib.util
import sys
from pathlib import Path
path = Path({str(MODULE)!r})
sys.path.insert(0, str(path.parent))
spec = importlib.util.spec_from_file_location('offline_visual_proof', path)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.EXPECTED['--bandha-v18-deep'] == '#101b1d'
"""
        result = subprocess.run([sys.executable, '-S', '-c', probe],
                                capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def test_has_exact_documented_colors(self):
        proof.check_tokens(dict(proof.EXPECTED))
        self.assertEqual(proof.EXPECTED['--bandha-v18-deep'], '#101b1d')
        self.assertEqual(proof.EXPECTED['--bandha-v18-paper'], '#eee9df')

    def test_rejects_color_drifts(self):
        wrong = dict(proof.EXPECTED)
        wrong['--bandha-v18-deep'] = '#30251f'
        with self.assertRaisesRegex(AssertionError, 'token'):
            proof.check_tokens(wrong)

    def test_detects_real_horizontal_overflow(self):
        proof.assert_no_overflow({'scroll': 391, 'viewport': 390}, 'mobile')
        with self.assertRaisesRegex(AssertionError, 'overflow'):
            proof.assert_no_overflow({'scroll': 403, 'viewport': 390}, 'mobile')

    def test_all_expected_viewports_and_routes(self):
        self.assertEqual(len(proof.SHOTS), 4)
        self.assertEqual({shot[1] for shot in proof.SHOTS}, {390, 1440})
        self.assertEqual(sum(bool(shot[3]) for shot in proof.SHOTS), 2)


if __name__ == '__main__':
    unittest.main()
