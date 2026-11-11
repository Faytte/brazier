"""Private, source-linked Foundry development install. No license material in the repo."""
from __future__ import annotations
import argparse
import json
import os
from pathlib import Path
import shutil
import stat
import tempfile
import re
import subprocess
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_HOME = ROOT.parent / '.brazier-native'
MARKER = 'brazier-local-development-v1'

def layout(home):
    return home/'server', home/'userdata', home/'browser'

def initialize(home):
    marker = home/'.brazier-development'
    if home.exists() and any(home.iterdir()) and (not marker.is_file() or marker.read_text()!=MARKER):
        raise ValueError('Refusing to use a nonempty directory without the Brazier development marker.')
    home.mkdir(parents=True, exist_ok=True)
    marker.write_text(MARKER)
    if os.name != 'nt': home.chmod(0o700)
    for path in layout(home): path.mkdir(exist_ok=True)
    return layout(home)

def link_source(home):
    _,data,_ = initialize(home)
    target=data/'Data/modules/brazier'
    target.parent.mkdir(parents=True, exist_ok=True)
    if target.is_symlink():
        if target.resolve()!=ROOT: raise ValueError('Existing Brazier link points to another checkout.')
    elif target.exists(): raise ValueError('Existing Brazier directory will not be overwritten.')
    else: target.symlink_to(ROOT, target_is_directory=True)
    return target

def extract_archive(archive,destination):
    with zipfile.ZipFile(archive) as z:
        total=0
        links={info.filename for info in z.infolist() if stat.S_ISLNK(info.external_attr>>16)}
        for info in z.infolist():
            dest=(destination/info.filename).resolve()
            if not dest.is_relative_to(destination.resolve()) or "\\" in info.filename or any(str(parent) in links for parent in Path(info.filename).parents):
                raise ValueError('Unsafe path in destination archive.')
            if info.filename in links:
                target=z.read(info).decode('utf-8')
                if not (dest.parent/target).resolve().is_relative_to(destination.resolve()):
                    raise ValueError('Archive symlink escapes the destination directory.')
            total+=info.file_size
            if total>4*1024**3: raise ValueError('Server archive exceeds 4 GiB expanded size.')
        for info in z.infolist():
            if info.filename in links: continue
            z.extract(info,destination)
            if not info.is_dir() and info.external_attr>>16:
                (destination/info.filename).chmod(stat.S_IMODE(info.external_attr>>16))
        for name in links:
            dest=destination/name;dest.parent.mkdir(parents=True,exist_ok=True)
            dest.symlink_to(z.read(name).decode('utf-8'))

def install(home, archive):
    server,_,_=initialize(home)
    if any(server.iterdir()): raise ValueError('Server directory is not empty. Use a fresh development directory for another Foundry version.')
    archive=archive.resolve()
    extract_archive(archive,server)
    candidates=[p for p in [server/'main.js',server/'resources/app/main.js',*server.glob('*/main.js')] if p.is_file()]
    if len(candidates)!=1: raise ValueError('Could not identify one Foundry Node.js main.js. Keep the archive for inspection.')
    entry=candidates[0]
    (home/'runtime.json').write_text(json.dumps({'entry':str(entry)},indent=2)+'\n')
    link_source(home)
    return entry

def install_package(home, archive, kind, package_id):
    if not re.fullmatch(r'[a-z0-9][a-z0-9_-]*',package_id): raise ValueError('Invalid package ID.')
    _,data,_=initialize(home)
    target=data/'Data'/('systems' if kind=='system' else 'modules')/package_id
    if target.exists() or target.is_symlink(): raise ValueError('Existing package will not be overwritten.')
    manifest='system.json' if kind=='system' else 'module.json'
    with tempfile.TemporaryDirectory(dir=home,prefix='package-') as temp:
        stage=Path(temp);extract_archive(archive.resolve(),stage)
        candidates=[p for p in [stage/manifest,*stage.glob('*/'+manifest)] if p.is_file()]
        if len(candidates)!=1: raise ValueError('Expected one package manifest at archive root or one enclosing directory.')
        metadata=json.loads(candidates[0].read_text())
        if metadata.get('id')!=package_id: raise ValueError('Manifest ID does not match requested package.')
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.move(str(candidates[0].parent),target)
    return {'id':package_id,'version':metadata.get('version'),'path':str(target)}

def status(home):
    config=home/'runtime.json'
    entry=Path(json.loads(config.read_text())['entry']) if config.is_file() else None
    _,data,_=layout(home)
    link=data/'Data/modules/brazier'
    return {'runtimePresent':bool(entry and entry.is_file()),'entry':str(entry) if entry else None,
            'dataPath':str(data),'sourceLinked':link.is_symlink() and link.resolve()==ROOT,
            'worldPresent':(data/'Data/worlds/brazier-dev/world.json').is_file(),
            'url':'http://127.0.0.1:30001','nativeTestsRun':False}

def launch(home,node,world):
    initialize(home)
    s=status(home)
    if not s['runtimePresent']: raise ValueError('Download the licensed Foundry V14 Node.js ZIP, then use install --zip PATH.')
    link_source(home)
    version=subprocess.check_output([node,'--version'],text=True).strip()
    if int(version.lstrip('v').split('.')[0])<24: raise ValueError('Foundry V14 requires Node.js 24 or newer.')
    command=[node,s['entry'],f"--dataPath={s['dataPath']}",'--port=30001','--noupnp','--noupdate']
    if world:
        if world!='brazier-dev': raise ValueError('Only the isolated brazier-dev world is supported.')
        command.append('--world=brazier-dev')
    print('Local development URL: '+s['url'],flush=True)
    print('Activate your license and accept the EULA yourself if prompted. No automatic license entry.',flush=True)
    return subprocess.call(command,cwd=Path(s['entry']).parent)

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--home',type=Path,default=Path(os.environ.get('BRAZIER_DEV_HOME',DEFAULT_HOME)))
    sub=p.add_subparsers(dest='action',required=True)
    sub.add_parser('status');sub.add_parser('link')
    ins=sub.add_parser('install');ins.add_argument('--zip',type=Path,required=True)
    pkg=sub.add_parser('package');pkg.add_argument('--zip',type=Path,required=True);pkg.add_argument('--kind',choices=['system','module'],required=True);pkg.add_argument('--id',required=True)
    run=sub.add_parser('start');run.add_argument('--node',default=shutil.which('node') or 'node');run.add_argument('--world',choices=['brazier-dev'])
    args=p.parse_args();home=args.home.expanduser().resolve()
    if home.is_relative_to(ROOT): p.error('Private runtime/data must be outside the module source directory.')
    try:
        if args.action=='status': print(json.dumps(status(home),indent=2))
        elif args.action=='install': print('Installed runtime: '+str(install(home,args.zip)))
        elif args.action=='package': print(json.dumps(install_package(home,args.zip,args.kind,args.id),indent=2))
        elif args.action=='link': print('Linked source: '+str(link_source(home)))
        else: return launch(home,args.node,args.world)
    except (ValueError,OSError,zipfile.BadZipFile,subprocess.SubprocessError) as error:
        p.exit(1,f'{error}\n')
    return 0
if __name__=='__main__': sys.exit(main())
