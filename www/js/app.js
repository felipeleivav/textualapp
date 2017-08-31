angular.module('starter', ['ngCordova', 'ionic', 'monospaced.elastic', 'starter.controllers', 'starter.services'])

.run(function($ionicPlatform) {
  $ionicPlatform.ready(function() {
    if(window.cordova && window.cordova.plugins.Keyboard) {
      // Hide the accessory bar by default (remove this to show the accessory bar above the keyboard
      // for form inputs)
      cordova.plugins.Keyboard.hideKeyboardAccessoryBar(true);

      // Don't remove this line unless you know what you are doing. It stops the viewport
      // from snapping when text inputs are focused. Ionic handles this internally for
      // a much nicer keyboard experience.
      cordova.plugins.Keyboard.disableScroll(true);
    }
    if(window.StatusBar) {
      StatusBar.overlaysWebView(false);
      //StatusBar.backgroundColorByHexString('#aaa');
      //StatusBar.styleDefault();
    }
  });
})

.run(function($q, DB, Utils, UI, State, AuthService) {
  return DB.init().then(function(res) {
    var ep = Utils.getEndpoint().then(function(result) {
      console.log(result);
      Utils.restEndpoint = result;
      return AuthService.isLoggedin().then(function(logged) {
        if (logged) {
          return AuthService.validateDbUser().then(function(res) {
            if (res===true || res===false) {
              return AuthService.getUsername().then(function(username) {
                AuthService.userlogged = username;
              });
            } else if (res===-1) {
              return AuthService.logout().then(function() {
                UI.toast("Can't authenticate; logged out");
              });
            }
          });
        }
      });
    });
    State.synchroFlag = true;
    var cm = UI.getColorMode().then(function(colorMode) {
      UI.mode = colorMode;
      UI.setMode();
    });
    return $q.all([ep,cm]).then(function (res) {
      return 1;
    })
  });
})

.config(function($stateProvider, $urlRouterProvider, $ionicConfigProvider, $ionicNativeTransitionsProvider) {
  $ionicConfigProvider.scrolling.jsScrolling(false);

  $stateProvider

  .state('main', {
    url: '/main',
    templateUrl: 'templates/main.html',
    controller: 'mainCtrl'
  })

  .state('note', {
    url: '/note',
    templateUrl: 'templates/note.html',
    controller: 'noteCtrl'
  })

  .state('login', {
    url: '/login',
    templateUrl: 'templates/login.html',
    controller: 'loginCtrl'
  })

  .state('register', {
    url: '/register',
    templateUrl: 'templates/register.html',
    controller: 'registerCtrl'
  })

  .state('settings', {
    url: '/settings',
    templateUrl: 'templates/settings.html',
    controller: 'settingsCtrl'
  })

  .state('requests', {
    url: "/requests",
    templateUrl: 'templates/requests.html',
    controller: 'requestsCtrl'
  })

  .state('noterequests', {
    url: "/noterequests",
    templateUrl: 'templates/noterequests.html',
    controller: 'noteRequestsCtrl'
  });

  $urlRouterProvider.otherwise('/main');

  $ionicNativeTransitionsProvider.setDefaultTransition({
    type: 'fade',
    duration: 500
  });

  $ionicNativeTransitionsProvider.setDefaultBackTransition({
    type: 'fade',
    duration: 500
  });
})
