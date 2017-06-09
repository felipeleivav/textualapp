angular.module('starter.services', ['starter.config','base64'])

.factory('DB', function($q, DB_CONFIG) {
    var self = this;

    self.db = null;
    self.devMode = false;

    self.init = function() {
        self.db = window.openDatabase(DB_CONFIG.name, '1.0', 'database', -1);

        angular.forEach(DB_CONFIG.tables, function(table) {
            var columns = [];

            angular.forEach(table.columns, function(column) {
                columns.push(column.name + ' ' + column.type);
            });

            if (self.devMode) {
                var drop = 'DROP TABLE '+table.name;
                self.query(drop);
            }

            var query = 'CREATE TABLE IF NOT EXISTS ' + table.name + ' (' + columns.join(',') + ')';
            self.query(query);
        });

        if (self.devMode) {
            theEndpoint = 'http://192.168.1.8:8080';
        } else {
            theEndpoint = 'https://textual.me:8433';
        }

        self.query('INSERT INTO settings (setting_key,setting_value) VALUES (\'endpoint\',\''+theEndpoint+'\')');
        self.query('INSERT INTO settings (setting_key,setting_value) VALUES (\'colorMode\',\'day\')');
    };

    self.query = function(query, bindings) {
        bindings = typeof bindings !== 'undefined' ? bindings : [];
        var deferred = $q.defer();

        self.db.transaction(function(transaction) {
            transaction.executeSql(query, bindings, function(transaction, result) {
                deferred.resolve(result);
            }, function(transaction, error) {
                deferred.reject(error);
            });
        });

        return deferred.promise;
    };

    self.getAllRows = function(result, mapper) {
        var output = [];

        if (typeof mapper === 'function') {
            for (var i = 0; i < result.rows.length; i++) {
                output.push(mapper(result.rows.item(i)));
            }
        } else {
            for (var i = 0; i < result.rows.length; i++) {
                output.push(result.rows.item(i));
            }
        }
        
        return output;
    };

    self.getSingleRow = function(result, mapper) {
        if (typeof mapper === 'function') {
            return mapper(result.rows.item(0));
        } else {
            return result.rows.item(0);
        }
    };

    self.qMark = function(row) {
        var questions = [];
        for (var k in row) {
            if (row.hasOwnProperty(k)) {
                questions.push('?');
            }
        }
        return questions.join();
    };

    return self;
})

.factory('State', function() {
    var self = this;

    self.state = {
        actual: 'creation',
        noteId: 0,
    };

    self.synchroFlag = false;

    return self;
})

.factory('NoteService', function(DB,AuthService) {
    var self = this;

    self.getSingleNote = function(noteId) {
        var query = 'SELECT id,title,content FROM note WHERE id=?';
        return DB.query(query, [noteId]).then(function(result) {
            return DB.getSingleRow(result, self.rowToObj);
        });
    };

    self.getSingleNoteByRid = function(noteRid) {
        var query = 'SELECT id,rid,last_update FROM note WHERE rid=?';
        return DB.query(query, [noteRid]).then(function(result) {
            return DB.getSingleRow(result, self.rowToObj);
        });
    };

    self.getAllNotes = function() {
        var query = 'SELECT id,title,content,favorite FROM note WHERE status_flag != \'D\' OR status_flag IS NULL ORDER BY favorite DESC';
        return DB.query(query).then(function(result) {
            return DB.getAllRows(result, self.rowToObj);
        });
    };

    self.getFlaggedNotes = function() {
        var query = 'SELECT id,rid,title,content,status_flag FROM note WHERE status_flag IS NOT NULL';
        return DB.query(query).then(function(result) {
            return DB.getAllRows(result, self.rowToObj);
        });
    };

    self.faveNote = function(noteId,fave) {
        var query = 'UPDATE note SET favorite=? WHERE id=?';
        return DB.query(query, [fave,noteId]).then(function(result) {
            return result;
        });
    }

    self.createNote = function(noteObject) {
        var row = self.objToRow(noteObject);
        row.pop();
        row.push('C');
        var query = 'INSERT INTO note (id,title,content,status_flag,favorite) VALUES(NULL,'+DB.qMark(row)+',\'N\')';
        return DB.query(query, row).then(function(result) {
            return result.insertId;
        });
    };

    self.createExistingNote = function(noteObject) {
        noteObject.rid = noteObject.id;
        noteObject.last_update = noteObject.lastUpdate;
        var row = self.objToRow(noteObject);
        row.pop();
        var query = 'INSERT INTO note (id,favorite,title,content,last_update,rid) VALUES(NULL,\'N\','+DB.qMark(row)+')';
        return DB.query(query, row).then(function(result) {
            return result.insertId;
        });
    };

    self.updateExistingNoteByRid = function(noteObject) {
        var row = self.objToRow(noteObject);
        row.pop();
        var query = 'UPDATE note SET title=?,content=?,last_update=?,status_flag=NULL WHERE rid=?';
        return DB.query(query, row).then(function(result) {
            return result;
        });
    };

    self.clearStatus = function(noteId) {
        var query = 'UPDATE note SET status_flag=NULL WHERE id=?';
        return DB.query(query, [noteId]).then(function(result) {
            return result.rowsAffected;
        });
    };

    self.ridExists = function(noteRid) {
        var query = 'SELECT id FROM note WHERE rid=?';
        return DB.query(query, [noteRid]).then(function(result) {
            return result.rows.length>0;
        });
    };

    self.updateRid = function(noteId, noteRid) {
        var query = 'UPDATE note SET rid=? WHERE id=?';
        return DB.query(query, [noteRid, noteId]).then(function(result) {
            return result.rowsAffected;
        });
    }

    self.updateLastUpdate = function(noteId, lastUpdate) {
        var query = 'UPDATE note SET last_update=? WHERE id=?';
        return DB.query(query, [lastUpdate, noteId]).then(function(result) {
            return result.rowsAffected;
        });
    };

    self.updateNote = function(noteObject, unflagFlag) { // :D
        var row = self.objToRow(noteObject);
        return AuthService.isLoggedin().then(function(logged) {
            if (logged && typeof unflagFlag === "undefined") {
                row.splice(row.length-1,0,'U');
                var query = 'UPDATE note SET title=?,content=?,status_flag=? WHERE id=?';
            } else {
                var query = 'UPDATE note SET title=?,content=? WHERE id=?';
            }
            return DB.query(query, row).then(function(result) {
                return result;
            });
        });
    };

    self.removeNote = function(noteId) {
        return AuthService.isLoggedin().then(function(logged) {
            if (logged) {
                var query = 'UPDATE note SET status_flag=\'D\' WHERE id=?';
            } else {
                var query = 'DELETE FROM note WHERE id=?';
            }
            return DB.query(query, [noteId]).then(function(result) {
                return result;
            });
        });
    };

    self.removeNoteByRid = function(noteRid) {
        var query = 'DELETE FROM note WHERE rid=?';
        return DB.query(query, [noteRid]).then(function(result) {
            return result;
        });
    };

    self.objToRow = function(noteObject) {
        var row = [];
        row.push(noteObject.title);
        row.push(noteObject.content);
        if (noteObject.last_update!==undefined && noteObject.last_update!='') {
            row.push(noteObject.last_update);
        }
        if (noteObject.rid!==undefined && noteObject.rid!='') {
            row.push(noteObject.rid);
        }
        row.push(noteObject.id);
        return row;
    };

    self.rowToObj = function(noteRow) {
        var obj = {};
        obj.id = noteRow.id;
        if (noteRow.rid!==undefined && noteRow.rid!='') {
            obj.rid = noteRow.rid;
        }
        obj.title = noteRow.title;
        obj.content = noteRow.content;
        if (noteRow.last_update!==undefined && noteRow.last_update!='') {
            obj.last_update = noteRow.last_update;
        }
        if (noteRow.status_flag!==undefined && noteRow.status_flag!='') {
            obj.status_flag = noteRow.status_flag;
        }
        obj.favorite = noteRow.favorite;
        return obj;
    };

    self.copyNote = function(noteObject) {
        var copy = {};
        copy.title = noteObject.title;
        copy.content = noteObject.content;
        copy.id = noteObject.id;
        return copy;
    };

    return self;
})

.factory('AuthService', function($q, DB, $base64, $http, Utils){
    var self = this;

    self.header = '';
    self.loggedIn = false;
    self.userlogged = '';

    self.isLoggedin = function() {
        var query = 'SELECT * FROM settings WHERE setting_key=\'user\' OR setting_key=\'pass\'';
        return DB.query(query).then(function(result) {
            if (result.rows.length==2) {
                var header = 'Basic '+$base64.encode(result.rows.item(0).setting_value+":"+result.rows.item(1).setting_value);
                self.header = { headers: { Authorization: header } };
                self.loggedIn = true;
                return true;
            } else {
                self.loggedIn = false;
                return false;
            }
        });
    };

    self.saveUser = function(username, password) {
        return self.getLastUsername().then(function(lastUsername) {
            return self.isLoggedin().then(function(logged) {
                if (!logged) {
                    var preLogin = [];
                    if (lastUsername!=username) {
                        preLogin.push(self.prepareUpdatesForNewUser());
                    }
                    preLogin.push(self.deleteLastUsername());
                    return $q.all(preLogin).then(function(result) {
                        var query = 'INSERT INTO settings VALUES(?,?)';
                        return DB.query(query, ['user',username]).then(function(result) {
                            if (result.rowsAffected>0) {
                                var query = 'INSERT INTO settings VALUES(?,?)';
                                return DB.query(query, ['pass',password]).then(function(result) {
                                    var isok = result.rowsAffected>0;
                                    self.loggedIn = isok;
                                    self.userlogged = username;
                                    return isok;
                                });
                            } else {
                                return false;
                            }
                        });
                    });
                }
            });
        });
    };

    self.prepareUpdatesForNewUser = function() {
        // TODO: setea C sobre U o NULL
        var query = 'UPDATE note SET status_flag=?,rid=NULL,last_update=NULL WHERE status_flag=? OR status_flag IS NULL';
        return DB.query(query,['C','U']).then(function(result) {
            return result.rowsAffected>0;
        });
    };

    self.getUsername = function() {
        var query = 'SELECT setting_value FROM settings WHERE setting_key=?';
        return DB.query(query,['user']).then(function(result) {
            return result.rows.item(0).setting_value; 
        });
    };

    self.getLastUsername = function() {
        var query = 'SELECT setting_value FROM settings WHERE setting_key=?';
        return DB.query(query,['last_login']).then(function(result) {
            if (result.rows.length==0) {
                return false
            } else {
                return result.rows.item(0).setting_value;
            }
        });
    };

    self.deleteLastUsername = function() {
        var query = 'DELETE FROM settings WHERE setting_key=?';
        return DB.query(query,['last_login']).then(function(result) {
            return result.rowsAffected>0;
        });
    };

    self.logout = function() {
        return self.getUsername().then(function(username) {
            var query = 'DELETE FROM settings WHERE setting_key=? OR setting_key=?';
            return DB.query(query,['user','pass']).then(function(result) {
                if (result.rowsAffected==2) {
                    self.header = '';
                    var queryDelete = 'DELETE FROM note WHERE status_flag=?';
                    var queryLastUser = 'INSERT INTO settings (setting_key,setting_value) VALUES (?,?)';
                    $q.all([
                        DB.query(queryDelete,['D']),
                        DB.query(queryLastUser,['last_login',username])
                    ]).then(function(result) {
                        //donothing
                    });
                    self.loggedIn = false;
                    return true;
                } else {
                    return false;
                }
            });
        });
    };

    self.validateUser = function(username, password) {
        var credentials = $base64.encode(username+":"+password);
        self.header = { headers: { Authorization: 'Basic '+credentials } };
        return $http.get(Utils.restEndpoint+'/note/test',self.header).then(function(response) {
            return true;
        }, function(response) {
            return false;
        });
    };

    return self;
})

.factory('NoteREST', function($http, $q, NoteService, AuthService, Utils) {
    var self = this;

    self.synchronize = function() {
        //console.log('sync...');
        return $q.all([self.synchronizeFlags(),self.synchronizeAll()]).then(function(result) {
            //console.log('syncd');
        });
    };

    self.synchronizeFlags = function() {
        return NoteService.getFlaggedNotes().then(function(notes) {
            var requests = [];
            var updates = [];
            for (var i=0;i<notes.length;i++) {
                var note = notes[i];
                if (note.status_flag=='C') {
                    requests.push($http.put(Utils.restEndpoint+'/note',JSON.stringify(note),AuthService.header));
                } else if (note.status_flag=='D') {
                    requests.push($http.delete(Utils.restEndpoint+'/note/'+note.rid,AuthService.header));
                } else if (note.status_flag=='U') {
                    note.local_id = note.id;
                    note.id = note.rid;
                    requests.push($http.post(Utils.restEndpoint+'/note/',JSON.stringify(note),AuthService.header));
                }
            }
            return $q.all(requests).then(function(result) {
                for (var i=0;i<result.length;i++) {
                    if (result[i].statusText=='OK') {
                        if (result[i].config.method=='PUT') {
                            var sentNote = JSON.parse(result[i].config.data);
                            var recvNote = JSON.parse(JSON.stringify(result[i].data));
                            updates.push(NoteService.clearStatus(sentNote.id));
                            updates.push(NoteService.updateLastUpdate(sentNote.id,recvNote.lastUpdate));
                            updates.push(NoteService.updateRid(sentNote.id,recvNote.id));
                        } else if (result[i].config.method=='DELETE') {
                            var id = parseInt(result[i].data);
                            if (id>0) {
                                updates.push(NoteService.removeNoteByRid(id));
                            }
                        } else if (result[i].config.method=='POST') {
                            var sentNote = JSON.parse(result[i].config.data);
                            var recvNote = JSON.parse(JSON.stringify(result[i].data));
                            if (recvNote.id==sentNote.id) {
                                updates.push(NoteService.updateLastUpdate(sentNote.local_id,recvNote.lastUpdate));
                                updates.push(NoteService.clearStatus(sentNote.local_id));
                            }
                        }
                    }
                }
                return $q.all(updates);
            });
        });
    };

    self.synchronizeAll = function() {
        var exists = [];
        var newNotes = [];
        var createdNotes = [];
        var checkLastUpdate = [];
        var obtainForUpdate = [];
        var updateLocal = [];
        return $http.get(Utils.restEndpoint+'/note?lastUpdate',AuthService.header).then(function(result) {
            this.existsWrapper = function(note) {
                return NoteService.ridExists(note.id).then(function(exists) {
                    return {exists: exists, id: note.id, lastUpdate: note.lastUpdate};
                });
            };
            for (var j=0;j<result.data.length;j++) {
                var note = JSON.parse(JSON.stringify(result.data[j]));
                exists.push(this.existsWrapper(note));
            }
            return $q.all(exists).then(function(existsResult) {
                //console.log(existsResult);
                for (var i=0;i<existsResult.length;i++) {
                    if (!existsResult[i].exists) {
                        newNotes.push($http.get(Utils.restEndpoint+'/note/'+existsResult[i].id,AuthService.header));
                    } else {
                        checkLastUpdate.push(NoteService.getSingleNoteByRid(existsResult[i].id));
                    }
                }
                this.createNotes = function(notes) {
                    return $q.all(notes).then(function(newNotes) {
                        //console.log(newNotes);
                        for (var k=0;k<newNotes.length;k++) {
                            var note = JSON.parse(JSON.stringify(newNotes[k].data));
                            createdNotes.push(NoteService.createExistingNote(note));
                        }
                        return $q.all(createdNotes);
                    });
                };
                this.updateNotes = function(updates) {
                    return $q.all(updates).then(function(lastUpdates) {
                        //console.log(existsResult);
                        //console.log(lastUpdates);
                        for (var i=0;i<lastUpdates.length;i++) {
                            for (var j=0;j<existsResult.length;j++) {
                                if (lastUpdates[i].rid==existsResult[j].id) {
                                    var localDate = Utils.parseCustomDate(lastUpdates[i].last_update);
                                    var remoteDate = Utils.parseCustomDate(existsResult[j].lastUpdate);
                                    if (remoteDate>localDate) {
                                        obtainForUpdate.push($http.get(Utils.restEndpoint+'/note/'+lastUpdates[i].rid,AuthService.header));
                                    }
                                }
                            }
                        }
                    });
                };
                return $q.all([this.createNotes(newNotes),this.updateNotes(checkLastUpdate)]).then(function(result) {
                    return $q.all(obtainForUpdate).then(function(result) {
                        console.log(result);
                        for (var i=0;i<result.length;i++) {
                            //actualiza el local mediante RID
                            var updatedNote = {};
                            var remoteNote = JSON.parse(JSON.stringify(result[i].data))
                            updatedNote.title = remoteNote.title;
                            updatedNote.content = remoteNote.content;
                            updatedNote.last_update = remoteNote.lastUpdate;
                            updatedNote.rid = remoteNote.id;
                            updateLocal.push(NoteService.updateExistingNoteByRid(updatedNote));
                        }
                        return $q.all(updateLocal);
                    });
                });
            });
        });
    };

    return self;
})

.service('UI', function($window, $q, $ionicLoading, $timeout, DB, $css) {

    this.mode;

    this.toast = function(msg) {
        var duration = 'short';
        var position = 'bottom';

        // PhoneGap? Use native:
        if($window.plugins && $window.plugins.toast) {
            $window.plugins.toast.show(msg, duration, position, function(a){}, function(err){});
            return;
        }

        // … fallback / customized $ionicLoading:
        $ionicLoading.show({
            template: msg,
            noBackdrop: true,
            duration: (duration == 'short' ? 700 : 1500)
        });
    }

    this.getColorMode = function() {
        var query = 'SELECT setting_value FROM settings WHERE setting_key=\'colorMode\'';
        return DB.query(query).then(function(result) {
            if (result.rows.length==0) {
                return false
            } else {
                return result.rows.item(0).setting_value;
            }
        });
    };

    this.setColorMode = function(c) {
        var query = 'UPDATE settings SET setting_value=? WHERE setting_key=\'colorMode\'';
        return DB.query(query, [c]).then(function(result) {
            if (result.rowsAffected==0) {
                var query = 'INSERT INTO settings (setting_value,setting_key) VALUES (?,?)';
                return DB.query(query, [c,'colorMode']).then(function(result) {
                    return result.rowsAffected>0;
                });
            } else {
                return true;
            }
        });
    };

    this.setMode = function() {
        $css.remove('css/style.'+this.mode+'.css');
        $css.add('css/style.'+this.mode+'.css');
        if (window.StatusBar) {
            if (this.mode=='day') {
                StatusBar.backgroundColorByHexString('#aaa');
            } else {
                StatusBar.backgroundColorByHexString('#444');
            }
        }
    };

})

.service('Utils', function(DB) {

    this.restEndpoint = '';

    this.saveEndpoint = function(endpoint) {
        var query = 'UPDATE settings SET setting_value=? WHERE setting_key=\'endpoint\'';
        return DB.query(query,[endpoint]).then(function(result) {
            return result.rowsAffected>0;
        });
    };

    this.getEndpoint = function() {
        var query = 'SELECT setting_value FROM settings WHERE setting_key=\'endpoint\'';
        return DB.query(query).then(function(result) {
            return result.rows.item(0).setting_value;
        });
    };

    // yyyy-MM-dd HH:mm:ss
    this.parseCustomDate = function(dateString) {
        var year = parseInt(dateString.substring(6,10));
        var month = parseInt(dateString.substring(3,5))-1;
        var day = parseInt(dateString.substring(0,2));
        var hour = parseInt(dateString.substring(11,13));
        var minute = parseInt(dateString.substring(14,16));
        var second = parseInt(dateString.substring(17,19));
        return new Date(year,month,day,hour,minute,second);
    };

});
