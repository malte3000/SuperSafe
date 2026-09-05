param(
  [Parameter(Mandatory = $false)]
  [string]$OutputFile = (Join-Path $PSScriptRoot '..\public\data\fi-funds-latest.json'),

  [Parameter(Mandatory = $false)]
  [string]$ManifestFile = (Join-Path $PSScriptRoot '..\public\data\fi-funds-latest.meta.json'),

  [Parameter(Mandatory = $false)]
  [string]$IndexUrl = 'https://www.fi.se/sv/vara-register/fondinnehav-per-kvartal/',

  [Parameter(Mandatory = $false)]
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$index = Invoke-WebRequest -Uri $IndexUrl -UseBasicParsing
$pattern = 'href="(?<href>[^"]*FondInnehavLista/download\?filnamn=Fondinnehav_(?<year>\d{4})Q(?<quarter>[1-4])_(?<published>\d{4}-\d{2}-\d{2})(?:\+|%20| )(?<time>\d{2}\.\d{2})\.zip)"'
$matches = [regex]::Matches($index.Content, $pattern, [Text.RegularExpressions.RegexOptions]::IgnoreCase)
if ($matches.Count -eq 0) {
  throw 'No FI quarterly holdings archives were found on the official index page'
}

$latest = $matches | ForEach-Object {
  [pscustomobject]@{
    href = $_.Groups['href'].Value.Replace('&amp;', '&')
    year = [int]$_.Groups['year'].Value
    quarter = [int]$_.Groups['quarter'].Value
    publishedAt = $_.Groups['published'].Value
    time = $_.Groups['time'].Value
  }
} | Sort-Object -Property @{ Expression = 'year'; Descending = $true }, @{ Expression = 'quarter'; Descending = $true }, @{ Expression = 'publishedAt'; Descending = $true }, @{ Expression = 'time'; Descending = $true } | Select-Object -First 1

$archiveName = "Fondinnehav_$($latest.year)Q$($latest.quarter)_$($latest.publishedAt) $($latest.time).zip"
if (!$Force -and (Test-Path -LiteralPath $OutputFile) -and (Test-Path -LiteralPath $ManifestFile)) {
  $current = Get-Content -LiteralPath $OutputFile -Raw | ConvertFrom-Json
  if ($current.source.archiveName -eq $archiveName) {
    Write-Output "FI holdings are already current: $archiveName"
    exit 0
  }
}

$temporaryDirectory = Join-Path ([IO.Path]::GetTempPath()) "supersafe-fi-$([guid]::NewGuid())"
$archivePath = Join-Path $temporaryDirectory 'holdings.zip'
$extractPath = Join-Path $temporaryDirectory 'xml'
$candidatePath = Join-Path $temporaryDirectory 'fi-funds-latest.json'

try {
  New-Item -ItemType Directory -Path $temporaryDirectory, $extractPath | Out-Null
  $downloadUri = [Uri]::new([Uri]$IndexUrl, $latest.href)
  Invoke-WebRequest -Uri $downloadUri -OutFile $archivePath -UseBasicParsing
  if ((Get-Item -LiteralPath $archivePath).Length -lt 100000) {
    throw 'Downloaded FI archive is unexpectedly small'
  }

  Expand-Archive -LiteralPath $archivePath -DestinationPath $extractPath
  & (Join-Path $PSScriptRoot 'import-fi-funds.ps1') `
    -InputDirectory $extractPath `
    -OutputFile $candidatePath `
    -Period "$($latest.year) Q$($latest.quarter)" `
    -PublishedAt $latest.publishedAt `
    -ArchiveName $archiveName `
    -FetchedAt ([DateTimeOffset]::UtcNow.ToString('o')) `
    -SourceUrl $IndexUrl

  $candidate = Get-Content -LiteralPath $candidatePath -Raw | ConvertFrom-Json
  if ($candidate.source.period -ne "$($latest.year) Q$($latest.quarter)" -or $candidate.funds.Count -lt 100) {
    throw 'Generated FI dataset failed validation'
  }

  if (Test-Path -LiteralPath $OutputFile) {
    $current = Get-Content -LiteralPath $OutputFile -Raw | ConvertFrom-Json
    if ([DateTime]$candidate.source.reportDate -lt [DateTime]$current.source.reportDate) {
      throw 'Generated FI dataset is older than the currently published dataset'
    }
  }

  $outputDirectory = Split-Path -Parent $OutputFile
  New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
  Copy-Item -LiteralPath $candidatePath -Destination $OutputFile -Force
  $manifestDirectory = Split-Path -Parent $ManifestFile
  New-Item -ItemType Directory -Force -Path $manifestDirectory | Out-Null
  $manifestJson = $candidate.source | ConvertTo-Json -Compress
  [IO.File]::WriteAllText($ManifestFile, $manifestJson, [Text.UTF8Encoding]::new($false))
  Write-Output "Updated FI holdings from $archiveName"
}
finally {
  if (Test-Path -LiteralPath $temporaryDirectory) {
    Remove-Item -LiteralPath $temporaryDirectory -Recurse -Force
  }
}
