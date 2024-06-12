// This could was provided by Arjun Araneta
// https://www.youtube.com/watch?v=FblRpXa1WwU&t=150s
// It has a few amendments
var express = require('express');
var session = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var morgan = require('morgan'); // Logs the requests to the console
var app = express();

var passport = require('passport');
var flash = require('connect-flash');

require('./config/passport')(passport);

app.use(morgan('dev'));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: true }));

app.set('view engine', 'ejs');
app.use(express.static("public"));
app.use("/uploads", express.static("uploads"));

// Set up the session middleware
app.use(session({
 secret: 'justasehhjjkyffdcret',
 resave:true, //false
 saveUninitialized: true  //false
}));

// Set up the passport middleware and the flash
app.use(passport.initialize());
app.use(passport.session());
app.use(flash()); //

require('./routes/routes.js')(app, passport);

// process.env.PORT || 5000
app.listen(process.env.PORT || 5001, function () {
  console.log("Server listening on port 3000"); 
});