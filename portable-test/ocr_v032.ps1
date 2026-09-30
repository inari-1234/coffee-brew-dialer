[CmdletBinding()]
param(
    [string]$PdfPath,
    [string]$OutputRoot,
    [switch]$NoOpen
)

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location -LiteralPath $Root
try {
    # Validate with PowerShell absolute paths, but external tools are invoked
    # only with ASCII relative paths so Japanese/long parent folders are harmless.
    $TesseractAbs = Join-Path $Root 'tools\tesseract\tesseract.exe'
    $TessDataAbs = Join-Path $Root 'tools\tesseract\tessdata'
    $PdfToPpmAbs = Join-Path $Root 'tools\poppler\bin\pdftoppm.exe'

    $TesseractRel = '.\tools\tesseract\tesseract.exe'
    $TessDataRel = 'tools\tesseract\tessdata'
    $PdfToPpmRel = '.\tools\poppler\bin\pdftoppm.exe'

    foreach ($p in @(
        $TesseractAbs,
        (Join-Path $TessDataAbs 'jpn.traineddata'),
        (Join-Path $TessDataAbs 'eng.traineddata'),
        $PdfToPpmAbs
    )) {
        if (-not (Test-Path -LiteralPath $p -PathType Leaf)) { throw ('Required file missing: ' + $p) }
    }

    if (-not $PdfPath) {
        Add-Type -AssemblyName System.Windows.Forms
        $dialog = New-Object System.Windows.Forms.OpenFileDialog
        $dialog.Filter = 'PDF files (*.pdf)|*.pdf|All files (*.*)|*.*'
        $dialog.Title = 'OCRするPDFを選択してください'
        $dialog.Multiselect = $false
        if ($dialog.ShowDialog() -ne [System.Windows.Forms.DialogResult]::OK) { exit 2 }
        $PdfPath = $dialog.FileName
    }

    $PdfPath = [IO.Path]::GetFullPath($PdfPath)
    if (-not (Test-Path -LiteralPath $PdfPath -PathType Leaf)) { throw ('PDF not found: ' + $PdfPath) }
    if ([IO.Path]::GetExtension($PdfPath).ToLowerInvariant() -ne '.pdf') { throw 'Selected file is not a PDF.' }

    # Copy source to an ASCII-only working path before invoking Poppler/Tesseract.
    $WorkAbs = Join-Path $Root '_work'
    if (Test-Path -LiteralPath $WorkAbs) { Remove-Item -LiteralPath $WorkAbs -Recurse -Force }
    New-Item -ItemType Directory -Force -Path (Join-Path $WorkAbs 'images'), (Join-Path $WorkAbs 'pages') | Out-Null
    Copy-Item -LiteralPath $PdfPath -Destination (Join-Path $WorkAbs 'input.pdf') -Force

    if (-not $OutputRoot) { $OutputRoot = Join-Path $Root 'results' }
    New-Item -ItemType Directory -Force -Path $OutputRoot | Out-Null
    $job = Join-Path $OutputRoot ('ocr_' + (Get-Date -Format 'yyyyMMdd_HHmmss_fff'))
    New-Item -ItemType Directory -Force -Path $job | Out-Null
    $log = Join-Path $job 'OCR_LOG.txt'

    function Log([string]$s) {
        $line = ('[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $s)
        Write-Host $line
        Add-Content -LiteralPath $log -Value $line -Encoding UTF8
    }

    Log ('SourcePDF=' + $PdfPath)
    Log 'RuntimeNetworkAccess=NONE'
    Log 'ExternalToolPaths=ASCII_RELATIVE_ONLY'
    Log 'DPI=300'
    Log 'Language=jpn+eng'

    & $PdfToPpmRel -png -r 300 '_work\input.pdf' '_work\images\page' 2>&1 |
        ForEach-Object { Log ('pdftoppm: ' + $_) }
    if ($LASTEXITCODE -ne 0) { throw ('pdftoppm failed: exit=' + $LASTEXITCODE) }

    $pngs = @(Get-ChildItem -LiteralPath (Join-Path $WorkAbs 'images') -File -Filter 'page-*.png' |
        Sort-Object {
            $m=[regex]::Match($_.BaseName,'(\d+)$')
            if($m.Success){[int]$m.Groups[1].Value}else{999999}
        })
    if ($pngs.Count -eq 0) { throw 'No page images were created.' }

    $combined = New-Object System.Collections.Generic.List[string]
    for ($i=0; $i -lt $pngs.Count; $i++) {
        $n=$i+1
        $imgRel=(' _work\images\page-{0}.png' -f $n).Trim()
        $outRel=(' _work\pages\page-{0:D3}' -f $n).Trim()
        Log ('OCR page ' + $n + '/' + $pngs.Count)
        & $TesseractRel $imgRel $outRel -l 'jpn+eng' --psm 3 --tessdata-dir $TessDataRel 2>&1 |
            ForEach-Object { Log ('tesseract: ' + $_) }
        if ($LASTEXITCODE -ne 0) { throw ('tesseract failed on page ' + $n + ': exit=' + $LASTEXITCODE) }

        $pageTxt = Join-Path $Root ($outRel + '.txt')
        if (-not (Test-Path -LiteralPath $pageTxt)) { throw ('OCR page text missing: ' + $pageTxt) }
        $text=[IO.File]::ReadAllText($pageTxt,[Text.Encoding]::UTF8)
        $combined.Add(('===== PAGE {0} =====' -f $n))
        $combined.Add($text.TrimEnd())
        $combined.Add('')
    }

    $result=Join-Path $job 'OCR_RESULT.txt'
    $utf8Bom=New-Object System.Text.UTF8Encoding($true)
    [IO.File]::WriteAllLines($result,$combined,$utf8Bom)
    Copy-Item -LiteralPath $result -Destination (Join-Path $OutputRoot 'OCR_RESULT_latest.txt') -Force

    Log ('Pages=' + $pngs.Count)
    Log ('FINAL=PASS')
    Log ('Result=' + $result)

    Write-Output ('RESULT_PATH=' + $result)
    if (-not $NoOpen) { Start-Process -FilePath $result }
    exit 0
}
catch {
    Write-Host ('OCR FAILED: ' + $_.Exception.Message)
    exit 1
}
finally {
    Pop-Location
}
