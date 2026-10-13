# Keeps the tee-time assistant running; restarts it if it ever stops.
# Started hidden by the "TeeTimeAssistant" task (see schedule.ps1).
Set-Location $PSScriptRoot
$env:PATH = "$env:PATH;$env:ProgramFiles\nodejs"
while ($true) {
  cmd /c "node assistant.js >> assistant.log 2>&1"
  Start-Sleep -Seconds 10
}
