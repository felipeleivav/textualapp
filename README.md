# Textual App
Textual is a simple note taking app based on Ionic v1 (angularjs).

Textual can save and synchronize your notes against the textual server and share notes with other users registered in the same server.

This repository contains the ionic sources only. You can set up your own textual server so you can save your notes and share them with your friends.

REST server repository is here:
- https://github.com/selknam/textualservice

You can install Textual from Google Play:
- https://play.google.com/store/apps/details?id=com.ionicframework.teamnote109747

Compiling instructions
`````
git clone https://github.com/selknam/textualapp.git
ionic start . --no-overwriting
ionic cordova build android
`````

Feature roadmap:
- Regularize popup styles and transitions
- Encrypt local passwords
- Include i18n library
- E2E encryption
- Autobackup, import and export options
- Cross-server note sharing

Any contribution, suggest and bug report is welcome.

Mail: selknam91@gmail.com