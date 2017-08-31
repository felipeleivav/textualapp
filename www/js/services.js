angular.module('starter.services', ['starter.config','base64'])

.factory('DB', function($q, DB_CONFIG) {
    var self = this;

    self.db = null;
    self.devMode = false;
    self.devEP = false;

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

        if (self.devEP) {
            theEndpoint = 'http://192.168.1.8:8080';
        } else {
            theEndpoint = 'https://textual.me:8443';
        }

        return self.query('SELECT setting_key FROM settings').then(function(result) {
            if (result.rows.length<2) {
                return self.query('INSERT INTO settings (setting_key,setting_value) VALUES (?,?)',['endpoint',theEndpoint]).then(function(result) {
                    return self.query('INSERT INTO settings (setting_key,setting_value) VALUES (?,?)',['colorMode','day']);
                });
            }
        });
    };

    self.query = function(query, bindings) {
        bindings = typeof bindings !== 'undefined' ? bindings : [];
        var deferred = $q.defer();

        self.db.transaction(function(transaction) {
            transaction.executeSql(query, bindings, function(transaction, result) {
                deferred.resolve(result);
            }, function(transaction, error) {
                console.log(query);
                console.log(bindings);
                console.log(error);
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

.factory('NoteService', function(DB,AuthService,RequestService,$q) {
    var self = this;

    self.getSingleNote = function(noteId) {
        var query = 'SELECT id,rid,title,content,shared FROM note WHERE id=?';
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

    self.getRidById = function(noteId) {
        var query = 'SELECT rid FROM note WHERE id=?';
        return DB.query(query, [noteId]).then(function(result) {
            if (result.rows.length>0) {
                return result.rows.item(0).rid;
            } else {
                return 0;
            }
        });
    };

    self.getAllNotes = function() {
        var query = 'SELECT id,title,content,favorite,shared FROM note WHERE status_flag != \'D\' OR status_flag IS NULL ORDER BY favorite DESC';
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
    };

    self.createNote = function(noteObject) {
        var row = self.objToRow(noteObject);
        row.pop();
        row.push('C');
        var query = 'INSERT INTO note (id,title,content,status_flag,favorite) VALUES(NULL,'+DB.qMark(row)+',\'N\')';
        return DB.query(query, row).then(function(result) {
            return result.insertId;
        });
    };

    self.createExistingNote = function(noteObject) { //by existing, i mean existing in rest, not in local
        noteObject.rid = noteObject.id;
        noteObject.last_update = noteObject.lastUpdate;
        var row = self.objToRow(noteObject);
        row.pop();
        var flagShared = noteObject.shared==='Y'?'\'Y\'':'NULL';
        var query = 'INSERT INTO note (id,favorite,title,content,last_update,rid,shared) VALUES(NULL,\'N\','+DB.qMark(row)+','+flagShared+')';
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

    self.findByRid = function(note) {
        var query = 'SELECT id,last_update FROM note WHERE rid=?';
        return DB.query(query, [note.id]).then(function(result) {
            note.ridFound = result.rows.length>0;
            if (note.ridFound) {
                note.local_last_update = result.rows.item(0).last_update;
            }
            return note;
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
        row.splice(-2,1);
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
            return self.getSingleNote(noteId).then(function(theNote) {
                return RequestService.getRequestsByNoteRid(theNote.rid).then(function(reqs) {
                    var pendAndReqs = [];
                    for (var i=0;i<reqs.length;i++) {
                        pendAndReqs.push(RequestService.deleteRequest(reqs[i].id));
                        pendAndReqs.push(RequestService.insertPendingDelete(reqs[i].id,reqs[i].rid));
                    }
                    return $q.all([pendAndReqs]).then(function(variablechalla) {
                        if (logged && theNote.shared!=='Y') {
                            var query = 'UPDATE note SET status_flag=\'D\' WHERE id=?';
                        } else {
                            var query = 'DELETE FROM note WHERE id=?';
                        }
                        return DB.query(query, [noteId]).then(function(result) {
                            return result;
                        });
                    });
                });
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
        obj.shared = noteRow.shared;
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
        var query = 'SELECT * FROM settings WHERE setting_key=? OR setting_key=?';
        return DB.query(query,['user','pass']).then(function(result) {
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

    self.getUserId = function() {
        var query = 'SELECT setting_value FROM settings WHERE setting_key=?';
        return DB.query(query,['user_id']).then(function(result) {
            if (result.rows.length>0) {
                var userId = result.rows.item(0).setting_value;
                return self.getRestUserId().then(function(id) {
                    if (id>0) {
                        return self.updateUserId(id).then(function(res) {
                            return id;
                        });
                    } else return userId;
                });
            } else {
                return self.getRestUserId().then(function(id) {
                    if (id>0) {
                        return self.saveUserId(id).then(function(res) {
                            return id;
                        });
                    } else return 0;
                });
            }
        });
    };

    self.getRestUserId = function() {
        return $http.get(Utils.restEndpoint+'/user',self.header).then(function(response) {
            return response.data;
        }, function(response) {
            return 0;
        });
    }

    self.saveUserId = function(userId) {
        var query = 'INSERT INTO settings (setting_key,setting_value) VALUES (?,?)';
        return DB.query(query,['user_id',userId]).then(function(result) {
            return result;
        });
    }

    self.updateUserId = function(userId) {
        var query = 'UPDATE settings SET setting_value=? WHERE setting_key=?';
        return DB.query(query,[userId,'user_id']).then(function(result) {
            return result;
        });
    }

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
                    var queryDelShared = 'DELETE FROM note WHERE shared=?';
                    var queryDelReqs = 'DELETE FROM request';
                    var queryDelPends = 'DELETE FROM pending_request_delete';
                    $q.all([
                        DB.query(queryDelete,['D']),
                        DB.query(queryLastUser,['last_login',username]),
                        DB.query(queryDelShared,['Y']),
                        DB.query(queryDelReqs),
                        DB.query(queryDelPends)
                    ]);
                    self.loggedIn = false;
                    return true;
                } else {
                    return false;
                }
            });
        });
    };

    self.validateDbUser = function(username, password) {
        var query = 'SELECT setting_key,setting_value FROM settings WHERE setting_key=? OR setting_key=?';
        return DB.query(query,['user','pass']).then(function(loginData) {
            var user = '';
            var pass = '';
            for (var i=0;i<loginData.rows.length;i++) {
                if (loginData.rows[i].setting_key=='user') {
                    user = loginData.rows[i].setting_value;
                } else if (loginData.rows[i].setting_key=='pass') {
                    pass = loginData.rows[i].setting_value;
                }
            }
            return self.validateUser(user,pass);
        });
    };

    self.validateUser = function(username, password) {
        var credentials = $base64.encode(username+":"+password);
        self.header = { headers: { Authorization: 'Basic '+credentials } };
        return $http.get(Utils.restEndpoint+'/note/test',self.header).then(function(response) {
            return true;
        }, function(response) {
            if (response.statusText=='Unauthorized') {
                return -1;
            } else {
                return false;
            }
        });
    };

    return self;
})

.factory('NoteREST', function($http, $q, NoteService, AuthService, Utils) {
    var self = this;

    self.synchronize = function() {
        return $q.all([self.synchronizeFlags(),self.synchronizeAll()]).then(function(result) {
            //console.log('syncd');
        });
    };

    self.retrieveNote = function(noteRid) {
        return $http.get(Utils.restEndpoint+'/note/'+noteRid,AuthService.header).then(function(response) {
            return response.data;
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
                for (var i=0;i<existsResult.length;i++) {
                    if (!existsResult[i].exists) {
                        newNotes.push($http.get(Utils.restEndpoint+'/note/'+existsResult[i].id,AuthService.header));
                    } else {
                        checkLastUpdate.push(NoteService.getSingleNoteByRid(existsResult[i].id));
                    }
                }
                this.createNotes = function(notes) {
                    return $q.all(notes).then(function(newNotes) {
                        for (var k=0;k<newNotes.length;k++) {
                            var note = JSON.parse(JSON.stringify(newNotes[k].data));
                            createdNotes.push(NoteService.createExistingNote(note));
                        }
                        return $q.all(createdNotes);
                    });
                };
                this.updateNotes = function(updates) {
                    return $q.all(updates).then(function(lastUpdates) {
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

.factory('RequestService', function(DB,AuthService,$q) {
    var self = this;

    self.getSingleRequest = function(reqId) {
        var query = 'SELECT id,rid,requester_id,invited_id,external_username,note_id,note_rid,request_status FROM request WHERE id=?';
        return DB.query(query,[reqId]).then(function(result) {
            return DB.getSingleRow(result, self.rowToObj);
        });
    };

    self.getRequests = function() { // obtain all requests
        var query = 'SELECT id,rid,requester_id,invited_id,external_username,note_id,note_rid,request_status FROM request';
        return DB.query(query).then(function(result) {
            return DB.getAllRows(result, self.rowToObj);
        });
    };

    self.getRequestsByNoteRid = function(noteRid) {
        var query = 'SELECT id,rid,requester_id,invited_id,external_username,note_id,note_rid,request_status FROM request WHERE note_rid=?';
        return DB.query(query,[noteRid]).then(function(result) {
            return DB.getAllRows(result, self.rowToObj);
        });
    };

    self.getRequestsWithNoteName = function() {
        return self.getRequests().then(function(result) {
            var obtainNoteName = [];
            for (var i=0;i<result.length;i++) {
                if (result[i].note_id) {
                    obtainNoteName.push(DB.query('SELECT id,rid,title FROM note WHERE id=?',[result[i].note_id]));
                } else if (result[i].note_rid) {
                    obtainNoteName.push(DB.query('SELECT id,rid,title FROM note WHERE rid=?',[result[i].note_rid]));
                }
            }
            if (obtainNoteName.length>0) {
                return $q.all(obtainNoteName).then(function(noteNames) {
                    for (var j=0;j<result.length;j++) {
                        for (var k=0;k<noteNames.length;k++) {
                            for (var l=0;l<noteNames[k].rows.length;l++) {
                                if (result[j].note_id==noteNames[k].rows.item(l).id || result[j].note_rid==noteNames[k].rows.item(l).rid) {
                                    result[j].note_title=noteNames[k].rows.item(l).title;
                                    break;
                                }
                            }
                        }
                    }
                    return result;
                });
            } else {
                return result;
            }
        });
    };

    self.getAllRequests = function() {
        var query = 'SELECT id,rid,requester_id,invited_id,note_id,note_rid,request_status FROM request WHERE rid IS NOT NULL';
        return DB.query(query).then(function(result) {
            return DB.getAllRows(result, self.rowToObj);
        });
    };

    self.saveRequestFromRest = function(reqObject) { // save new requests
        var row = self.restToRow(reqObject);
        var query = 'INSERT INTO request (id,note_id,rid,requester_id,invited_id,external_username,note_rid,request_status) VALUES(NULL,NULL,'+DB.qMark(row)+')';
        return DB.query(query, row).then(function(result) {
            return reqObject;
        });
    };

    self.updateRequest = function(reqObject) { // update pending -> accepted
        var query = 'UPDATE request SET request_status=1 WHERE rid=?';
        return DB.query(query, [reqObject.id]).then(function(result) {
            return reqObject;
        });
    };

    self.deleteRequest = function(reqId) { // delete request when not found on rest or declined/cancelled/revoked
        var query = 'DELETE FROM request WHERE id=?';
        return DB.query(query, [reqId]).then(function(result) {
            return result.rowsAffected;
        });
    };

    self.deleteRequestByRid = function(reqRid) { // delete request when not found on rest or declined/cancelled/revoked
        var query = 'DELETE FROM request WHERE rid=?';
        return DB.query(query, [reqRid]).then(function(result) {
            return result.rowsAffected;
        });
    };

    self.truncateRequests = function() { // when user logs out
        var query = 'DELETE FROM request';
        return DB.query(query).then(function(result) {
            return result;
        });
    };

    self.insertPendingDelete = function(reqId,reqRid) {
        var query = 'INSERT INTO pending_request_delete (req_id,req_rid) VALUES (?,?)';
        return DB.query(query,[reqId,reqRid]).then(function(result) {
            return result.rowsAffected;
        });
    };

    self.removePendingDelete = function(reqRid) {
        var query = 'DELETE FROM pending_request_delete WHERE req_rid=?';
        return DB.query(query,[reqRid]).then(function(result) {
            return result.rowsAffected;
        });
    };

    self.getPendingDelete = function() {
        var query = 'SELECT id,req_id,req_rid FROM pending_request_delete';
        return DB.query(query).then(function(result) {
            return DB.getAllRows(result, self.pendToObj);
        });
    };

    self.requestExists = function(req) { // search a req
        var query = 'SELECT id FROM request WHERE rid=?';
        return DB.query(query, [req.id]).then(function(result) {
            if (result.rows.length==0) {
                req.found = false;
            } else {
                req.local_id = result.rows.item(0).id;
                req.found = true;
            }
            return req;
        });
    };

    self.objToRow = function(reqObject) {
        var row = [];
        row.push(reqObject.rid);
        row.push(reqObject.requester_id);
        row.push(reqObject.invited_id);
        row.push(reqObject.external_username);
        row.push(reqObject.note_id);
        row.push(reqObject.request_status);
        return row;
    };

    self.restToRow = function(reqObject) {
        var row = [];
        row.push(reqObject.id);
        row.push(reqObject.userRequester);
        row.push(reqObject.userInvited);
        row.push(reqObject.usernameInvited);
        row.push(reqObject.noteId);
        row.push(reqObject.requestStatus);
        return row;
    };

    self.rowToObj = function(reqRow) {
        var obj = {};
        obj.id = reqRow.id;
        obj.rid = reqRow.rid;
        obj.requester_id = reqRow.requester_id;
        obj.invited_id = reqRow.invited_id;
        obj.external_username = reqRow.external_username;
        obj.note_id = reqRow.note_id;
        obj.note_rid = reqRow.note_rid;
        obj.request_status = reqRow.request_status;
        obj.note_title = reqRow.title;
        return obj;
    };

    self.pendToObj = function(pendRow) {
        var obj = {};
        obj.id = pendRow.id;
        obj.req_id = pendRow.req_id;
        obj.req_rid = pendRow.req_rid;
        return obj;
    };

    return self;
})


.factory('RequestREST', function(DB,$http,$q,Utils,AuthService,RequestService,NoteService,NoteREST) {
    var self = this;

    self.obtainedRequests = [];
    self.obtainStatus = "NOK"; //if it's not connected, dont delete all the local requests :P

    self.synchronizeRequests = function() {
        return $http.get(Utils.restEndpoint+'/share',AuthService.header).then(function(result) {
            self.obtainStatus = result.statusText=="OK"?"OK":"NOK";
            var searchReq = [];
            self.obtainedRequests = [];
            for (var i=0;i<result.data.length;i++) {
                var req = result.data[i];
                self.obtainedRequests.push(req);
                searchReq.push(RequestService.requestExists(req));
            }
            return $q.all(searchReq).then(function(reqs) {
                var updAndInsRequests = [];
                for (var j=0;j<reqs.length;j++) {
                    if (!reqs[j].found) {
                        updAndInsRequests.push(RequestService.saveRequestFromRest(reqs[j]));
                    } else if (reqs[j].requestStatus==Utils.ACCEPTED) {
                        updAndInsRequests.push(RequestService.updateRequest(reqs[j]));
                    }
                }
                return $q.all(updAndInsRequests).then(function(updReqs) {
                    return AuthService.getUserId().then(function(userId) {
                        var obtainedNotes = [];
                        for (var k=0;k<updReqs.length;k++) {
                            if (updReqs[k].userInvited==userId && updReqs[k].requestStatus) {
                                obtainedNotes.push(NoteREST.retrieveNote(updReqs[k].noteId));
                            }
                        }
                        return $q.all(obtainedNotes).then(function(notes) {
                            var noteExists = [];
                            for (var l=0;l<notes.length;l++) {
                                noteExists.push(NoteService.findByRid(notes[l]));
                            }
                            return $q.all(noteExists).then(function(exists) {
                                var newUpdNotes = [];
                                for (var m=0;m<exists.length;m++) {
                                    if (!exists[m].ridFound) {
                                        exists[m].shared='Y';
                                        newUpdNotes.push(NoteService.createExistingNote(exists[m]));
                                    } else {
                                        var localDate = Utils.parseCustomDate(exists[m].local_last_update);
                                        var remoteDate = Utils.parseCustomDate(exists[m].lastUpdate);
                                        if (remoteDate>localDate) {
                                            var updatedNote = {};
                                            updatedNote.title = exists[m].title;
                                            updatedNote.content = exists[m].content;
                                            updatedNote.last_update = exists[m].lastUpdate;
                                            updatedNote.rid = exists[m].id;
                                            newUpdNotes.push(NoteService.updateExistingNoteByRid(updatedNote));
                                        }
                                    }
                                }
                                return $q.all(newUpdNotes).then(function(createdUpdatedNotes) {
                                    return createdUpdatedNotes;
                                });
                            });
                        });
                    });
                });
            });
        });
    };

    self.clearNotFoundRequests = function() {
        return AuthService.getUserId().then(function(userId) {
            if (self.obtainStatus=="OK") {
                return RequestService.getAllRequests().then(function(localRequests) {
                    var deletes = [];
                    for (var i=0;i<localRequests.length;i++) {
                        var localReq = localRequests[i];
                        var found = false;
                        for (var j=0;j<self.obtainedRequests.length;j++) {
                            var remoteReq = self.obtainedRequests[j];
                            if (localReq.rid==remoteReq.id) {
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            deletes.push(RequestService.deleteRequest(localReq.id));
                            if (localReq.request_status==Utils.ACCEPTED) {
                                if (localReq.invited_id==userId) {
                                    deletes.push(NoteService.removeNoteByRid(localReq.note_rid));
                                }
                            }
                        }
                    }
                    return $q.all(deletes).then(function(res) {
                        return res;
                    });
                });
            }
        });
    };

    self.acceptRequest = function(localReqId) {
        return AuthService.getUserId().then(function(userId) {
            return RequestService.getSingleRequest(localReqId).then(function(req) {
                if (req.request_status==0 && req.invited_id==userId) {
                    return $http.post(Utils.restEndpoint+'/share/'+req.rid,'',AuthService.header).then(function(result) {
                        if (result.statusText=='OK') {
                            var recvReq = JSON.parse(JSON.stringify(result.data));
                            if (recvReq!==undefined && recvReq.id && recvReq.id>0) {
                                return RequestService.updateRequest(req).then(function(updReq) {
                                    return recvReq.id;
                                });
                            } else {
                                return 0;
                            }
                        } else {
                            return 0;
                        }
                    }, function(err) {
                        return 0;
                    });
                } else {
                    return 0;
                }
            });
        });
    };

    self.removeRequest = function(localReqId) {
        return AuthService.getUserId().then(function(userId) {
            return RequestService.getSingleRequest(localReqId).then(function(req) {
                return $http.delete(Utils.restEndpoint+'/share/'+req.rid,AuthService.header).then(function(result) {
                    if (result.statusText=='OK') {
                        var recvReq = JSON.parse(JSON.stringify(result.data));
                        if (recvReq!==undefined && recvReq.id && recvReq.id>0) {
                            return RequestService.deleteRequest(localReqId).then(function(delReq) {
                                if (req.invited_id==userId) {
                                    return NoteService.removeNoteByRid(req.note_rid).then(function(res) {
                                        return {wasDel:delReq,reqRid:req.rid};
                                    });
                                } else {
                                    return {wasDel:delReq,reqRid:req.rid};
                                }
                            });
                        } else {
                            return 0;
                        }
                    } else {
                        return 0;
                    }
                }, function (err) { //not connected? delete from local now, and leave a pending request delete for later
                    var pendAndReqs = [];
                    pendAndReqs.push(RequestService.deleteRequest(localReqId));
                    pendAndReqs.push(RequestService.insertPendingDelete(localReqId,req.rid));
                    pendAndReqs.push(NoteService.removeNoteByRid(req.note_rid));
                    return $q.all(pendAndReqs).then(function(pends) {
                        return 1;
                    });
                });
            });
        });
    };

    self.removePendingRequests = function() {
        return RequestService.getPendingDelete().then(function(pends) {
            var remReq = [];
            for (var i=0;i<pends.length;i++) {
                remReq.push($http.delete(Utils.restEndpoint+'/share/'+pends[i].req_rid,AuthService.header));
            }
            return $q.all(remReq).then(function(remReqs) {
                var localRem = [];
                for (var k=0;k<remReqs.length;k++) {
                    if (remReqs[k].statusText=="OK") {
                        localRem.push(RequestService.removePendingDelete(remReqs[k].data.id));
                    }
                }
                return $q.all(localRem).then(function(result) {
                    return result;
                });
            });
        });
    };

    self.sendRequest = function(noteRid, username) {
        return AuthService.getUserId().then(function(userId) {
            var request = {};
            request.noteId = noteRid;
            request.usernameInvited = username;
            return $http.put(Utils.restEndpoint+'/share',JSON.stringify(request),AuthService.header).then(function(response) {
                if (response.statusText=='OK') {
                    var recvReq = JSON.parse(JSON.stringify(response.data));
                    if (recvReq!==undefined && recvReq.id && recvReq.id>0) {
                        var localReq = {};
                        localReq.id = recvReq.id;
                        localReq.userRequester = userId;
                        localReq.userInvited = recvReq.userInvited;
                        localReq.noteId = noteRid;
                        localReq.usernameInvited = username;
                        localReq.requestStatus = 0;
                        return RequestService.saveRequestFromRest(localReq).then(function(theReq) {
                            return theReq;
                        });
                    } else {
                        return 0;
                    }
                } else {
                    return 0;
                }
            }, function(response) {
                return 0;
            });
        });
    };

    return self;
})

.factory('MetaREST', function(Utils,$http) {
    var self = this;

    self.checkServer = function() {
        return $http.post(Utils.restEndpoint+'/meta',"are you the note server?").then(function(res) {
            var answer = res.data;
            if (answer=="yes i am!") {
                return true;
            } else {
                return false;
            }
        }, function(response) {
            return false;
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

    this.PENDING = 0;
    this.ACCEPTED = 1;
    this.DECLINED = 2;
    this.CANCELLED = 3;

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