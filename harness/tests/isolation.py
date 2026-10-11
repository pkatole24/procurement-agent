import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

app = Path(__file__).resolve().parents[1]
original = app.parent
manifest = json.loads((app / 'evidence/manifest.json').read_text())


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


before = {p: digest(p) for p in original.joinpath('outputs').rglob('*') if p.is_file()}
with tempfile.TemporaryDirectory(dir=app) as directory:
    root = Path(directory)
    for item in manifest:
        source = app / 'evidence' / item['path']
        assert digest(source) == item['sha256']
        target = root / item['path']
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source, target)
    shutil.copytree(original / 'outputs', root / 'outputs')
    shutil.copyfile(app / 'worker/runner.py', root / 'runner.py')
    for command in ('gate', 'qa'):
        (root / 'request.json').write_text(json.dumps({'action':'command','command':command}))
        result = subprocess.run([sys.executable, str(root / 'runner.py')], cwd=root, capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        report = json.loads((root / 'result.json').read_text())
        assert report['passed'], report
        print(f'Isolated unchanged project: {command} PASS')
    (root / 'request.json').write_text(json.dumps({'action':'preview','file':'../../data/contracts.csv'}))
    result = subprocess.run([sys.executable, str(root / 'runner.py')], cwd=root, capture_output=True)
    assert result.returncode != 0, 'Runner allowed an escaping artifact path'
for path, checksum in before.items():
    assert digest(path) == checksum, f'Original output changed: {path.name}'
for item in manifest:
    assert digest(original / item['path']) == item['sha256'], f'Original source changed: {item["path"]}'
print('Original source and output checksums unchanged; path escape rejected.')
