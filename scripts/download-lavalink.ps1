param(
  [string]$Version = "4.2.2"
)

$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$destination = Join-Path $root "lavalink\Lavalink.jar"
$url = "https://github.com/lavalink-devs/Lavalink/releases/download/$Version/Lavalink.jar"

New-Item -ItemType Directory -Force (Split-Path -Parent $destination) | Out-Null
Write-Host "Descargando Lavalink $Version..."
Invoke-WebRequest -Uri $url -OutFile $destination
Write-Host "Lavalink listo en $destination"
