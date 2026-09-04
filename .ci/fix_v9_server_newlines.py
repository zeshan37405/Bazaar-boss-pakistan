from pathlib import Path

p = Path('confectionery_sync_server/server.js')
s = p.read_text(encoding='utf-8')
marker = 'const pool = new Pool'
if marker not in s:
    raise SystemExit('server pool marker missing')
head, tail = s.split(marker, 1)
head = head.replace('\\nconst ', '\nconst ')
p.write_text(head + marker + tail, encoding='utf-8')
print('V9 server constant newlines repaired')
