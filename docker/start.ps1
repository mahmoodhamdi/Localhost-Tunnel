# PowerShell script to start localhost-tunnel with automatic port detection
# Usage: .\start.ps1 [-WebPort 3000] [-TunnelPort 7000]

param(
    [int]$WebPort = 3000,
    [int]$TunnelPort = 7000,
    [int]$MaxRetries = 10
)

function Test-PortInUse {
    param([int]$Port)
    $connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return ($null -ne $connections)
}

function Find-AvailablePort {
    param([int]$StartPort, [int]$MaxRetries)
    for ($i = 0; $i -lt $MaxRetries; $i++) {
        $port = $StartPort + $i
        if (-not (Test-PortInUse -Port $port)) {
            return $port
        }
        Write-Host "Port $port is busy, trying next..." -ForegroundColor Yellow
    }
    throw "Could not find available port in range $StartPort-$($StartPort + $MaxRetries - 1)"
}

Write-Host "Starting Localhost Tunnel..." -ForegroundColor Cyan

# Find available ports
$actualWebPort = Find-AvailablePort -StartPort $WebPort -MaxRetries $MaxRetries
$actualTunnelPort = Find-AvailablePort -StartPort $TunnelPort -MaxRetries $MaxRetries

Write-Host "Using ports: Web=$actualWebPort, Tunnel=$actualTunnelPort" -ForegroundColor Green

# Set environment variables and start docker-compose
$env:WEB_PORT = $actualWebPort
$env:TUNNEL_PORT = $actualTunnelPort

Push-Location $PSScriptRoot
try {
    docker-compose up -d
    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "Localhost Tunnel is running!" -ForegroundColor Green
        Write-Host "  Web UI:     http://localhost:$actualWebPort" -ForegroundColor Yellow
        Write-Host "  Tunnel:     ws://localhost:$actualTunnelPort" -ForegroundColor Yellow
        Write-Host ""
        Write-Host "To view logs: docker logs -f localhost-tunnel" -ForegroundColor Gray
        Write-Host "To stop:      docker-compose down" -ForegroundColor Gray
    }
} finally {
    Pop-Location
}
