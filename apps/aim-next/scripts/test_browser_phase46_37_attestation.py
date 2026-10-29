"""Offline unit tests of evidence integrity, NOT tests of actual React screenshots."""
from datetime import datetime, timezone, timedelta
from pathlib import Path
import importlib.util, json, tempfile, unittest, zlib, struct
from hashlib import sha256

mod=Path(__file__).with_name('verify-phase46-37-mounted-evidence.py')
spec=importlib.util.spec_from_file_location('attestation',mod)
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)


def png(w,h):
    def chunk(typ,data):
        return struct.pack('>I',len(data))+typ+data+struct.pack('>I',zlib.crc32(typ+data)&0xffffffff)
    # One actual PNG image (not a genuine app screenshot), for verifier tests only.
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',w,h,8,2,0,0,0))+chunk(b'IDAT',zlib.compress((b'\x00'+b'\xff\xff\xff'*w)*h))+chunk(b'IEND',b'')

class EvidenceContract(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.folder=Path(self.temp.name)
        self.clock=datetime(2026,10,30,0,0,tzinfo=timezone.utc)
        shots=[]
        for name,w,h in zip(a.EXPECTED_NAMES,a.EXPECTED_WIDTHS,a.EXPECTED_HEIGHTS):
            filename=f'phase46-36-{name}.png';blob=png(w,h)
            (self.folder/filename).write_bytes(blob)
            shots.append({'name':name,'path':filename,'width':w,'height':h,
                          'sha256':sha256(blob).hexdigest(),'tokenVerified':True,'noHorizontalOverflow':True})
        self.doc={'evidenceType':'MOUNTED_REACT_APP','syntheticScreenshot':False,
                  'engineeringApproval':False,'sourceRecords':'DISCONNECTED_NO_FIXTURE',
                  'javascriptErrors':[],'baseUrl':'http://127.0.0.1:4174',
                  'timestampUtc':self.clock.isoformat(),'screenshots':shots}
        self.save()
    def tearDown(self):self.temp.cleanup()
    def save(self):(self.folder/'evidence.json').write_text(json.dumps(self.doc))
    def checked(self):return a.verify(self.folder,now=self.clock)
    def test_verified_structure(self):self.assertEqual(self.checked()['screenshots'],4)
    def test_rejects_stale_evidence(self):
        self.doc['timestampUtc']=(self.clock-timedelta(days=1)).isoformat();self.save()
        with self.assertRaisesRegex(ValueError,'stale'):self.checked()
    def test_rejects_partial_capture(self):
        self.doc['screenshots'].pop();self.save()
        with self.assertRaisesRegex(ValueError,'four'):self.checked()
    def test_rejects_wrong_hash(self):
        self.doc['screenshots'][0]['sha256']='0'*64;self.save()
        with self.assertRaisesRegex(ValueError,'digest'):self.checked()
    def test_rejects_disguised_synthetic(self):
        self.doc['syntheticScreenshot']=True;self.save()
        with self.assertRaisesRegex(ValueError,'synthetic'):self.checked()
    def test_rejects_wrong_png_dimensions(self):
        target=self.folder/'phase46-36-mobile-home.png';blob=png(391,844);target.write_bytes(blob)
        self.doc['screenshots'][2]['sha256']=sha256(blob).hexdigest();self.save()
        with self.assertRaisesRegex(ValueError,'dimensions'):self.checked()
    def test_rejects_path_traversal(self):
        self.doc['screenshots'][0]['path']='../phase46-36-desktop-home.png';self.save()
        with self.assertRaisesRegex(ValueError,'Expected screenshot'):self.checked()

if __name__=='__main__':unittest.main()
