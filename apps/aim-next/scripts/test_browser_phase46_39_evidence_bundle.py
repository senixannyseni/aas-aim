"""Synthetic-file-only tests for the *collector*, not mounted React evidence."""
from __future__ import annotations
from datetime import datetime, timezone
import importlib.util
import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from zipfile import ZipFile

COLLECTOR = Path(__file__).resolve().parents[3] / 'scripts' / 'phase46-39-collect-evidence.py'
spec = importlib.util.spec_from_file_location('phase46_39_collector', COLLECTOR)
collector = importlib.util.module_from_spec(spec)
assert spec and spec.loader
spec.loader.exec_module(collector)


class EvidenceCollectorTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        (self.root / 'qa/runtime').mkdir(parents=True)
        self.log = self.root / 'run.log'
        self.log.write_text('simulated unavailable toolchain\n')
        self.out = self.root / 'qa/runtime/AAS-AIM-Runtime-Evidence.zip'

    def _trace(self, status):
        (self.root / 'qa/runtime/phase32-release-gates.json').write_text(json.dumps({
            'status': status, 'passedGates': ['offline_evidence_unit_tests'],
            'releaseApproved': False
        }))

    def test_failed_run_is_packaged_without_screenshots(self):
        self._trace('FAILED')
        result = collector.collect(self.root, self.log, self.out, 1)
        self.assertEqual(result['status'], 'FAILED_OR_INCOMPLETE')
        with ZipFile(self.out) as z:
            self.assertIsNone(z.testzip())
            self.assertIn('release-validation.log', z.namelist())
            self.assertIn('release-gates.json', z.namelist())
            self.assertNotIn('mounted-visuals/evidence.json', z.namelist())
            self.assertEqual(len(result['missingExpectedFiles']), 5)

    def test_zero_exit_alone_is_not_a_verified_release(self):
        self._trace('IN_PROGRESS')
        result = collector.collect(self.root, self.log, self.out, 0)
        self.assertEqual(result['status'], 'FAILED_OR_INCOMPLETE')

    def test_complete_trace_without_screenshots_is_not_a_verified_release(self):
        self._trace('RUNTIME_GATES_PASSED_AWAITING_REVIEW')
        result = collector.collect(self.root, self.log, self.out, 0)
        self.assertEqual(result['status'], 'FAILED_OR_INCOMPLETE')

    def test_complete_proof_requires_all_expected_files(self):
        self._trace('RUNTIME_GATES_PASSED_AWAITING_REVIEW')
        evidence = self.root / 'qa/runtime/phase46-36-mounted-visuals'
        evidence.mkdir()
        (evidence/'evidence.json').write_text('{"evidenceType":"MOUNTED_REACT_APP"}')
        for name in collector.SCREEN_NAMES:
            (evidence/f'phase46-36-{name}.png').write_bytes(b'SYNTHETIC TEST BYTES')
        result = collector.collect(self.root, self.log, self.out, 0)
        self.assertEqual(result['status'], 'RUNTIME_COMPLETED_AWAITING_REVIEW')
        with ZipFile(self.out) as z:
            self.assertEqual(len(z.namelist()), 8)
            report = json.loads(z.read('summary.json'))
            self.assertEqual(report['imageProvenance'], 'Only existing mounted-app screenshot bytes, never synthesized')
            # The collector does not validate pictures; the prior independent gate must.

    def test_repeated_run_replaces_existing_zip(self):
        self._trace('FAILED')
        collector.collect(self.root, self.log, self.out, 1)
        old = self.out.read_bytes()
        self.log.write_text('different log contents\n')
        collector.collect(self.root, self.log, self.out, 1)
        with ZipFile(self.out) as z:
            self.assertEqual(z.read('release-validation.log'), b'different log contents\n')
            self.assertEqual(z.namelist().count('release-validation.log'), 1)
        self.assertNotEqual(old, self.out.read_bytes())

    def test_reject_visual_evidence_symlink(self):
        self._trace('FAILED')
        (self.root/'qa/runtime/phase46-36-mounted-visuals').symlink_to(self.root, target_is_directory=True)
        with self.assertRaisesRegex(ValueError, 'symlink'):
            collector.collect(self.root, self.log, self.out, 1)

    def test_never_collect_private_application_files(self):
        self._trace('FAILED')
        (self.root/'.env').write_text('PASSWORD=not-for-sharing')
        (self.root/'client-secret.json').write_text('private')
        collector.collect(self.root, self.log, self.out, 1)
        with ZipFile(self.out) as z:
            self.assertFalse(any('.env' in n or 'secret' in n for n in z.namelist()))
            self.assertNotIn(b'PASSWORD=', b''.join(z.read(n) for n in z.namelist()))

    def test_oversized_log_refused(self):
        self.log.write_bytes(b'x' * (collector.MAX_LOG + 1))
        with self.assertRaisesRegex(ValueError, '12 MiB'):
            collector.collect(self.root, self.log, self.out, 1)


if __name__ == '__main__':
    unittest.main()
