var LocalStrategy = require("passport-local").Strategy;

var mysql = require('mysql');
var bcrypt = require('bcrypt-nodejs');
var dbconfig = require('./database');
var connection = require('mysql').createConnection({
  host: "127.0.0.1",
  user: "root",
  password: "12345MYsql!",
  database: "blog",
});

connection.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
  connection.query('USE ' + dbconfig.database);
});


module.exports = function(passport) {
 passport.serializeUser(function(user, done){
  done(null, user.user_id);
 });

 passport.deserializeUser(function(id, done){
  connection.query("SELECT * FROM users WHERE user_id = ? ", [id],
   function(err, rows){
    done(err, rows[0]);
   });
 });

 // Middleware - set up the strategy to be used for the sign in
 // LocalStrategy sets up login using username & password
 passport.use(
  'local-signup',
  new LocalStrategy({
   usernameField : 'email',
   passwordField: 'password',
   passReqToCallback: true
  },
  function(req, email, password, done){
   connection.query("SELECT * FROM users WHERE email = ? ", 
   [email], function(err, rows){
    if(err)
     return done(err);
    if(rows.length){
     return done(null, false, req.flash('signupMessage', 'That is already taken'));
    }else{
     var newUserMysql = {
      name: req.body.name,
      email: email,
      password: bcrypt.hashSync(password, null, null),
      status: "user"
     };

     var insertQuery = "INSERT INTO users (name, email, password, status) values (?, ?, ?, ?)";

     connection.query(insertQuery, [newUserMysql.name, newUserMysql.email, newUserMysql.password, newUserMysql.status],
      function(err, rows){
        if (err) {
          return done(err);
        }
        console.log(rows);
       newUserMysql.user_id = rows.insertId;

       return done(null, newUserMysql);
      });
    }
   });
  })
 );

  // Middleware - set up the strategy to be used for the login
 passport.use(
  'local-login',
  new LocalStrategy({
   usernameField : 'email',
   passwordField: 'password',
   passReqToCallback: true
  },
  function(req, email, password, done){
   connection.query("SELECT * FROM users WHERE email = ? ", [email],
   function(err, rows){
    if(err)
     return done(err);
    if(!rows.length){
     return done(null, false, req.flash('loginMessage', 'Incorrect username/password combination'));
    }
    if(!bcrypt.compareSync(password, rows[0].password))
     return done(null, false, req.flash('loginMessage', 'Incorrect username/password combination'));

    return done(null, rows[0]);
   });
  })
 );
};