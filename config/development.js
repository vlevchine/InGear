module.exports = {
    redis: {
        host: '127.0.0.1',
        port: 6379,
        options: {
            //auth_pass: 'password' // enable as needed
        },
        db: 0 // selected Redis database
    },
    registerEndpoint: 'http://localhost:3080/register'
};