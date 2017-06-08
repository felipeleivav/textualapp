angular.module('starter.controllers',  ['starter.services','angularCSS','ionic-native-transitions'])

.controller('mainCtrl', function($scope, $location, $ionicNativeTransitions, $cordovaVibration, $ionicPopup, State, NoteService, AuthService, NoteREST, UI, $css) {

	$scope.allNotes = [];

	$scope.syncIfAuth = function() {
		AuthService.isLoggedin().then(function(logged) {
			if (logged) {
				NoteREST.synchronize().then(function() {
					$scope.loadNotes();
				});
			}
		});
	};

	$scope.loadNotes = function() {
		NoteService.getAllNotes().then(function (notes) {
 			$scope.allNotes=notes;
		});
	};

	$scope.newNote = function() {
		State.actual='creation';
		$location.path('note');
	};

	$scope.editNote = function(noteId) {
		State.actual='edition';
		State.noteId=noteId;
		$location.path('note');
	};

	$scope.goSettings = function() {
		//$location.path('settings');
		$ionicNativeTransitions.locationUrl('/settings', {
			"type": "fade",
			"duration": 500 
		});
	};

	$scope.faveNote = function(noteId, actualFave, onhold) {
		if (onhold) {
			actualFave = actualFave=='Y'?'N':'Y';
			NoteService.faveNote(noteId,actualFave).then(function(result) {
				document.addEventListener('deviceready',function() {
					$cordovaVibration.vibrate(40);
				}, false);
				$scope.loadNotes();
			});
		}
	};

	$scope.changeMode = function() {
		$css.remove('css/style.'+UI.mode+'.css');
		$css.add('css/style.'+UI.mode+'.css');
		UI.setColorMode(UI.mode);
		if (window.StatusBar) {
			if (UI.mode=='day') {
	  			StatusBar.backgroundColorByHexString('#aaa');
			} else {
	  			StatusBar.backgroundColorByHexString('#444');
			}
		}
	};

	$scope.synchronize = function() {
		NoteREST.synchronize().then(function() {
			$scope.loadNotes();
			UI.toast("Synchronized!");
		});
	};

	$scope.$on("$ionicView.beforeEnter", function(event, data) {
		$scope.loadNotes();
		AuthService.isLoggedin().then(function(logged) {
			if (State.synchroFlag && logged) {
				State.synchroFlag = false;
				$scope.synchronize();
			}
		});
	});

})

.controller('noteCtrl', function($scope, $location, $ionicNativeTransitions, $ionicPopup, State, NoteService, NoteREST, AuthService, UI) {
	
	$scope.noteData = {};
	$scope.State = State;
	$scope.wasModified = false;

	$scope.syncIfAuth = function() {
		AuthService.isLoggedin().then(function(logged) {
			if (logged) {
				NoteREST.synchronize();
			}
		});
	};

	$scope.saveNote = function() {
		if (State.actual=='creation') {
			NoteService.createNote($scope.noteData).then(function(id) {
				State.actual='edition';
				State.noteId=id;
				$scope.noteData.id=id;
				$scope.editingCopy = NoteService.copyNote($scope.noteData);
				UI.toast("Note created");
				$scope.syncIfAuth();
			});
		} else if (State.actual=='edition') {
			NoteService.updateNote($scope.noteData).then(function(ret) {
				$scope.editingCopy = NoteService.copyNote($scope.noteData);
				$scope.changedNote();
				UI.toast("Note saved");
				$scope.syncIfAuth();
			});
		}
	};

	$scope.removeNote = function() {
		var confirmPopup = $ionicPopup.confirm({
			title: 'Remove note'
		});

		confirmPopup.then(function(res) {
			if(res) {
				NoteService.removeNote($scope.noteData.id).then(function(result) {
					UI.toast("Note removed");
					$scope.noteData = {};
					$location.path('main');
					$scope.syncIfAuth();
				});
			}
		});
	};

	$scope.changedNote = function() {
		if (State.actual=='edition') {
			if ($scope.noteData.content!=$scope.editingCopy.content ||
				$scope.noteData.title!=$scope.editingCopy.title) {
				$scope.wasModified = true;
			} else {
				$scope.wasModified = false;
			}
		}
	};

	$scope.cancelChanges = function() {
		$scope.noteData = {};
		$location.path('main');
		$ionicNativeTransitions.locationUrl('/main', {
			"type": "fade",
			"duration": 500
		});
	};

	$scope.$on("$ionicView.beforeEnter", function(event, data) {
		if (State.actual=='creation') {
			$scope.noteData = {
				title: 'New note',
				content: ''
			};
		} else if (State.actual=='edition') {
			$scope.wasModified = false;
			NoteService.getSingleNote(State.noteId).then(function(note) {
				$scope.noteData = note;
				$scope.editingCopy = NoteService.copyNote(note);
			});
		}
	});

})

.controller('loginCtrl', function($scope, $location, $cordovaVibration, $ionicNativeTransitions, $ionicPopup, State, AuthService, UI, $http, Utils) {

	$scope.loginData = {};
	$scope.processing = false;

	$scope.cancelLogin = function() {
		$scope.loginData = {};
		//$location.path('main');
		$ionicNativeTransitions.locationUrl('/settings', {
			"type": "fade",
			"duration": 500
		});
	};

	$scope.login = function() {
		if (!$scope.processing) {
			$scope.processing = true;
			UI.toast("Logging in...");
			var user = $scope.loginData.username;
			var pass = $scope.loginData.password;
			if (user!='' && user!=undefined && pass!='' && pass!=undefined) {
				AuthService.validateUser(user,pass).then(function(valid) {
					if (valid) {
						AuthService.saveUser(user,pass).then(function(saved) {
							if (saved) {
								document.addEventListener('deviceready',function() {
									$cordovaVibration.vibrate(40);
								}, false);
								UI.toast("Logged in!");
								//$location.path('main');
								State.synchroFlag = true;
								$ionicNativeTransitions.locationUrl('/main', {
									"type": "fade",
									"duration": 500
								});
							}
							$scope.processing = false;
						});
					} else {
						UI.toast("Username and password rejected");
						$scope.processing = false;
					}
				});
			} else {
				UI.toast("Enter valid username and password");
			}
		}
	};

	$scope.$on("$ionicView.beforeEnter", function(event, data) {
		$scope.loginData = {};
	});

})

.controller('registerCtrl', function($scope, $location, $cordovaVibration, $ionicNativeTransitions, AuthService, UI, $http, Utils, State) {

	$scope.registerData = {};
	$scope.processing = false;

	$scope.cancelRegister = function() {
		$scope.registerData = {};
		//$location.path('main');
		$ionicNativeTransitions.locationUrl('/settings', {
			"type": "fade",
			"duration": 500
		});
	};

	$scope.register = function() {
		if (!$scope.processing) {
			$scope.processing = true;
			var user = $scope.registerData.username;
			var pass = $scope.registerData.password;
			var repass = $scope.registerData.repassword;

			if (user!='' && user!=undefined && pass!='' && pass!=undefined && repass!='' && repass!=undefined) {
				if (pass===repass) {
					var userSend = {username:user,password:pass};
					$http.put(Utils.restEndpoint+'/user',JSON.stringify(userSend)).then(function(res) {
						//console.log(res);
						if (res.data=="true") {
							UI.toast("Registering...");
							$scope.login().then(function() {
								$scope.processing = false;
							});
						} else {
							UI.toast("Username already exists");
							$scope.processing = false;
						}
					});
				} else {
					$scope.registerData.password = '';
					$scope.registerData.repassword = '';
					UI.toast("Passwords doesn't match");
					$scope.processing = false;
				}
			} else {
				UI.toast("Enter valid username and passwords");
				$scope.processing = false;
			}
		}
	};

	$scope.login = function() {
		var user = $scope.registerData.username;
		var pass = $scope.registerData.password;
		return AuthService.validateUser(user,pass).then(function(valid) {
			if (valid) {
				AuthService.saveUser(user,pass).then(function(saved) {
					if (saved) {
						UI.toast("Registered!");
						document.addEventListener('deviceready',function() {
							$cordovaVibration.vibrate(40);
						}, false);
						//$location.path('main');
						State.synchroFlag = true;
						$ionicNativeTransitions.locationUrl('/main', {
							"type": "slide",
							"direction": "left" 
						});
					}
				});
			} else {
				UI.toast("Username and password rejected");
			}
		});
	};

	$scope.$on("$ionicView.beforeEnter", function(event, data) {
		$scope.registerData = {};
	});

})

.controller('settingsCtrl', function($scope, $cordovaVibration, $ionicNativeTransitions, $location, $ionicPopup, AuthService, $css, UI, $http, Utils) {

	$scope.settingsData = {};

	$scope.backToMain = function() {
		//$location.path('main');
		$ionicNativeTransitions.locationUrl('/main', {
			"type": "fade",
			"duration": 500
		});
	};

	$scope.changeMode = function() {
		if (UI.mode=='day') {
			UI.mode='night';
		} else {
			UI.mode='day';
		}
		$css.remove('css/style.'+UI.mode+'.css');
		$css.add('css/style.'+UI.mode+'.css');
		UI.toast(UI.mode+' mode');

		UI.setColorMode(UI.mode);
		if (window.StatusBar) {
			if (UI.mode=='day') {
	  			StatusBar.backgroundColorByHexString('#aaa');
			} else {
	  			StatusBar.backgroundColorByHexString('#444');
			}
		}

		document.addEventListener('deviceready',function() {
			$cordovaVibration.vibrate(40);
		}, false);

		$scope.settingsData.mode = UI.mode;
	};

	$scope.goLogin = function() {
		$location.path('login');
	};

	$scope.goRegister = function() {
		$location.path('register');
	};

	$scope.logout = function() {
		var confirmPopup = $ionicPopup.confirm({
			title: 'Logout account'
		});

		confirmPopup.then(function(res) {
			if(res) {
				AuthService.logout().then(function(loggedout) {
					if (loggedout) {
						$scope.settingsData.loggedIn = false;
						UI.toast("Logged out!");
					}
				});
			}
		});
	};

	$scope.customServer = function() {
		$scope.settingsData.endpoint = Utils.restEndpoint;

		var confirmPopup = $ionicPopup.confirm({
			title: 'Enter endpoint',
			template: '<input type="text" ng-model="settingsData.endpoint">',
			scope: $scope
		});

		confirmPopup.then(function(res) {
			if (res) {
				var endpoint = $scope.settingsData.endpoint;
				if (endpoint!=undefined && endpoint!='') {
					$http.post($scope.settingsData.endpoint+'/meta',"are you the note server?").then(function(res) {
						//console.log(res);
						var answer = res.data;
						if (answer=="yes i am!") {
							Utils.restEndpoint = $scope.settingsData.endpoint;
							Utils.saveEndpoint($scope.settingsData.endpoint);
							UI.toast("Server changed!");
							document.addEventListener('deviceready',function() {
								$cordovaVibration.vibrate(40);
							}, false);
						} else {
							UI.toast("Server not valid");
						}
					}, function(error) {
						UI.toast("Server not valid");
					});
				} else {
					UI.toast("Enter valid endpoint");
				}
			}
		});
	};

	$scope.$on("$ionicView.beforeEnter", function(event, data) {
		$scope.settingsData.mode = UI.mode;
		if (AuthService.loggedIn) {
			$scope.settingsData.loggedIn = true;
			$scope.settingsData.username = AuthService.userlogged;
		};
	});

});
