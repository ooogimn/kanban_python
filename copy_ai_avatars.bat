@echo off
REM Копирование аватарок ИИ-агентов в frontend/public (для маркетплейса)
set SRC=INFO_PROJECT
set DST=frontend\public
copy /Y "%SRC%\AI-Pomosnic.png" "%DST%\AI-Pomosnic.png"
copy /Y "%SRC%\AI-HR.png" "%DST%\AI-HR.png"
copy /Y "%SRC%\AI-Finance.png" "%DST%\AI-Finance.png"
copy /Y "%SRC%\AI-Manager.png" "%DST%\AI-Manager.png"
copy /Y "%SRC%\AI-Analitik.png" "%DST%\AI-Analitik.png"
echo Done. 5 files copied to %DST%
