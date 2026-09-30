@echo off
setlocal EnableExtensions
cd /d "%~dp0"
set "LOG=%~dp0DIAG_RESULT.txt"
set "TESS=%~dp0tools\tesseract\tesseract.exe"
set "PDFTOPPM=%~dp0tools\poppler\bin\pdftoppm.exe"

>"%LOG%" echo PDF OCR ENGINE DIAGNOSTIC
>>"%LOG%" echo DATE=%DATE% %TIME%
>>"%LOG%" echo ROOT=%~dp0
>>"%LOG%" echo.

set "FAIL=0"
if exist "%TESS%" (
  echo PASS FILE tesseract.exe
  >>"%LOG%" echo PASS FILE tesseract.exe
) else (
  echo FAIL FILE tesseract.exe MISSING
  >>"%LOG%" echo FAIL FILE tesseract.exe MISSING
  set "FAIL=1"
)
if exist "%PDFTOPPM%" (
  echo PASS FILE pdftoppm.exe
  >>"%LOG%" echo PASS FILE pdftoppm.exe
) else (
  echo FAIL FILE pdftoppm.exe MISSING
  >>"%LOG%" echo FAIL FILE pdftoppm.exe MISSING
  set "FAIL=1"
)
if "%FAIL%"=="1" goto :final

echo [1/2] Direct Tesseract startup test...
>>"%LOG%" echo.
>>"%LOG%" echo ===== TESSERACT DIRECT START =====
"%TESS%" --version >>"%LOG%" 2>&1
set "TESS_EC=%ERRORLEVEL%"
echo Tesseract ExitCode=%TESS_EC%
>>"%LOG%" echo TESSERACT_EXITCODE=%TESS_EC%
if not "%TESS_EC%"=="0" set "FAIL=1"

echo [2/2] Direct Poppler startup test...
>>"%LOG%" echo.
>>"%LOG%" echo ===== PDFTOPPM DIRECT START =====
"%PDFTOPPM%" -v >>"%LOG%" 2>&1
set "POP_EC=%ERRORLEVEL%"
echo Poppler ExitCode=%POP_EC%
>>"%LOG%" echo PDFTOPPM_EXITCODE=%POP_EC%
if not "%POP_EC%"=="0" set "FAIL=1"

:final
>>"%LOG%" echo.
if "%FAIL%"=="0" (
  echo ENGINE DIRECT CHECK PASS
  >>"%LOG%" echo FINAL=PASS
) else (
  echo ENGINE DIRECT CHECK FAIL
  >>"%LOG%" echo FINAL=FAIL
)
exit /b %FAIL%
