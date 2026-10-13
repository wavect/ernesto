#!/usr/bin/env python3
"""Build a deterministic, reviewed source archive without local state."""
import gzip, hashlib, io, json, tarfile, re, struct, zlib
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
FILES = ['.prettierrc.json','README.md','LICENSE','ASSET_LICENSE.md','THIRD_PARTY_NOTICES.md','SECURITY.md','CONTRIBUTING.md','CHANGELOG.md','package.json','package-lock.json','.gitignore','.claude-plugin/plugin.json','.claude-plugin/marketplace.json','hooks/hooks.json']
DIRS = ['core','hooks','ui','assets','integrations','docs','tests','scripts','examples']
BANNED = {'.git','node_modules','.agent-cache','.agent-worktrees','.ernesto','__pycache__'}
def inputs():
    result = set(FILES)
    for folder in DIRS:
        for p in (ROOT/folder).rglob('*'):
            parts=p.relative_to(ROOT).parts
            if any(x in BANNED for x in parts): continue
            if p.is_symlink(): raise ValueError('Symlink in source archive')
            if p.is_file(): result.add(p.relative_to(ROOT).as_posix())
    for name in result:
        p=ROOT/name
        if not p.is_file() or p.is_symlink(): raise ValueError('Missing or unsafe public file: '+name)
        if name.endswith(('.log','.pem','.key','.tif')) or any(x.startswith('.env') for x in p.parts): raise ValueError('Private file in source archive')
        if p.suffix in {'.js','.mjs','.ts','.json','.md','.py','.yml'}:
            text=p.read_text()
            if re.search(r'/(?:Users|home)/[A-Za-z]|[A-Z]:\\'+r'(?:Users|Documents)\\|/'+'private/'+'tmp|gh'+'o_',text): raise ValueError('Private path or credential in '+name)
        if p.suffix == '.png':
            data=p.read_bytes()
            if data[:8] != bytes([137,80,78,71,13,10,26,10]): raise ValueError('Invalid PNG')
            offset=8
            while offset<len(data):
                size=struct.unpack('>I',data[offset:offset+4])[0];kind=data[offset+4:offset+8]
                if kind in {b'tEXt',b'zTXt',b'iTXt',b'eXIf'}: raise ValueError('PNG contains textual metadata')
                if offset+12+size>len(data): raise ValueError('Truncated PNG')
                payload=data[offset+4:offset+8+size];crc=struct.unpack('>I',data[offset+8+size:offset+12+size])[0]
                if zlib.crc32(payload)!=crc: raise ValueError('Invalid PNG checksum')
                offset+=12+size
            if offset!=len(data): raise ValueError('Invalid PNG length')
    return sorted(result)
def build():
    manifest={name:hashlib.sha256((ROOT/name).read_bytes()).hexdigest() for name in inputs()}
    buffer=io.BytesIO()
    with tarfile.open(fileobj=buffer,mode='w',format=tarfile.PAX_FORMAT) as archive:
        for name in manifest:
            data=(ROOT/name).read_bytes(); entry=tarfile.TarInfo('ernesto/'+name)
            entry.size=len(data); entry.mode=0o644;entry.mtime=0;entry.uid=entry.gid=0
            archive.addfile(entry,io.BytesIO(data))
    compressed=gzip.compress(buffer.getvalue(),mtime=0)
    out=ROOT/'.agent-cache/package';out.mkdir(parents=True,exist_ok=True)
    (out/'ernesto-source.tar.gz').write_bytes(compressed)
    (out/'CONTENTS.sha256.json').write_text(json.dumps(manifest,indent=2)+'\n')
    digest=hashlib.sha256(compressed).hexdigest()
    (out/'SHA256SUMS').write_text(digest+'  ernesto-source.tar.gz\n')
    print(f'{len(manifest)} reviewed files; archive sha256 {digest}')
    return digest
if __name__=='__main__': build()
