param(
    [int]$Port = 8787
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath($PSScriptRoot)
$MimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".ico"  = "image/x-icon"
}

$Server = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
$Server.Start()
$Address = "http://localhost:$Port/"

Write-Host ""
Write-Host "  Home Dashboard läuft auf $Address" -ForegroundColor Cyan
Write-Host "  Dieses Fenster offen lassen. Zum Beenden Strg+C drücken." -ForegroundColor DarkGray
Write-Host ""

Start-Process $Address

try {
    while ($true) {
        $Client = $Server.AcceptTcpClient()
        try {
            $Stream = $Client.GetStream()
            $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
            $RequestLine = $Reader.ReadLine()

            while (($HeaderLine = $Reader.ReadLine()) -ne "" -and $null -ne $HeaderLine) { }

            $Status = "200 OK"
            $ContentType = "text/plain; charset=utf-8"
            $Body = [byte[]]@()

            if ($RequestLine -match "^GET\s+([^\s]+)") {
                $RequestPath = [System.Uri]::UnescapeDataString(($Matches[1] -split "\?")[0])
                if ($RequestPath -eq "/") { $RequestPath = "/index.html" }

                $RelativePath = $RequestPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
                $FilePath = [System.IO.Path]::GetFullPath((Join-Path $ProjectRoot $RelativePath))

                if (-not $FilePath.StartsWith($ProjectRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
                    $Status = "403 Forbidden"
                    $Body = [System.Text.Encoding]::UTF8.GetBytes("Zugriff verweigert")
                }
                elseif (Test-Path -LiteralPath $FilePath -PathType Leaf) {
                    $Extension = [System.IO.Path]::GetExtension($FilePath).ToLowerInvariant()
                    if ($MimeTypes.ContainsKey($Extension)) { $ContentType = $MimeTypes[$Extension] }
                    else { $ContentType = "application/octet-stream" }
                    $Body = [System.IO.File]::ReadAllBytes($FilePath)
                }
                else {
                    $Status = "404 Not Found"
                    $Body = [System.Text.Encoding]::UTF8.GetBytes("Datei nicht gefunden")
                }
            }
            else {
                $Status = "405 Method Not Allowed"
                $Body = [System.Text.Encoding]::UTF8.GetBytes("Methode nicht erlaubt")
            }

            $Header = "HTTP/1.1 $Status`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nCache-Control: no-cache`r`nConnection: close`r`n`r`n"
            $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
            $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
            if ($Body.Length -gt 0) { $Stream.Write($Body, 0, $Body.Length) }
            $Stream.Flush()
        }
        catch {
            Write-Warning "Anfrage konnte nicht verarbeitet werden: $($_.Exception.Message)"
        }
        finally {
            $Client.Dispose()
        }
    }
}
finally {
    $Server.Stop()
}
