; Gives the Start menu and desktop shortcuts the Venus icon WITHOUT editing
; Venus CRM.exe. The exe is deliberately left byte-identical to Electron's
; stock binary (package.json: "signAndEditExecutable": false): rewriting its
; icon makes a never-seen-before unsigned exe, which Windows Smart App Control
; blocks outright. The taskbar takes its icon from these shortcuts (same
; AppUserModelID as the running app), so it shows the Venus icon too.
;
; Runs after electron-builder has created the shortcuts; re-creates them with
; the same target and AUMID, only pointing the icon at resources\icon.ico.
!macro customInstall
  IfFileExists "$newStartMenuLink" 0 +3
    CreateShortCut "$newStartMenuLink" "$appExe" "" "$INSTDIR\resources\icon.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
  IfFileExists "$newDesktopLink" 0 +3
    CreateShortCut "$newDesktopLink" "$appExe" "" "$INSTDIR\resources\icon.ico" 0 "" "" "${APP_DESCRIPTION}"
    WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"

  ; Watchdog: relaunches the agent if it isn't running, independent of the
  ; "open at login" entry the app sets for itself (app.setLoginItemSettings),
  ; which only fires once at sign-in and does nothing if that entry is
  ; deleted or the process is later killed (Task Manager, "End task"). Two
  ; scheduled tasks: one fires at every logon, the other every 5 minutes for
  ; as long as the machine is on, so a killed/ended process comes back within
  ; a few minutes rather than staying down until someone manually reopens it.
  ; Safe to fire while the app is already running -- main.ts's single-instance
  ; lock makes the new launch just quit itself immediately, and the --watchdog
  ; flag tells the running app not to bring its window forward (see
  ; app.requestSingleInstanceLock() in main.ts).
  nsExec::ExecToLog `schtasks /Create /F /SC ONLOGON /TN "VenusCRMAgentWatchdogLogon" /TR "\"$appExe\" --watchdog" /RL LIMITED`
  nsExec::ExecToLog `schtasks /Create /F /SC MINUTE /MO 5 /TN "VenusCRMAgentWatchdog" /TR "\"$appExe\" --watchdog" /RL LIMITED`
!macroend

!macro customUnInstall
  nsExec::ExecToLog `schtasks /Delete /F /TN "VenusCRMAgentWatchdogLogon"`
  nsExec::ExecToLog `schtasks /Delete /F /TN "VenusCRMAgentWatchdog"`
!macroend
