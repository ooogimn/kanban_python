#!/usr/bin/env python3
"""Создаёт минимальный icon.ico в src-tauri/icons/ для сборки Tauri на Windows."""
import os

dir_path = os.path.join(os.path.dirname(__file__), "src-tauri", "icons")
os.makedirs(dir_path, exist_ok=True)
ico_path = os.path.join(dir_path, "icon.ico")

# Минимальный валидный ICO: 1x1, 32bpp (заголовок + запись + DIB)
header = bytes([0, 0, 1, 0, 1, 0])
entry = bytes([1, 1, 0, 0, 1, 0, 32, 0]) + (56).to_bytes(4, "little") + (22).to_bytes(4, "little")
dib = (
    (40).to_bytes(4, "little")
    + (1).to_bytes(4, "little")
    + (2).to_bytes(4, "little")
    + (1).to_bytes(2, "little")
    + (32).to_bytes(2, "little")
    + (4).to_bytes(4, "little")
    + bytes(20)
    + bytes([128, 128, 128, 255])
    + bytes(12)
)
with open(ico_path, "wb") as f:
    f.write(header + entry + dib)
print("Создан:", ico_path)
