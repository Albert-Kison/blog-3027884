var LocalStrategy = require("passport-local").Strategy;

var mysql = require('mysql');
var bcrypt = require('bcrypt-nodejs');
var dbconfig = {
  host: "eu-cdbr-west-03.cleardb.net",
  user: "bd152ac13ceb1d",
  password: "9c936981",
  database: "heroku_7e6d39f4f942566",
}
var connection = require('mysql').createPool(dbconfig);

connection.query('USE ' + dbconfig.database, function(err, rows) {
  if (err) throw err;
  console.log("Connected!");
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