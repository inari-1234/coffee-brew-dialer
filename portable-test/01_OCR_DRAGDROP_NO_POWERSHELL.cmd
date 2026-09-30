@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"
set "ROOT=%~dp0"
set "TESS=%ROOT%tools\tesseract\tesseract.exe"
set "TESSDATA=%ROOT%tools\tesseract\tessdata"
set "PDFTOPPM=%ROOT%tools\poppler\bin\pdftoppm.exe"
if "%~1"=="" exit /b 2
set "PDF=%~f1"
if not exist "%PDF%" exit /b 1
if not exist "%TESS%" exit /b 1
if not exist "%PDFTOPPM%" exit /b 1
if not exist "%ROOT%results" mkdir "%ROOT%results" >nul 2>&1
set "JOB=%ROOT%results\cmd_%RANDOM%_%RANDOM%_%~n1"
set "IMAGES=%JOB%\images"
set "PAGES=%JOB%\pages"
mkdir "%JOB%" >nul 2>&1
mkdir "%IMAGES%" >nul 2>&1
mkdir "%PAGES%" >nul 2>&1
set "LOG=%JOB%\OCR_CMD_LOG.txt"
>"%LOG%" echo PDF=%PDF%
"%PDFTOPPM%" -png -r 300 "%PDF%" "%IMAGES%\page" >>"%LOG%" 2>&1
if errorlevel 1 exit /b 1
set /a COUNT=0
for /L %%N in (1,1,9999) do (
  if exist "%IMAGES%\page-%%N.png" (
    set /a COUNT+=1
    "%TESS%" "%IMAGES%\page-%%N.png" "%PAGES%\page-%%N" -l jpn+eng --psm 3 --tessdata-dir "%TESSDATA%" >>"%LOG%" 2>&1
    if errorlevel 1 exit /b 1
  )
)
if "!COUNT!"=="0" exit /b 1
set "RESULT=%JOB%\OCR_RESULT.txt"
>"%RESULT%" type nul
for /L %%N in (1,1,9999) do (
  if exist "%PAGES%\page-%%N.txt" (
    >>"%RESULT%" echo ===== PAGE %%N =====
    type "%PAGES%\page-%%N.txt" >>"%RESULT%"
    >>"%RESULT%" echo.
  )
)
>>"%LOG%" echo FINAL=PASS
exit /b 0
