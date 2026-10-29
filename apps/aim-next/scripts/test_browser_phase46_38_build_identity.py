"""Pure file-integrity unit tests; no claim of a real React build."""
from __future__ import annotations
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

folder = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('buildverify', folder / 'verify-phase46-38-build-identity.py')
verify_mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify_mod)
from phase46_38_build_identity import build_identity


class BuildIdentityTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.dist = self.root / 'dist'
        (self.dist / 'assets').mkdir(parents=True)
        (self.dist / 'index.html').write_text('<div id="root"></div><script type="module" src="/assets/main-abc.js"></script>')
        (self.dist / 'assets/main-abc.js').write_text('console.log("app")')
        self.evidence = self.root / 'evidence'
        self.evidence.mkdir()
        self.refresh()
    def tearDown(self):
        self.tmp.cleanup()
    def refresh(self):
        digest, count = build_identity(self.dist)
        self.data = {'evidenceType':'MOUNTED_REACT_APP','syntheticScreenshot':False,
                     'engineeringApproval':False,'buildSha256':digest,'buildFileCount':count}
        self.save()
    def save(self):
        (self.evidence / 'evidence.json').write_text(json.dumps(self.data))
    def test_pass_current_dist(self):
        self.assertTrue(verify_mod.verify(self.evidence, self.dist)['verified'])
    def test_reject_modified_js(self):
        (self.dist / 'assets/main-abc.js').write_text('console.log("other")')
        with self.assertRaisesRegex(ValueError, 'not bound'):
            verify_mod.verify(self.evidence, self.dist)
    def test_reject_added_chunk(self):
        (self.dist / 'assets/lazy.js').write_text('export default 1')
        with self.assertRaisesRegex(ValueError, 'not bound'):
            verify_mod.verify(self.evidence, self.dist)
    def test_reject_missing_js(self):
        (self.dist / 'assets/main-abc.js').unlink()
        with self.assertRaisesRegex(ValueError, 'JavaScript asset'):
            verify_mod.verify(self.evidence, self.dist)
    def test_reject_missing_identity(self):
        self.data.pop('buildSha256'); self.save()
        with self.assertRaisesRegex(ValueError, 'identity'):
            verify_mod.verify(self.evidence, self.dist)
    def test_reject_synthetic_evidence(self):
        self.data['syntheticScreenshot']=True; self.save()
        with self.assertRaisesRegex(ValueError, 'non-synthetic'):
            verify_mod.verify(self.evidence, self.dist)
    def test_reject_symlinked_assets(self):
        (self.dist / 'assets/escape.js').symlink_to(self.dist / 'assets/main-abc.js')
        with self.assertRaisesRegex(ValueError, 'symlinks'):
            verify_mod.verify(self.evidence, self.dist)
    def test_reject_empty_asset(self):
        (self.dist / 'assets/main-abc.js').write_text('')
        with self.assertRaisesRegex(ValueError, 'Empty'):
            verify_mod.verify(self.evidence, self.dist)
    def test_digest_invariant_under_file_creation_order(self):
        orig, _=build_identity(self.dist)
        value=(self.dist / 'assets/main-abc.js').read_bytes()
        (self.dist / 'assets/main-abc.js').unlink()
        (self.dist / 'assets/main-abc.js').write_bytes(value)
        actual,_=build_identity(self.dist)
        self.assertEqual(orig,actual)
    def test_reject_implied_approval(self):
        self.data['engineeringApproval']=True; self.save()
        with self.assertRaisesRegex(ValueError, 'approval'):
            verify_mod.verify(self.evidence,self.dist)

if __name__ == '__main__': unittest.main()
