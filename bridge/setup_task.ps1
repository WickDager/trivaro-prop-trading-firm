<#
.SYNOPSIS
  Creates a Windows Scheduled Task that runs the MT5 bridge on system startup.

.DESCRIPTION
  The task runs mt5_bridge.py at boot and restarts every 5 minutes if it
  crashes. It runs whether the user is logged in or not (requires the
  SYSTEM account or a service account with "Run whether user is logged on"
  permission).

  Run this script as Administrator.

.EXAMPLE
  powershell -ExecutionPolicy Bypass -File setup_task.ps1
#>

$ErrorActionPreference = "Stop"

$BridgeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$PythonExe = (Get-Command python).Source
$ScriptPath = Join-Path $BridgeDir "mt5_bridge.py"
$ConfigPath = Join-Path $BridgeDir "config.json"
$LogDir = $BridgeDir

$TaskName = "TrivaroMT5Bridge"
$Action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "`"$ScriptPath`" --config `"$ConfigPath`"" `
    -WorkingDirectory $BridgeDir

$Trigger = New-ScheduledTaskTrigger -AtStartup

$Settings = New-ScheduledTaskSettingsSet `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -RestartCount 999 `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -AllowStartIfOnBatteries `
    -MultipleInstances IgnoreNew

$Principal = New-ScheduledTaskPrincipal `
    -UserID "NT AUTHORITY\SYSTEM" `
    -LogonType ServiceAccount `
    -RunLevel Highest

try {
    Register-ScheduledTask `
        -TaskName $TaskName `
        -Action $Action `
        -Trigger $Trigger `
        -Settings $Settings `
        -Principal $Principal `
        -Force
    Write-Host "Scheduled task '$TaskName' created successfully." -ForegroundColor Green
    Write-Host "Bridge dir: $BridgeDir"
    Write-Host "The task will start on next reboot. To start now:"
    Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host "`nMake sure to run this script as Administrator." -ForegroundColor Yellow
    exit 1
}
