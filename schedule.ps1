# Makes the tee-time assistant start automatically (hidden) whenever you sign
# in to Windows, starts it right now, and stops the PC from falling asleep
# while plugged in so it is always ready. Called by SETUP.bat.
# With -StopOnly it just stops a running assistant (SETUP does this first).
param([switch]$StopOnly)
$ErrorActionPreference = 'Stop'
$dir = $PSScriptRoot

Stop-ScheduledTask -TaskName 'TeeTimeAssistant' -ErrorAction SilentlyContinue
Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
  Where-Object { $_.CommandLine -like '*assistant.js*' } |
  ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
if ($StopOnly) { exit 0 }

# The old once-a-week bot is replaced by the assistant
Unregister-ScheduledTask -TaskName 'TeeTimeBot' -Confirm:$false -ErrorAction SilentlyContinue

$action    = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$dir\run-assistant.ps1`"" -WorkingDirectory $dir
$trigger   = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
$settings  = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName 'TeeTimeAssistant' -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
Start-ScheduledTask -TaskName 'TeeTimeAssistant'

# Never sleep while plugged in (the assistant must be awake at 8:00 AM)
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0

Write-Host ' The assistant is running and will start by itself whenever you sign in.'
