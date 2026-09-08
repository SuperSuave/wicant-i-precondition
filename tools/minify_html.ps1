param(
    [string]$SrcDir = "main/ui_src",
    [string]$FullDstPath = "main/homepage_full.html",
    [string]$MinDstPath = "main/homepage.html"
)

if (-not (Test-Path $SrcDir)) {
    Write-Error "Source directory $SrcDir not found."
    exit 1
}

$indexPath  = Join-Path $SrcDir "index.html"
$stylesPath = Join-Path $SrcDir "styles.css"
$iconsPath  = Join-Path $SrcDir "icons.svg"
$appJsPath  = Join-Path $SrcDir "app.js"

foreach ($p in @($indexPath, $stylesPath, $iconsPath, $appJsPath)) {
    if (-not (Test-Path $p)) {
        Write-Error "Required file $p not found."
        exit 1
    }
}

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

# 1. Assemble separate files into full HTML
$htmlContent = [System.IO.File]::ReadAllText((Resolve-Path $indexPath), [System.Text.Encoding]::UTF8)
$cssContent  = [System.IO.File]::ReadAllText((Resolve-Path $stylesPath), [System.Text.Encoding]::UTF8)
$svgContent  = [System.IO.File]::ReadAllText((Resolve-Path $iconsPath), [System.Text.Encoding]::UTF8)
$jsContent   = [System.IO.File]::ReadAllText((Resolve-Path $appJsPath), [System.Text.Encoding]::UTF8)

$fullContent = $htmlContent
$fullContent = $fullContent.Replace("<!-- BUILD_CSS -->", "<style>`n$cssContent`n</style>")
$fullContent = $fullContent.Replace("<!-- BUILD_ICONS -->", "<svg xmlns=""http://www.w3.org/2000/svg"" style=""display: none;"">`n$svgContent`n</svg>")
$fullContent = $fullContent.Replace("<!-- BUILD_JS -->", "<script>`n$jsContent`n</script>")

# Write the unminified bundle for inspection/debugging
$fullDstResolved = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $FullDstPath))
[System.IO.File]::WriteAllText($fullDstResolved, $fullContent, $utf8NoBom)

# 2. Remove HTML comments
$content = [System.Text.RegularExpressions.Regex]::Replace($fullContent, "<!--(?!\[if)[\s\S]*?-->", "")

# 3. Minify embedded <style> blocks
$styleEvaluator = [System.Text.RegularExpressions.MatchEvaluator]{
    param($match)
    $css = $match.Groups[1].Value
    $css = [System.Text.RegularExpressions.Regex]::Replace($css, "/\*[\s\S]*?\*/", "")
    $css = [System.Text.RegularExpressions.Regex]::Replace($css, "\s+", " ")
    $css = [System.Text.RegularExpressions.Regex]::Replace($css, "\s*([\{\}:;,])\s*", '$1')
    return "<style>" + $css.Trim() + "</style>"
}
$content = [System.Text.RegularExpressions.Regex]::Replace($content, "<style[^>]*>([\s\S]*?)</style>", $styleEvaluator)

# 4. Minify embedded <script> blocks
$scriptEvaluator = [System.Text.RegularExpressions.MatchEvaluator]{
    param($match)
    $js = $match.Groups[1].Value
    $js = [System.Text.RegularExpressions.Regex]::Replace($js, "/\*[\s\S]*?\*/", "")
    $jsLines = $js -split "\r?\n"
    $filtered = [System.Collections.Generic.List[string]]::new()
    foreach ($l in $jsLines) {
        $t = $l.Trim()
        if ([string]::IsNullOrWhiteSpace($t)) { continue }
        if ($t.StartsWith("//")) { continue }
        $filtered.Add($t)
    }
    return "<script>`n" + ($filtered -join "`n") + "`n</script>"
}
$content = [System.Text.RegularExpressions.Regex]::Replace($content, "<script[^>]*>([\s\S]*?)</script>", $scriptEvaluator)

# 5. Collapse blank lines and trim markup
$allLines = $content -split "\r?\n"
$finalLines = [System.Collections.Generic.List[string]]::new()
foreach ($l in $allLines) {
    $t = $l.Trim()
    if (-not [string]::IsNullOrWhiteSpace($t)) {
        $finalLines.Add($t)
    }
}
$minified = $finalLines -join "`n"

$minDstResolved = [System.IO.Path]::GetFullPath((Join-Path (Get-Location) $MinDstPath))
[System.IO.File]::WriteAllText($minDstResolved, $minified, $utf8NoBom)

# 6. Gzip compress
$gzPath = if ($minDstResolved.EndsWith(".gz")) { $minDstResolved } else { $minDstResolved + ".gz" }
$rawBytes = [System.IO.File]::ReadAllBytes($minDstResolved)
$outFileStream = [System.IO.File]::Create($gzPath)
$gzipStream = New-Object System.IO.Compression.GZipStream($outFileStream, [System.IO.Compression.CompressionLevel]::Optimal)
$gzipStream.Write($rawBytes, 0, $rawBytes.Length)
$gzipStream.Close()
$outFileStream.Close()

$origSz = (Get-Item $fullDstResolved).Length
$minSz = (Get-Item $minDstResolved).Length
$gzSz = (Get-Item $gzPath).Length
$saved = $origSz - $gzSz
$pct = [Math]::Round(($saved / $origSz) * 100, 1)

Write-Host "Bundled & Gzipped $SrcDir -> $gzPath : $origSz B -> $gzSz B (Saved $saved B / $([Math]::Round($saved/1024, 1)) KB, -$pct%)" -ForegroundColor Green