param(
  [Parameter(Mandatory = $true)]
  [string]$InputDirectory,

  [Parameter(Mandatory = $true)]
  [string]$OutputFile,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d{4} Q[1-4]$')]
  [string]$Period,

  [Parameter(Mandatory = $true)]
  [ValidatePattern('^\d{4}-\d{2}-\d{2}$')]
  [string]$PublishedAt,

  [Parameter(Mandatory = $true)]
  [string]$ArchiveName,

  [Parameter(Mandatory = $false)]
  [string]$FetchedAt = [DateTimeOffset]::UtcNow.ToString('o'),

  [Parameter(Mandatory = $false)]
  [string]$SourceUrl = 'https://www.fi.se/sv/vara-register/fondinnehav-per-kvartal/'
)

$ErrorActionPreference = 'Stop'

function Get-NodeText {
  param(
    [System.Xml.XmlNode]$Node,
    [string]$LocalName
  )

  $match = $Node.SelectSingleNode(".//*[local-name()='$LocalName']")
  if ($null -eq $match) { return $null }
  return $match.InnerText.Trim()
}

function Convert-ToNumber {
  param([string]$Value)

  if ([string]::IsNullOrWhiteSpace($Value)) { return 0.0 }
  return [double]::Parse($Value, [Globalization.CultureInfo]::InvariantCulture)
}

$funds = foreach ($file in Get-ChildItem -LiteralPath $InputDirectory -Recurse -Filter '*.xml') {
  [xml]$document = Get-Content -LiteralPath $file.FullName -Raw
  $fundInfo = $document.SelectSingleNode("//*[local-name()='Fondinformation']")
  $companyInfo = $document.SelectSingleNode("//*[local-name()='Bolagsinformation']")
  $reportInfo = $document.SelectSingleNode("//*[local-name()='Rapportinformation']")

  if ($null -eq $fundInfo) { continue }

  $fundName = Get-NodeText $fundInfo 'Fond_namn'
  $fundIsin = Get-NodeText $fundInfo 'Fond_ISIN-kod'
  $fundId = Get-NodeText $fundInfo 'Fond_institutnummer'
  $fundWealth = Convert-ToNumber (Get-NodeText $fundInfo 'Fondförmögenhet')
  $cash = Convert-ToNumber (Get-NodeText $fundInfo 'Likvida_medel')

  $allHoldings = foreach ($instrument in $fundInfo.SelectNodes(".//*[local-name()='FinansielltInstrument']")) {
    $weight = Convert-ToNumber (Get-NodeText $instrument 'Andel_av_fondförmögenhet_instrument')
    if ($weight -le 0) { continue }

    [pscustomobject][ordered]@{
      name = Get-NodeText $instrument 'Instrumentnamn'
      isin = Get-NodeText $instrument 'ISIN-kod_instrument'
      country = Get-NodeText $instrument 'Landkod_Emittent'
      currency = Get-NodeText $instrument 'Valuta'
      assetClass = Get-NodeText $instrument 'Tillgångsslag_enligt_LVF_5_kap'
      weight = [Math]::Round($weight, 4)
      marketValue = [Math]::Round((Convert-ToNumber (Get-NodeText $instrument 'Marknadsvärde_instrument')), 2)
    }
  }

  $sortedHoldings = @($allHoldings | Sort-Object -Property @{ Expression = 'weight'; Descending = $true })
  if ($sortedHoldings.Count -eq 0) { continue }
  $topHoldings = @($sortedHoldings | Select-Object -First 20)
  $topTenWeight = [Math]::Round((($sortedHoldings | Select-Object -First 10 | Measure-Object -Property weight -Sum).Sum), 2)

  [pscustomobject][ordered]@{
    id = if ($fundIsin) { $fundIsin } else { "FI-$fundId" }
    name = $fundName
    isin = $fundIsin
    company = Get-NodeText $companyInfo 'Fondbolag_namn'
    instituteNumber = $fundId
    reportDate = Get-NodeText $reportInfo 'Kvartalsslut'
    holdingsCount = $sortedHoldings.Count
    fundWealth = [Math]::Round($fundWealth, 2)
    cashWeight = if ($fundWealth -gt 0) { [Math]::Round(($cash / $fundWealth) * 100, 2) } else { 0 }
    displayedWeight = [Math]::Round((($topHoldings | Measure-Object -Property weight -Sum).Sum), 2)
    topTenWeight = $topTenWeight
    holdings = $topHoldings
  }
}

$fundList = @($funds | Sort-Object -Property name)
if ($fundList.Count -lt 100) {
  throw "Import rejected: only $($fundList.Count) funds were parsed"
}

$reportDates = @($fundList.reportDate | Where-Object { $_ } | Sort-Object -Unique)
if ($reportDates.Count -ne 1 -or $reportDates[0] -notmatch '^\d{4}-\d{2}-\d{2}$') {
  throw "Import rejected: expected one valid report date, got $($reportDates -join ', ')"
}

$dataset = [pscustomobject][ordered]@{
  source = [ordered]@{
    name = 'Finansinspektionen'
    period = $Period
    reportDate = $reportDates[0]
    publishedAt = $PublishedAt
    fetchedAt = $FetchedAt
    archiveName = $ArchiveName
    url = $SourceUrl
  }
  funds = $fundList
}

$outputDirectory = Split-Path -Parent $OutputFile
New-Item -ItemType Directory -Force -Path $outputDirectory | Out-Null
$json = $dataset | ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText($OutputFile, $json, [Text.UTF8Encoding]::new($false))

Write-Output "Imported $($dataset.funds.Count) funds to $OutputFile"
