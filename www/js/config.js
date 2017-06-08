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
                {name: 'favorite', type: 'text'}
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

