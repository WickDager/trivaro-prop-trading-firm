<#
.SYNOPSIS
  Creates a Windows Scheduled Task that runs the MT5 bridge at logon.

.DESCRIPTION
  The task restarts mt5_bridge.py every 5 minutes if it crashes, and no
  execution time limit is imposed so the long-running poll loop is not killed
  mid-cycle.

  IMPORTANT: MetaTrader 5 is a GUI application. It cannot start in session 0,
  so running this task as NT AUTHORITY\SYSTEM ("Run whether user is logged on
  or not") makes mt5.initialize() fail forever and, with a 5-minute restart
  interval, turns the task into a permanent crash loop. The task therefore runs
  as the interactive user with "Run only when user is logged on" — leave that
  user logged in (or use a dedicated auto-logon account) for the bridge to run.

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

# Interactive logon requires a real user account, not a service account.
$CurrentUser = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name

$TaskName = "TrivaroMT5Bridge"
$Action = New-ScheduledTaskAction `
    -Execute $PythonExe `
    -Argument "`"$ScriptPath`" --config `"$ConfigPath`"" `
    -WorkingDirectory $BridgeDir

# AtLogOn is the trigger that actually works with an interactive logon type;
# AtStartup is kept so the task is registered for a session that is restored
# at boot.
$Trigger = @(
    (New-ScheduledTaskTrigger -AtStartup),
    (New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser)
)

# ExecutionTimeLimit 0 = no limit. The 3-day default would kill the bridge
# mid-cycle; the poll loop is meant to run until the machine is shut down.
$Settings = New-ScheduledTaskSettingsSet `
    -RestartInterval (New-TimeSpan -Minutes 5) `
    -RestartCount 999 `
    -ExecutionTimeLimit (New-TimeSpan -Hours 0) `
    -StartWhenAvailable `
    -DontStopOnIdleEnd `
    -AllowStartIfOnBatteries `
    -MultipleInstances IgnoreNew

$Principal = New-ScheduledTaskPrincipal `
    -UserId $CurrentUser `
    -LogonType Interactive `
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
    Write-Host "Runs as $CurrentUser when that user is logged on (MT5 needs a GUI session)."
    Write-Host "The task will start on next logon. To start now:"
    Write-Host "  Start-ScheduledTask -TaskName '$TaskName'"
} catch {
    Write-Host "ERROR: $_" -ForegroundColor Red
    Write-Host "`nMake sure to run this script as Administrator." -ForegroundColor Yellow
    exit 1
}
