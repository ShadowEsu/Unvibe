; Picked up by electron-builder's NSIS build (buildResources/installer.nsh).
; A one-click per-user install defaults to $LOCALAPPDATA\Programs\<package name>, which is "unvibe-app",
; while the 0.1.49 assisted installer used Programs\Unvibe. Before the installer reads the recorded
; location (initMultiUser), point a first install at Programs\Unvibe, where earlier installs live and
; where install.ps1 starts the app. A location an earlier install recorded is left as it is, and /D= still wins.
!macro preInit
  !ifndef BUILD_UNINSTALLER
    Push $0
    ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
    ${if} $0 == ""
      WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\Unvibe"
    ${endIf}
    Pop $0
  !endif
!macroend
