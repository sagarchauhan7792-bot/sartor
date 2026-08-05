# Generates Sartor PWA icons (ivory background, serif "S") using System.Drawing.
Add-Type -AssemblyName System.Drawing

$outDir = Join-Path $PSScriptRoot "..\public\icons"
New-Item -ItemType Directory -Force $outDir | Out-Null

foreach ($size in @(192, 512)) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAliasGridFit'
  $g.Clear([System.Drawing.ColorTranslator]::FromHtml("#FAF7F2"))

  # thin bronze ring
  $pen = New-Object System.Drawing.Pen ([System.Drawing.ColorTranslator]::FromHtml("#A4763B")), ([Math]::Max(2, $size * 0.012))
  $m = $size * 0.08
  $g.DrawEllipse($pen, $m, $m, $size - 2 * $m, $size - 2 * $m)

  # serif S
  $font = New-Object System.Drawing.Font("Georgia", ($size * 0.42), [System.Drawing.FontStyle]::Italic)
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.ColorTranslator]::FromHtml("#1C1917"))
  $fmt = New-Object System.Drawing.StringFormat
  $fmt.Alignment = 'Center'
  $fmt.LineAlignment = 'Center'
  $rect = New-Object System.Drawing.RectangleF(0, ($size * -0.02), $size, $size)
  $g.DrawString("S", $font, $brush, $rect, $fmt)

  $path = Join-Path $outDir "icon-$size.png"
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output "wrote $path"
}
