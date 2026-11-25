$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$dir = Join-Path $PSScriptRoot '..\build\branding'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
function Color($hex) { [Drawing.ColorTranslator]::FromHtml($hex) }
function Canvas($w,$h) {
  $b = [Drawing.Bitmap]::new($w,$h,[Drawing.Imaging.PixelFormat]::Format24bppRgb)
  $g = [Drawing.Graphics]::FromImage($b)
  $g.SmoothingMode = [Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.TextRenderingHint = [Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $g.Clear((Color '#101012'))
  return @($b,$g)
}
$card=[Drawing.Image]::FromFile((Join-Path $PSScriptRoot '..\src\renderer\src\assets\pssa-card.png'))
function Mark($g,$x,$y,$size) {
  $w=[single]($size*$card.Width/$card.Height)
  $g.InterpolationMode=[Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($card,[Drawing.RectangleF]::new([single]($x+($size-$w)/2),[single]$y,$w,[single]$size))
}
function Label($g,$text,$size,$hex,$x,$y,$w) {
  $font=[Drawing.Font]::new('Segoe UI',[single]$size,[Drawing.FontStyle]::Bold,[Drawing.GraphicsUnit]::Pixel)
  $brush=[Drawing.SolidBrush]::new((Color $hex))
  $fmt=[Drawing.StringFormat]::new();$fmt.Alignment=[Drawing.StringAlignment]::Center
  $g.DrawString($text,$font,$brush,[Drawing.RectangleF]::new($x,$y,$w,45),$fmt)
  $fmt.Dispose();$brush.Dispose();$font.Dispose()
}
$canvas=Canvas 164 314; $b=$canvas[0];$g=$canvas[1]
Mark $g 28 64 108
Label $g 'PSSA' 27 '#e3c048' 0 191 164
Label $g 'STREAM ALERTS' 11 '#e9e4d6' 0 226 164
Label $g 'PAN SZCZESNIAK' 10 '#a49d8e' 0 282 164
$g.Dispose();$b.Save((Join-Path $dir 'sidebar.bmp'),[Drawing.Imaging.ImageFormat]::Bmp);$b.Dispose()
$canvas=Canvas 150 57;$b=$canvas[0];$g=$canvas[1]
Mark $g 4 5 47
Label $g 'PSSA' 19 '#e3c048' 52 9 94
Label $g 'STREAM ALERTS' 9 '#e9e4d6' 52 32 94
$g.Dispose();$b.Save((Join-Path $dir 'header.bmp'),[Drawing.Imaging.ImageFormat]::Bmp);$b.Dispose()
# PNG-compressed Windows icon, 256x256 plus smaller sizes for Explorer/taskbar.
$images=@()
foreach($size in @(16,32,48,64,128,256)) {
  $canvas=Canvas $size $size;$b=$canvas[0];$g=$canvas[1]
  Mark $g 0 0 $size
  $g.Dispose()
  if($size -eq 64){$b.Save((Join-Path $dir 'pssa-window.png'),[Drawing.Imaging.ImageFormat]::Png)}
  $ms=[IO.MemoryStream]::new()
  $b.Save($ms,[Drawing.Imaging.ImageFormat]::Png)
  $images+=@(@{size=$size;bytes=$ms.ToArray()})
  $ms.Dispose();$b.Dispose()
}
$stream=[IO.File]::Create((Join-Path $dir 'pssa.ico'))
$writer=[IO.BinaryWriter]::new($stream)
try{
  $writer.Write([uint16]0);$writer.Write([uint16]1);$writer.Write([uint16]$images.Count)
  $offset=6+16*$images.Count
  foreach($image in $images){
    $dim=$image.size % 256
    $writer.Write([byte]$dim);$writer.Write([byte]$dim);$writer.Write([byte]0);$writer.Write([byte]0)
    $writer.Write([uint16]1);$writer.Write([uint16]32);$writer.Write([uint32]$image.bytes.Length);$writer.Write([uint32]$offset)
    $offset+=$image.bytes.Length
  }
  foreach($image in $images){$writer.Write([byte[]]$image.bytes)}
} finally {$writer.Dispose();$card.Dispose()}
