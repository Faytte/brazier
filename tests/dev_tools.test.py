"""Launcher regression tests use synthetic archives, never a real license."""
import importlib.util
import json
from pathlib import Path
import stat
import tempfile
import unittest
import zipfile

path=Path(__file__).resolve().parents[1]/'tools/foundry_dev.py'
spec=importlib.util.spec_from_file_location('foundry_dev',path)
dev=importlib.util.module_from_spec(spec);spec.loader.exec_module(dev)

class DevelopmentInstallTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name);self.home=self.root/'private'
    def tearDown(self): self.temp.cleanup()
    def archive(self,name,entries):
        p=self.root/name
        with zipfile.ZipFile(p,'w') as z:
            for entry,value in entries:z.writestr(entry,value)
        return p
    def test_status_does_not_create_directories(self):
        self.assertFalse(dev.status(self.home)['runtimePresent']);self.assertFalse(self.home.exists())
    def test_refuses_existing_unmarked_data(self):
        self.home.mkdir();(self.home/'campaign').write_text('preserve')
        with self.assertRaisesRegex(ValueError,'nonempty'):dev.initialize(self.home)
        self.assertEqual((self.home/'campaign').read_text(),'preserve')
    def test_install_and_live_source_link(self):
        archive=self.archive('server.zip',[('main.js','// vendor fixture'),('package.json','{}')])
        main=dev.install(self.home,archive)
        self.assertTrue(main.is_file());self.assertTrue(dev.status(self.home)['runtimePresent'])
        self.assertTrue(dev.status(self.home)['sourceLinked'])
        self.assertEqual((self.home/'userdata/Data/modules/brazier').resolve(),dev.ROOT)
        with self.assertRaisesRegex(ValueError,'not empty'):dev.install(self.home,archive)
    def test_safe_relative_vendor_bin_symlink(self):
        link=zipfile.ZipInfo('node_modules/.bin/example');link.create_system=3;link.external_attr=(stat.S_IFLNK|0o777)<<16
        archive=self.archive('server.zip',[('main.js',''),('node_modules/example/cli.js',''),(link,'../example/cli.js')])
        dev.install(self.home,archive)
        self.assertTrue((self.home/'server/node_modules/.bin/example').is_symlink())
    def test_path_traversal_rejected(self):
        archive=self.archive('bad.zip',[('../escape','bad'),('main.js','')])
        with self.assertRaisesRegex(ValueError,'Unsafe'):dev.install(self.home,archive)
        self.assertFalse((self.home/'escape').exists())
    def test_escaping_symlink_rejected(self):
        link=zipfile.ZipInfo('escape');link.create_system=3;link.external_attr=(stat.S_IFLNK|0o777)<<16
        archive=self.archive('bad.zip',[('main.js',''),(link,'../../outside')])
        with self.assertRaisesRegex(ValueError,'escapes'):dev.install(self.home,archive)
    def test_install_package_and_refuse_overwrite(self):
        archive=self.archive('package.zip',[('sample/module.json',json.dumps({'id':'sample','version':'1.0'})),('sample/script.mjs','')])
        result=dev.install_package(self.home,archive,'module','sample')
        self.assertEqual(result['version'],'1.0')
        self.assertTrue((Path(result['path'])/'script.mjs').is_file())
        with self.assertRaisesRegex(ValueError,'not be overwritten'):dev.install_package(self.home,archive,'module','sample')
    def test_wrong_package_id_rejected(self):
        archive=self.archive('package.zip',[('module.json',json.dumps({'id':'other'}))])
        with self.assertRaisesRegex(ValueError,'does not match'):dev.install_package(self.home,archive,'module','sample')

    def test_existing_module_directory_preserved(self):
        dev.initialize(self.home);p=self.home/'userdata/Data/modules/brazier';p.mkdir(parents=True)
        with self.assertRaisesRegex(ValueError,'not be overwritten'):dev.link_source(self.home)

if __name__=='__main__': unittest.main()
