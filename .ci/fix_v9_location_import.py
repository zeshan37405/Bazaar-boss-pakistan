from pathlib import Path

p = Path('confectionery_order_app/app/src/main/java/com/example/confectionery/MainActivity.kt')
s = p.read_text(encoding='utf-8')
anchor = 'import com.example.confectionery.sync.AuthClient\n'
if anchor not in s:
    raise SystemExit('AuthClient import anchor missing')
if 'import com.example.confectionery.sync.LocationClient\n' not in s:
    s = s.replace(anchor, anchor + 'import com.example.confectionery.sync.LocationClient\n', 1)
p.write_text(s, encoding='utf-8')
print('V9 LocationClient import repaired')
