"""Young Sails — translation checker.

Compares every i18n/<lang>/<namespace>.json with the English source:
  * strings translated vs English (count and words),
  * keys English does not have (typos)            -> error,
  * placeholders ({n}, {c}, ...) that differ      -> error,
  * arrays (spec rows, legend) of another length  -> error,
  * strings identical to English                  -> reported only (some, like "ILCA 6", are meant to be equal).

A plural object ({"one": ..., "other": ...}) may replace a plain string, in English
or in a translation; each form must keep the placeholders of the English string
(or of its 'other' form).

Usage:  python tools/i18n_check.py [lang ...] [-v]
        -v also lists missing keys and strings identical to English.
Exit code 1 on structural errors.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'i18n'
PLACEHOLDER = re.compile(r'\{(\w+)\}')
PLURAL_KEYS = {'zero', 'one', 'two', 'few', 'many', 'other'}


def is_plural(v):
    return isinstance(v, dict) and v and set(v) <= PLURAL_KEYS and 'other' in v


def leaves(node, path=''):
    """Yield (path, value) for every string, skipping `_` note keys. A plural object is one string."""
    if is_plural(node):
        yield path, node['other']
    elif isinstance(node, dict):
        for k, v in node.items():
            if not k.startswith('_'):
                yield from leaves(v, f'{path}.{k}' if path else k)
    elif isinstance(node, list):
        for i, v in enumerate(node):
            yield from leaves(v, f'{path}[{i}]')
    elif isinstance(node, str):
        yield path, node


def words(s):
    return len(re.findall(r'\w+', PLACEHOLDER.sub('', s)))


def compare(en, tr, path, report):
    """Walk the translation against English; collect structural errors."""
    if isinstance(tr, dict) and not is_plural(tr):
        if not isinstance(en, dict):
            report['errors'].append(f'{path}: object where English has {type(en).__name__}')
            return
        for k, v in tr.items():
            if k.startswith('_'):
                continue
            p = f'{path}.{k}' if path else k
            if k not in en:
                report['errors'].append(f'{p}: key not in English')
            else:
                compare(en[k], v, p, report)
    elif isinstance(tr, list):
        if not isinstance(en, list):
            report['errors'].append(f'{path}: array where English has {type(en).__name__}')
        elif len(tr) != len(en):
            report['errors'].append(f'{path}: {len(tr)} items, English has {len(en)}')
        else:
            for i, (a, b) in enumerate(zip(en, tr)):
                compare(a, b, f'{path}[{i}]', report)
    else:
        forms = tr.values() if is_plural(tr) else [tr]
        if is_plural(en):   # English plural: every form of the translation keeps the placeholders of English 'other'
            en = en['other']
        if not isinstance(en, (str, int)):
            report['errors'].append(f'{path}: value where English has {type(en).__name__}')
            return
        want = set(PLACEHOLDER.findall(str(en)))
        for f in forms:
            if not isinstance(f, (str, int)):
                report['errors'].append(f'{path}: not a string')
                continue
            got = set(PLACEHOLDER.findall(str(f)))
            if got != want:
                report['errors'].append(f'{path}: placeholders {sorted(got)}, English {sorted(want)}')


def get(node, path):
    for part in re.findall(r'[^.\[\]]+', path):
        if isinstance(node, list):
            i = int(part)
            node = node[i] if i < len(node) else None
        elif isinstance(node, dict):
            node = node.get(part)
        else:
            return None
        if node is None:
            return None
    return node


def check(lang, ns, verbose):
    en = json.loads((ROOT / 'en' / f'{ns}.json').read_text(encoding='utf-8'))
    f = ROOT / lang / f'{ns}.json'
    tr = json.loads(f.read_text(encoding='utf-8')) if f.exists() else {}
    report = {'errors': [], 'missing': [], 'same': []}
    compare(en, tr, '', report)
    done = done_words = 0
    for path, s in leaves(en):
        v = get(tr, path)
        if v is None:
            report['missing'].append(path)
        else:
            done += 1
            done_words += words(s)
            if v == s:
                report['same'].append(path)
    total = sum(1 for _ in leaves(en))
    total_words = sum(words(s) for _, s in leaves(en))
    return total, total_words, done, done_words, report, tr.get('_status', '')


def main(argv):
    verbose = '-v' in argv
    langs = [a for a in argv if not a.startswith('-')] or \
        sorted(p.name for p in ROOT.iterdir() if p.is_dir() and p.name != 'en')
    namespaces = sorted(p.stem for p in (ROOT / 'en').glob('*.json'))
    failed = False
    print(f'{"lang":5} {"namespace":10} {"strings":>13} {"words":>13} {"same":>5} {"err":>4}')
    for lang in langs:
        for ns in namespaces:
            total, tw, done, dw, rep, status = check(lang, ns, verbose)
            print(f'{lang:5} {ns:10} {done:>5}/{total:<7} {dw:>5}/{tw:<7} {len(rep["same"]):>5} {len(rep["errors"]):>4}')
            for e in rep['errors']:
                print(f'      ERROR {e}')
            if verbose:
                for m in rep['missing']:
                    print(f'      missing {m}')
                for s in rep['same']:
                    print(f'      same    {s}')
            failed |= bool(rep['errors'])
    return 1 if failed else 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
