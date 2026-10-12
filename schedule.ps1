# Registers the weekly "TeeTimeBot" task: every Friday at 7:57 AM, and it
# wakes the computer from sleep to run. Called by SETUP.bat.
$ErrorActionPreference = 'Stop'
$dir  = $PSScriptRoot
$node = (Get-Command node).Source

$action    = New-ScheduledTaskAction -Execute 'cmd.exe' -Argument "/c `"`"$node`" bot.js >> bot.log 2>&1`"" -WorkingDirectory $dir
$trigger   = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Friday -At '7:57AM'
$settings  = New-ScheduledTaskSettingsSet -WakeToRun -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Hours 1)
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName 'TeeTimeBot' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null

$next = (Get-ScheduledTaskInfo -TaskName 'TeeTimeBot').NextRunTime
Write-Host " Scheduled. Next run: $next"
