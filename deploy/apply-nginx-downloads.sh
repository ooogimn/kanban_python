#!/usr/bin/env bash
# Вставляет location ^~ /downloads/ после блока /media/ во всех подходящих server в conf.d.
# Запуск на сервере от root: bash /opt/kanban_python/app/deploy/apply-nginx-downloads.sh

set -euo pipefail

CONF_DIR=/etc/nginx/conf.d
SNIPPET='    location ^~ /downloads/ {
        alias /opt/kanban_python/desktop-releases/;
        default_type application/octet-stream;
        add_header Content-Disposition "attachment" always;
    }

'

if [[ ! -d "$CONF_DIR" ]]; then
  echo "Нет каталога $CONF_DIR" >&2
  exit 1
fi

python3 <<'PY' || exit 1
import pathlib, re, datetime, sys

conf_dir = pathlib.Path("/etc/nginx/conf.d")
snippet = """    location ^~ /downloads/ {
        alias /opt/kanban_python/desktop-releases/;
        default_type application/octet-stream;
        add_header Content-Disposition "attachment" always;
    }

"""

# Строгий вид (как в deploy/nginx-kanban-frontend-fix.conf)
pat_strict = re.compile(
    r"(    location \^~ /media/ \{\n        alias /opt/kanban_python/app/backend/media/;\n    \}\n)"
)
# Запасной: любые пробелы
pat_flex = re.compile(
    r"(location \^~ /media/ \{\s*alias /opt/kanban_python/app/backend/media/;\s*\}\s*)",
    re.MULTILINE | re.DOTALL,
)

updated = False
for p in sorted(conf_dir.glob("*.conf")):
    text = p.read_text(encoding="utf-8", errors="replace")
    if "antexpress.ru" not in text or "alias /opt/kanban_python/app/backend/media/" not in text:
        continue
    if "location ^~ /downloads/" in text:
        print(f"{p}: уже есть /downloads/ — пропуск")
        continue
    m_strict = pat_strict.search(text)
    if m_strict:
        new_text = pat_strict.sub(r"\1" + snippet, text)
        n = len(pat_strict.findall(text))
    else:
        new_text, n = pat_flex.subn(r"\1" + snippet, text)
        if n == 0:
            print(f"{p}: блок /media/ не распознан — пропуск (проверьте вручную)", file=sys.stderr)
            continue
    ts = datetime.datetime.now().strftime("%Y%m%d%H%M%S")
    bak = p.with_suffix(p.suffix + ".bak." + ts)
    bak.write_text(text, encoding="utf-8")
    p.write_text(new_text, encoding="utf-8")
    print(f"{p}: обновлён, резервная копия: {bak}")
    updated = True

if not updated:
    for p in sorted(conf_dir.glob("*.conf")):
        t = p.read_text(encoding="utf-8", errors="replace")
        if "antexpress.ru" in t and "location ^~ /downloads/" in t:
            print("Уже настроено:", p)
            sys.exit(0)
    print("Ни один conf не подошёл — проверьте пути в /etc/nginx/conf.d/", file=sys.stderr)
    sys.exit(1)
PY

nginx -t
systemctl reload nginx
echo "Готово: nginx -t OK, reload выполнен."
