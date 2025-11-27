# FFmpeg.wasm 本地下载脚本 (PowerShell)
# 运行方式: 在 lib/ffmpeg 目录下执行 .\download.ps1

Write-Host "开始下载 FFmpeg.wasm 文件..." -ForegroundColor Cyan

# 创建目录
$dirs = @("ffmpeg", "util", "core")
foreach ($dir in $dirs) {
    if (!(Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir | Out-Null
    }
}

# 下载 @ffmpeg/ffmpeg (所有需要的文件)
Write-Host "下载 @ffmpeg/ffmpeg..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js" -OutFile "ffmpeg/index.js"
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/classes.js" -OutFile "ffmpeg/classes.js"
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/const.js" -OutFile "ffmpeg/const.js"
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/types.js" -OutFile "ffmpeg/types.js"
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/worker.js" -OutFile "ffmpeg/worker.js"
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/utils.js" -OutFile "ffmpeg/utils.js"
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/ffmpeg@0.12.10/dist/esm/errors.js" -OutFile "ffmpeg/errors.js"

# 下载 @ffmpeg/util
Write-Host "下载 @ffmpeg/util..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/util@0.12.1/dist/esm/index.js" -OutFile "util/index.js"

# 下载 @ffmpeg/core
Write-Host "下载 @ffmpeg/core (这可能需要一些时间)..." -ForegroundColor Yellow
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js" -OutFile "core/ffmpeg-core.js"
Invoke-WebRequest -Uri "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm" -OutFile "core/ffmpeg-core.wasm"

Write-Host "下载完成!" -ForegroundColor Green
Write-Host "文件已保存到 lib/ffmpeg/ 目录" -ForegroundColor Green
