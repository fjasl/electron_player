# =================================================================
# 插件依赖自动安装脚本 (多镜像源自动重试版)
# =================================================================

$nodeDir = "nodeP"
$rootDir = $PSScriptRoot
$pluginsRoot = Join-Path $rootDir "plugins"

# 1. 定义国内镜像源列表（按推荐顺序排列）
$registries = @(
    "https://registry.npmmirror.com",          # 阿里云 (首选)
    "mirrors.cloud.tencent.com",   # 腾讯云
    "repo.huaweicloud.com", # 华为云
    "https://registry.npmjs.org"               # 官方源 (保底)
)

# 2. 配置环境变量，使用便携版 Node/NPM
Write-Host "[INFO] Configuring environment variables..." -ForegroundColor Cyan
$env:Path = "$rootDir\$nodeDir;" + $env:Path

# 3. 检查 NPM 是否可用
try {
    $npmVersion = npm -v 2>$null
    Write-Host "[INFO] NPM Detected (Version: $npmVersion)" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] NPM not found in $nodeDir. Please check your setup." -ForegroundColor Red
    Read-Host "Press any key to exit"
    exit
}

# 4. 扫描插件目录
if (-not (Test-Path $pluginsRoot)) {
    Write-Host "[ERROR] Plugins directory not found: $pluginsRoot" -ForegroundColor Red
    Read-Host "Press any key to exit"
    exit
}

$pluginDirs = Get-ChildItem -Path $pluginsRoot -Directory 
$totalPlugins = $pluginDirs.Count
$pluginIndex = 0

Write-Host "[INFO] Found $totalPlugins plugins. Starting installation..." -ForegroundColor Cyan

foreach ($dir in $pluginDirs) {
    $pluginIndex++
    $pluginName = $dir.Name
    $packageListPath = Join-Path $dir.FullName "package_list.txt"
    
    Write-Progress -Activity "Installing Plugin Dependencies" `
                   -Status "Processing: $pluginName ($pluginIndex/$totalPlugins)" `
                   -PercentComplete (($pluginIndex / $totalPlugins) * 100)

    if (Test-Path $packageListPath) {
        Write-Host "--- Checking plugin: $pluginName ---" -ForegroundColor Green
        
        # 读取并解析配置文件（过滤空行）
        $packages = Get-Content $packageListPath | Where-Object { $_ -match '\S' }
        
        if ($packages.Count -gt 0) {
            Write-Host "  Required: $($packages -join ', ')" -ForegroundColor Yellow
            
            $isInstalled = $false
            
            # --- 核心：多源重试逻辑 ---
            foreach ($reg in $registries) {
                Write-Host "  [TRY] Using registry: $reg" -ForegroundColor Gray
                
                Push-Location $dir.FullName
                # --no-audit 和 --no-fund 可显著提升安装速度并减少报错
                $installArgs = @("install", "--registry=$reg", "--no-audit", "--no-fund", $packages)
                
                # 执行安装
                npm @installArgs
                
                # 检查上一步执行结果 ($LASTEXITCODE 为 0 表示成功)
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "  [SUCCESS] $pluginName dependencies installed." -ForegroundColor Green
                    $isInstalled = $true
                    Pop-Location
                    break # 成功后跳出当前源的循环
                } else {
                    Write-Warning "  [FAILED] Installation failed with this registry. Trying next..."
                    Pop-Location
                }
            }
            # -----------------------

            if (-not $isInstalled) {
                Write-Host "  [FATAL] All registries failed for $pluginName. Please check network or package names." -ForegroundColor Red
            }

        } else {
            Write-Host "  [$pluginName] package_list.txt is empty, skipping." -ForegroundColor DarkYellow
        }
    } else {
        Write-Host "--- Skipping [$pluginName] --- package_list.txt not found" -ForegroundColor DarkGray
    }
}

Write-Progress -Activity "Installing Plugin Dependencies" -Status "All done!" -Completed
Write-Host "---------------------------------------" -ForegroundColor Cyan
Write-Host "[Finish] All plugin dependencies processed." -ForegroundColor Cyan

Read-Host -Prompt "Press any key to exit"
