angular.module('starter.config', [])

.constant('DB_CONFIG', {
    name: 'DB',
    tables: [
        {
            name: 'note',
            columns: [
                {name: 'id', type: 'integer primary key'},
                {name: 'rid', type: 'integer'},
                {name: 'title', type: 'text'},
                {name: 'content', type: 'text'},
                {name: 'status_flag', type: 'text'},
                {name: 'last_update', type: 'text'},
                {name: 'favorite', type: 'text'},
                {name: 'shared', type: 'text'}
            ]
        },
        {
            name: 'request',
            columns: [
                {name: 'id', type: 'integer primary key'},
                {name: 'rid', type: 'integer'},
                {name: 'requester_id', type: 'integer'},
                {name: 'invited_id', type: 'integer'},
                {name: 'external_username', type: 'text'},
                {name: 'note_id', type: 'integer'},
                {name: 'note_rid', type: 'integer'},
                {name: 'request_status', type: 'integer'}
            ]
        },
        {
            name: 'pending_request_delete',
            columns: [
                {name: 'id', type: 'integer primary key'},
                {name: 'req_id', type: 'integer'},
                {name: 'req_rid', type: 'integer'}
            ]
        },
        {
            name: 'note_tip',
            columns: [
                {name: 'id', type: 'integer primary key'},
                {name: 'note_rid', type: 'integer'}
            ]
        },
        {
            name: 'settings',
            columns: [
                {name: 'setting_key', type: 'text'},
                {name: 'setting_value', type: 'text'}
            ]
        }
    ]
});

