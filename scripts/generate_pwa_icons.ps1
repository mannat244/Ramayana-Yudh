Add-Type -AssemblyName System.Drawing

function Create-SquareIcon {
    param(
        [string]$SourcePath,
        [string]$DestPath,
        [int]$Size,
        [bool]$IsMaskable = $false
    )
    $src = [System.Drawing.Image]::FromFile($SourcePath)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    
    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    
    # Fill background with game dark celestial theme #0a0c18
    $bgBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 10, 12, 24))
    $gfx.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    
    # If not maskable, draw a subtle golden celestial circular glow / border ring
    if (-not $IsMaskable) {
        $goldColor = [System.Drawing.Color]::FromArgb(70, 212, 175, 55)
        $penWidth = [float]($Size * 0.02)
        $goldPen = New-Object System.Drawing.Pen -ArgumentList @($goldColor, $penWidth)
        $margin = [float]($Size * 0.04)
        $gfx.DrawEllipse($goldPen, $margin, $margin, [float]($Size - 2 * $margin), [float]($Size - 2 * $margin))
        $goldPen.Dispose()
    }
    
    # Calculate scaled dimensions for Logo to fit nicely with padding inside the square
    # Maskable icons require larger padding (minimum 20% safe zone) so the logo isn't clipped by circular masks
    $paddingRatio = if ($IsMaskable) { 0.22 } else { 0.12 }
    $padding = [int]($Size * $paddingRatio)
    $availW = $Size - (2 * $padding)
    $availH = $Size - (2 * $padding)
    
    $scale = [Math]::Min([double]$availW / $src.Width, [double]$availH / $src.Height)
    $drawW = [int]($src.Width * $scale)
    $drawH = [int]($src.Height * $scale)
    
    $drawX = [int](($Size - $drawW) / 2)
    $drawY = [int](($Size - $drawH) / 2)
    
    $gfx.DrawImage($src, $drawX, $drawY, $drawW, $drawH)
    
    $bmp.Save($DestPath, [System.Drawing.Imaging.ImageFormat]::Png)
    
    $gfx.Dispose()
    $bgBrush.Dispose()
    $bmp.Dispose()
    $src.Dispose()
    Write-Host "Created $DestPath ($Size x $Size, Maskable: $IsMaskable)"
}

New-Item -ItemType Directory -Force -Path "public\icons" | Out-Null
Create-SquareIcon -SourcePath "public\assets\Main Menu\Logo.png" -DestPath "public\icons\icon-192.png" -Size 192 -IsMaskable $false
Create-SquareIcon -SourcePath "public\assets\Main Menu\Logo.png" -DestPath "public\icons\icon-512.png" -Size 512 -IsMaskable $false
Create-SquareIcon -SourcePath "public\assets\Main Menu\Logo.png" -DestPath "public\icons\icon-maskable-192.png" -Size 192 -IsMaskable $true
Create-SquareIcon -SourcePath "public\assets\Main Menu\Logo.png" -DestPath "public\icons\icon-maskable-512.png" -Size 512 -IsMaskable $true
