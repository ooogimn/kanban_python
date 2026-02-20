#!/usr/bin/env python
"""Чтение последних логов из терминала."""
import sys

terminal_file = r'C:\Users\90319\.cursor\projects\f-PROGER-SAITS-MAY-SERVERA-OOO-LukinterLab-PROGI-DOP-KANBAN-kanban-python\terminals\19.txt'

try:
    with open(terminal_file, 'r', encoding='utf-8', errors='ignore') as f:
        lines = f.readlines()
        # Последние 150 строк
        last_lines = lines[-150:]
        print(''.join(last_lines))
except Exception as e:
    print(f"Ошибка чтения: {e}")
