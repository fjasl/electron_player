# ... (前面的配置和 NPM 检查代码保持不变) ...
$nodeDir = "nodeP"
$registry = "https://registry.npmmirror.com"
$rootDir = $PSScriptRoot
$pluginsRoot = Join-Path $rootDir "plugins"

Write-Host "[INFO] Configuring environment variables, using portable Node/NPM..." -ForegroundColor Cyan
$env:Path = "$rootDir\$nodeDir;" + $env:Path
# ... (NPM 检查代码保持不变) ...

Write-Host "[INFO] Scanning plugins directory and installing dependencies..." -ForegroundColor Cyan

$pluginDirs = Get-ChildItem -Path $pluginsRoot -Directory 
$totalPlugins = $pluginDirs.Count
$pluginIndex = 0

foreach ($dir in $pluginDirs) {
    $pluginIndex++
    $pluginName = $dir.Name
    $packageListPath = Join-Path $dir.FullName "package_list.txt"
    
    # --- DEBUG LINE: Print the full path being checked ---
    Write-Host "[DEBUG] Checking for file: $packageListPath" -ForegroundColor DarkCyan
    # ----------------------------------------------------

    Write-Progress -Activity "Installing Plugin Dependencies" -Status "Processing plugin: $pluginName ($pluginIndex/$totalPlugins)" -PercentComplete (($pluginIndex / $totalPlugins) * 100)

    if (Test-Path $packageListPath) {
        # ... (文件找到后的安装逻辑保持不变) ...
        Write-Host "--- Found plugin: $pluginName ---" -ForegroundColor Green
        
        # 读取并解析自定义的文本文件
        $packages = Get-Content $packageListPath | Where-Object { $_ -match '\S' } # Filter out empty lines
        
        if ($packages.Count -gt 0) {
            Write-Host "  Will install the following packages: $($packages -join ', ')" -ForegroundColor Yellow
            
            $installArgs = @("install", "--registry=$registry", $packages)
            Push-Location $dir.FullName
            npm @installArgs 2>&1 | Write-Host
            Pop-Location
            
            Write-Host "  [$pluginName] Installation complete." -ForegroundColor Green
        } else {
             Write-Host "  [$pluginName] package_list.txt is empty, skipping installation." -ForegroundColor DarkYellow
        }

    } else {
        Write-Host "--- Skipping [$pluginName] --- package_list.txt not found" -ForegroundColor DarkGray
    }
}

Write-Progress -Activity "Installing Plugin Dependencies" -Status "All plugin dependencies processed." -Completed
Write-Host "---------------------------------------" -ForegroundColor Cyan
Write-Host "[Finish] All plugin dependencies processed." -ForegroundColor Cyan

Read-Host -Prompt "Press any key to exit"
