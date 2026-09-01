from pathlib import Path

path = Path('.ci/patch_v6_business.py')
text = path.read_text(encoding='utf-8')
old = 're.subn(pattern, replacement, text, count=1, flags=re.S)'
new = 're.subn(pattern, lambda _m: replacement, text, count=1, flags=re.S)'
count = text.count(old)
if count < 4:
    raise SystemExit(f'Expected at least 4 V6 regex replacements, found {count}')
text = text.replace(old, new)
path.write_text(text, encoding='utf-8')
print(f'V6 regex replacements made literal-safe: {count}')
