@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

rem IMPORTANT:
rem External OCR executables only receive ASCII relative paths.
rem This avoids Tesseract tessdata failures when this tool is stored
rem under a Japanese/space-containing/long Windows path.

set "TESS=tools\tesseract\tesseract.exe"
set "TESSDATA=tools\tesseract\tessdata"
set "PDFTOPPM=tools\poppler\bin\pdftoppm.exe"

if "%~1"=="" (
  echo.
  echo Drag and drop a PDF file onto this CMD file.
  echo No PowerShell and no network access are used.
  echo.
  pause
  exit /b 2
)

if not exist "%~f1" (
  echo PDF NOT FOUND.
  pause
  exit /b 1
)
if not exist "%TESS%" (
  echo tesseract.exe is missing.
  pause
  exit /b 1
)
if not exist "%TESSDATA%\jpn.traineddata" (
  echo jpn.traineddata is missing.
  pause
  exit /b 1
)
if not exist "%TESSDATA%\eng.traineddata" (
  echo eng.traineddata is missing.
  pause
  exit /b 1
)
if not exist "%PDFTOPPM%" (
  echo pdftoppm.exe is missing.
  pause
  exit /b 1
)

if exist "_work" rmdir /s /q "_work" >nul 2>&1
mkdir "_work\images" >nul 2>&1
mkdir "_work\pages" >nul 2>&1
if not exist "results" mkdir "results" >nul 2>&1

copy /y "%~f1" "_work\input.pdf" >nul
if errorlevel 1 (
  echo INPUT COPY FAILED.
  pause
  exit /b 1
)

set "JOB=results\cmd_%RANDOM%_%RANDOM%"
mkdir "%JOB%" >nul 2>&1
set "LOG=%JOB%\OCR_CMD_LOG.txt"

>"%LOG%" echo SourcePDF=%~f1
>>"%LOG%" echo RuntimeNetworkAccess=NONE
>>"%LOG%" echo PowerShellUsed=NO
>>"%LOG%" echo ExternalToolPaths=ASCII_RELATIVE_ONLY
>>"%LOG%" echo DPI=300
>>"%LOG%" echo Language=jpn+eng

echo Rendering PDF at 300 dpi...
"%PDFTOPPM%" -png -r 300 "_work\input.pdf" "_work\images\page" >>"%LOG%" 2>&1
if errorlevel 1 (
  echo PDF RENDER FAILED. See "%CD%\%LOG%"
  pause
  exit /b 1
)

set /a COUNT=0
for /L %%N in (1,1,9999) do (
  if exist "_work\images\page-%%N.png" (
    set /a COUNT+=1
    echo OCR page %%N...
    "%TESS%" "_work\images\page-%%N.png" "_work\pages\page-%%N" -l jpn+eng --psm 3 --tessdata-dir "%TESSDATA%" >>"%LOG%" 2>&1
    if errorlevel 1 (
      echo OCR FAILED ON PAGE %%N. See "%CD%\%LOG%"
      pause
      exit /b 1
    )
  )
)

if "!COUNT!"=="0" (
  echo NO PAGE IMAGES FOUND. See "%CD%\%LOG%"
  pause
  exit /b 1
)

set "RESULT=%JOB%\OCR_RESULT.txt"
>"%RESULT%" type nul
for /L %%N in (1,1,9999) do (
  if exist "_work\pages\page-%%N.txt" (
    >>"%RESULT%" echo ===== PAGE %%N =====
    type "_work\pages\page-%%N.txt" >>"%RESULT%"
    >>"%RESULT%" echo.
  )
)

copy /y "%RESULT%" "results\OCR_RESULT_latest.txt" >nul
>>"%LOG%" echo Pages=!COUNT!
>>"%LOG%" echo Result=%RESULT%
>>"%LOG%" echo FINAL=PASS

echo.
echo OCR PASS - Pages=!COUNT!
echo Result: "%CD%\%RESULT%"
start "" notepad.exe "%RESULT%"
pause
exit /b 0
