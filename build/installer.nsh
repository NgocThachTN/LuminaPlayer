!macro customInstall
  DetailPrint "Installing LDAC Bluetooth Driver..."
  
  ; Check if the driver files exist
  IfFileExists "$INSTDIR\driver\LdacAudio.inf" 0 +4
    DetailPrint "Found LDAC Driver. Installing via PnPUtil..."
    ; Install the driver
    ExecWait 'pnputil /add-driver "$INSTDIR\driver\LdacAudio.inf" /install'
    DetailPrint "LDAC Driver installation attempted."
    Goto +2
  
  DetailPrint "LDAC Driver source not found. Skipping."
!macroend
