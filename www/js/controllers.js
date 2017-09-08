angular.module('starter.controllers',  ['starter.services','angularCSS','ionic-native-transitions'])

.controller('mainCtrl', function($scope, $q, $location, $ionicNativeTransitions, $cordovaVibration, $ionicPopup, Utils, State, NoteService, NoteTipService, RequestService, AuthService, NoteREST, RequestREST, UI, $css) {

	$scope.allNotes = [];
	$scope.isLoggedin = false;
	$scope.bellNotify = false;

	$scope.loadNotes = function() {
		NoteService.getAllNotes().then(function (notes) {
			NoteTipService.getAllTips().then(function(tips) {
				var ownCheck = [];
				for (var i=0;i<notes.length;i++) {
					if (notes[i].tip===undefined) notes[i].tip=false;
					for (var j=0;j<tips.length;j++) {
						if (notes[i].rid==tips[j].note_rid) {
							notes[i].tip=true;
							break;
						}
					}
					ownCheck.push(RequestService.isSharedAndOwner(notes[i].rid));
				}
				$q.all(ownCheck).then(function(noteCheck) {
					for (var k=0;k<noteCheck.length;k++) {
						for (var l=0;l<notes.length;l++) {
							if (noteCheck[k].note_rid==notes[l].rid && noteCheck[k].owner) {
								console.log('test');
								notes[l].owner='Y';
							}
						}
					}
					$scope.allNotes=notes;
				});
			});
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
		$ionicNativeTransitions.locationUrl('/settings', {
			"type": "fade",
			"duration": 100 
		});
	};

	$scope.goRequests = function() {
		$ionicNativeTransitions.locationUrl('/requests', {
			"type": "fade",
			"duration": 100 
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
			if (State.synchroFlag) {
				UI.toast("Synchronized!");
				State.synchroFlag = false;
			}
		});
	};

	$scope.$on("$ionicView.beforeEnter", function(event, data) {
	    Utils.getEndpoint().then(function(result) {
			Utils.restEndpoint = result;
      		$scope.loadNotes();
			$scope.isLoggedin = false;
			UI.getBellTip().then(function(val) {
				$scope.bellNotify = val=="ON"?true:false;
			});
			return AuthService.isLoggedin().then(function(logged) {
				if (logged) $scope.isLoggedin = true;
				//if (State.synchroFlag && logged) { //sync only when opening app
				if (logged) { //sync always
					return RequestREST.removePendingRequests().then(function(dels) {
						return RequestREST.synchronizeRequests().then(function(res) {
							return RequestREST.clearNotFoundRequests().then(function(reqs) {
								return $scope.synchronize();
							});
						});
					});
				}
			});
	    });
	});

})

.controller('noteCtrl', function($scope, $location, $ionicNativeTransitions, $ionicPopup, State, NoteService, NoteTipService, NoteREST, AuthService, UI) {
	
	$scope.noteData = {};
	$scope.State = State;
	$scope.wasModified = false;

	$scope.shareNote = function() {
		$ionicNativeTransitions.locationUrl('/noterequests', {
			"type": "fade",
			"duration": 100
		});
	};

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
		if ($scope.wasModified) {
			var confirmPopup = $ionicPopup.confirm({
				title: 'Discard changes'
			});

			confirmPopup.then(function(res) {
				if(res) {
					$scope.backToMain();
				}
			});
		} else {
			$scope.backToMain();
		}
	};

	$scope.backToMain = function() {
		$scope.noteData = {};
		$location.path('main');
		$ionicNativeTransitions.locationUrl('/main', {
			"type": "fade",
			"duration": 100
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
				NoteTipService.removeTip(note.rid);
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
			"duration": 100
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
									"duration": 100
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
			"duration": 100
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
			"duration": 100
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

})

.controller('requestsCtrl', function($scope, $cordovaVibration, $ionicNativeTransitions, $location, AuthService, RequestService, RequestREST, MetaREST, UI, $http, Utils) {

	$scope.requestsData = {};
	$scope.pendingDiplay = 'inline';
	$scope.acceptedDisplay = 'none';
	$scope.displaying = 'pending';

	$scope.pendingExtRequests = [];
	$scope.pendingOwnRequests = [];
	$scope.acceptedExtRequests = [];
	$scope.acceptedOwnRequests = [];

	$scope.backToMain = function() {
		$ionicNativeTransitions.locationUrl('/main', {
			"type": "fade",
			"duration": 100
		});
	};

	$scope.seePending = function() {
		$scope.pendingDisplay = 'inline';
		$scope.acceptedDisplay = 'none';
		$scope.displaying = 'pending';
	};

	$scope.seeAccepted = function() {
		$scope.pendingDisplay = 'none';
		$scope.acceptedDisplay = 'inline';
		$scope.displaying = 'accepted';
	};

	$scope.acceptRequest = function(localReqId) {
		return RequestREST.acceptRequest(localReqId).then(function(res) {
			if (res!==undefined && parseInt(res)>0) {
				UI.toast('Request accepted');
				$scope.loadRequests();
			} else {
				UI.toast('Can\'t accept; not connected');
			}
		});
	};

	$scope.removeRequest = function(localReqId, action) {
		return RequestREST.removeRequest(localReqId).then(function(res) {
			if (res!==undefined && res!=0 && parseInt(res.wasDel)>0) {
				UI.toast('Request '+action);
			} else {
				UI.toast('Not connected, will be '+action+' later');
			}
			$scope.loadRequests();
		});
	};

	$scope.declineRequest = function(localReqId) {
		$scope.removeRequest(localReqId,'declined');
	};

	$scope.cancelRequest = function(localReqId) {
		$scope.removeRequest(localReqId,'cancelled');
	};

	$scope.revokeRequest = function(localReqId) {
		$scope.removeRequest(localReqId,'revoked');
	};

	$scope.fillRequests = function() {
		return RequestService.getRequestsWithNoteName().then(function(reqs) {
			return AuthService.getUserId().then(function(userId) {
				for (var i=0;i<reqs.length;i++) {
					if (reqs[i].request_status==1) {
						if (reqs[i].requester_id==userId) {
							$scope.acceptedOwnRequests.push(reqs[i]);
						} else if (reqs[i].invited_id==userId) {
							$scope.acceptedExtRequests.push(reqs[i]);
						}
					} else if (reqs[i].requester_id==userId) {
						if (reqs[i].request_status==0) {
							$scope.pendingOwnRequests.push(reqs[i]);
						}
					} else if (reqs[i].invited_id==userId) {
						if (reqs[i].request_status==0) {
							$scope.pendingExtRequests.push(reqs[i]);
						}
					}
				}
				console.log('reqs syncd');
				return reqs;
			});
		});
	};

	$scope.loadRequests = function() {
		var requests;
		$scope.seePending();
		$scope.pendingExtRequests = [];
		$scope.pendingOwnRequests = [];
		$scope.acceptedExtRequests = [];
		$scope.acceptedOwnRequests = [];
		return MetaREST.checkServer().then(function(valid) {
			if (valid) {
				return RequestREST.removePendingRequests().then(function(dels) {
					return RequestREST.synchronizeRequests().then(function(res) {
						return RequestREST.clearNotFoundRequests().then(function(req) {
							return $scope.fillRequests();
						});
					});
				});
			} else {
				return $scope.fillRequests();
			}
		});
	};

	$scope.$on("$ionicView.beforeEnter", function(event, data) {
		UI.setBellTip(false);
		$scope.loadRequests();
	});

})

.controller('noteRequestsCtrl', function($scope, $ionicNativeTransitions, $location, State, UI, RequestService, RequestREST, NoteService) {

	$scope.requestList = [];
	$scope.reqData = {};

	$scope.backToNote = function() {
		$ionicNativeTransitions.locationUrl('/note', {
			"type": "fade",
			"duration": 100
		});
	};

	$scope.loadRequests = function() {
		NoteService.getRidById(State.noteId).then(function(noteRid) {
			RequestService.getRequestsByNoteRid(noteRid).then(function(reqs) {
				$scope.requestList = reqs;
			});
		});
	};

	$scope.sendInvitation = function() {
		if ($scope.reqData.username!==undefined && $scope.reqData.username!="") {
			return NoteService.getRidById(State.noteId).then(function(noteRid) {
				return RequestREST.sendRequest(noteRid,$scope.reqData.username).then(function(res) {
					if (res!==undefined && res.id>0) {
						$scope.reqData = {};
						$scope.loadRequests();
						UI.toast("Request sent");
					} else {
						UI.toast("Can't send request");
					}
				});
			});
		}
	};

	$scope.$on("$ionicView.beforeEnter", function(event, data) {
		$scope.requestList = [];
		$scope.reqData = {};
		$scope.loadRequests();
	});

});
