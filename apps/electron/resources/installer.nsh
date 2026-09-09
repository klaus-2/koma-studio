!macro customInit
  !ifmacrodef setInstallModePerAllUsers
    !insertmacro setInstallModePerAllUsers
  !endif
  StrCpy $INSTDIR "D:\KŌMA Studio"
  IfFileExists "C:\*.*" 0 +2
    StrCpy $INSTDIR "C:\KŌMA Studio"
!macroend

!macro customUnInstall
  DetailPrint "Closing KŌMA Studio processes..."
  nsExec::ExecToLog 'taskkill /IM "KŌMA Studio.exe" /T /F'
  Pop $0
  nsExec::ExecToLog 'taskkill /IM "mini-backend.exe" /T /F'
  Pop $0
  Sleep 1200

  ; Best-effort cleanup in case file locks prevented default removal.
  RMDir /r "$INSTDIR\resources\mini-backend"
  RMDir /r "$INSTDIR\resources"
!macroend

!macro customUnInit
  DetailPrint "Stopping running processes before uninstall..."
  nsExec::ExecToLog 'taskkill /IM "KŌMA Studio.exe" /T /F'
  Pop $0
  nsExec::ExecToLog 'taskkill /IM "mini-backend.exe" /T /F'
  Pop $0
  Sleep 800
!macroend
