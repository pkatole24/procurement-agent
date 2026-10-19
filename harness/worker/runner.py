import base64
import csv
import json
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parent
OUT = ROOT / 'outputs'

COMMANDS = {
    'verify-rules': ['.claude/skills/extract-rules/verify_quotes.py', 'outputs/rules.json', 'data/contract-rules.pdf'],
    'analyse': ['scripts/analyze_spend.py'],
    'verify-analytics': ['scripts/self_check_analytics.py'],
    'verify-history': ['scripts/verify_history.py', 'outputs/history.json', 'data/committee'],
    'register': ['.claude/skills/risk-assessment/build_register.py'],
    'gate': ['.claude/skills/audit-program/build_pack.py', '--gate'],
    'pack': ['.claude/skills/audit-program/build_pack.py'],
    'qa': ['scripts/checks/run_checks.py'],
}


def inside(base, name):
    path = (base / name).resolve()
    if not path.is_relative_to(base.resolve()) or not path.is_file():
        raise ValueError('Invalid or missing file')
    return path


def main(request):
    action = request['action']
    if action == 'command':
        command = COMMANDS[request['command']]
        result = subprocess.run([sys.executable, *command], cwd=ROOT, capture_output=True, text=True, timeout=220)
        warnings = 'WARNING' in result.stderr or 'EXCLUDED' in result.stderr
        return {'passed': result.returncode == 0 and not warnings, 'exitCode': result.returncode, 'stdout': result.stdout[:16000], 'stderr': result.stderr[:16000]}
    if action == 'pdf':
        path = inside(ROOT / 'data', request['file'])
        if path.suffix.lower() != '.pdf':
            raise ValueError('PDF required')
        from pypdf import PdfReader
        pages = len(PdfReader(path).pages)
        page = request['page']
        if type(page) is not int or not 1 <= page <= pages:
            raise ValueError(f'Page outside 1..{pages}')
        texts = {}
        for mode in ('plain', 'layout'):
            args = ['pdftotext', '-enc', 'UTF-8', '-f', str(page), '-l', str(page)]
            if mode == 'layout':
                args.append('-layout')
            texts[mode] = subprocess.run([*args, str(path), '-'], check=True, capture_output=True).stdout.decode('utf-8')
        image = ROOT / 'page-preview'
        subprocess.run(['pdftoppm', '-f', str(page), '-l', str(page), '-singlefile', '-scale-to', '1600', '-png', str(path), str(image)], check=True, capture_output=True)
        return {'file': request['file'], 'page': page, 'pages': pages, **texts, 'image': base64.b64encode(image.with_suffix('.png').read_bytes()).decode('ascii')}
    if action == 'preview':
        path = inside(OUT / 'analytics-full', request['file'])
        with path.open(encoding='utf-8-sig', newline='') as stream:
            reader = csv.DictReader(stream)
            rows = []
            count = 0
            for row in reader:
                count += 1
                if len(rows) < 20:
                    rows.append(row)
        return {'columns': reader.fieldnames, 'rows': rows, 'count': count}
    raise ValueError('Unknown operation')


if __name__ == '__main__':
    OUT.mkdir(exist_ok=True)
    try:
        result = main(json.loads((ROOT / 'request.json').read_text(encoding='utf-8')))
        (ROOT / 'result.json').write_text(json.dumps(result, ensure_ascii=False, allow_nan=False), encoding='utf-8')
        manifest = []
        for path in sorted(OUT.rglob('*')):
            if path.is_file() and '__pycache__' not in path.parts:
                manifest.append(path.relative_to(OUT).as_posix())
        (ROOT / 'output-manifest.json').write_text(json.dumps(manifest), encoding='utf-8')
    except Exception as error:
        (ROOT / 'result.json').write_text(json.dumps({'error': str(error)}), encoding='utf-8')
        sys.exit(1)
