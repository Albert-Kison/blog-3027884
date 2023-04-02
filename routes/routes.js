var dbconfig = {
  host: "eu-cdbr-west-03.cleardb.net",
  user: "bd152ac13ceb1d",
  password: "9c936981",
  database: "heroku_7e6d39f4f942566",
}
var connection = require('mysql').createConnection(dbconfig);
var bcrypt = require('bcrypt-nodejs');

connection.connect(function(err) {
  if (err) throw err;
  console.log("Connected!");
  connection.query('USE ' + dbconfig.database);
});


module.exports = function(app, passport) {
 app.get('/', function(req, res){
  if (req.user && req.user.status === "admin") res.redirect("/admin")
  else {
    connection.query("select * from posts", function(err, rows) {
      let error;
      if (err) {error = err;
      
      } 

      res.render('index.ejs', {isAuthenticated: req.isAuthenticated(), posts: rows, error: error});
      
    })
  }
 });

 app.get("/admin", function(req, res) {
  if (!req.isAuthenticated()) res.redirect("/")
  else if (req.user.status !== "admin") res.redirect("/");
  else {
    connection.query("select * from posts", function(err, posts) {
    let error;
    if (err) {error = err;
    } 
    
    connection.query("select * from users", function(err, users) {
      let error;
      if (err) {error = err;
      } 

      res.render("admin.ejs", {isAuthenticated: req.isAuthenticated(), posts: posts, users: users, current_user: req.user, error: err});
    })
    
    })
  }
 })

 app.get('/login', function(req, res){
	 //console.log(req.flash('loginMessage'));
  res.render('login.ejs', {message:req.flash('loginMessage')});
 });

 app.post('/login', passport.authenticate('local-login', {
  successRedirect: '/',
  failureRedirect: '/login',
  failureFlash: true     
 }),
  function(req, res){
   if(req.body.remember){
    req.session.cookie.maxAge = 1000 * 60 * 60 * 24;  // remember for 24 hours
   }else{
    req.session.cookie.expires = false;
   }
   res.redirect('/');
  });

 app.get('/signup', function(req, res){
  res.render('signup.ejs', {message: req.flash('signupMessage')});
 });

 app.post('/signup', passport.authenticate('local-signup', {
  successRedirect: '/',
  failureRedirect: '/signup',
  failureFlash: true
 }));

 app.get('/profile', isLoggedIn, function(req, res){
  connection.query(`select * from users where user_id=${req.user.user_id}`, function(err, rows) {
    const user = rows[0];
    res.render('profile.ejs', {
      isAuthenticated: true,
     user: user
    });
  });
 });

 app.get('/logout', function(req,res){
  req.logout(function(err) {
    if (err) console.log(err);  
    res.redirect('/');
  }); // provided by passport and remove the req.user property and clear the login session (if any)
 })

 app.get('/add_post', isLoggedIn, function(req, res) {
  if (req.user.status === "admin") {
    res.render('add_post.ejs', {isAuthenticated: req.isAuthenticated()});
  } else {
    res.redirect("/")
  }
 })

 app.post('/add_post', isLoggedIn, function(req, res) {
  if (req.user.status === "admin") {
    console.log(req.user);
    console.log(req.body);
    var insertQuery = "INSERT INTO posts (user_id, publisher_name, date_published, title, content) values (?, ?, NOW(), ?, ?)";

    connection.query(insertQuery, [req.user.user_id, req.user.name, req.body.title, req.body.content],
    function(err, rows){
      console.log(rows);
      if (err) console.log(err)
      else res.redirect("/");
    });
  } else {
    res.redirect("/");
  }
 });


 app.get('/add_user', isLoggedIn, function(req, res) {
   if (req.user.status === "admin") {
     res.render('add_user.ejs', {isAuthenticated: req.isAuthenticated()});
   } else {
     res.redirect("/")
   }
  });

  app.post('/add_user', isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      console.log(req.body);
      var insertQuery = "INSERT INTO users (name, email, password, status) values (?, ?, ?, ?)";
  
      connection.query(insertQuery, [req.body.name, req.body.email, bcrypt.hashSync(req.body.password, null, null), req.body.user_status],
      function(err, rows){
        console.log(rows);
        if (err) console.log(err)
        else res.redirect("/");
      });
    } else {
      res.redirect("/");
    }
  });

  app.get("/post/:postId", function(req, res) {
    const postId = req.params.postId;
    console.log(postId);
    connection.query(`select * from posts where post_id=${postId}`, function(err, rows) {
      if (err) console.log(err);
      console.log(rows);
      connection.query(`SELECT users.user_id, users.name AS user, comments.comment_id, comments.comment FROM comments JOIN users ON comments.user_id = users.user_id
      WHERE comments.post_id = ${postId}`, function(err, results) {
        if (err) console.log(err);
        console.log(results);

        const comments = [];

        // assuming the SQL query has been executed and the rows are stored in a variable called `rows`
        for (let row of results) {
          comments.push({user: {user_id: row.user_id, name: row.user}, comment: {comment_id: row.comment_id, comment: row.comment}});
        }
        console.log(comments);

        res.render("read_post", {isAuthenticated: req.isAuthenticated(), post: rows[0], comments: comments, current_user: req.user});
      });
    });
  });

  app.post("/add_comment/:postId", isLoggedIn, function(req, res) {
    const postId = req.params.postId;
    var insertQuery = "INSERT INTO comments (user_id, post_id, comment) values (?, ?, ?)";

    connection.query(insertQuery, [req.user.user_id, postId, req.body.comment], function(err, rows) {
      console.log(rows);
      if (err) console.log(err)
      else res.redirect(`/post/${postId}`);
    });
  });

  app.get("/edit_post/:postId", isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      const postId = req.params.postId;
      connection.query(`select * from posts where post_id=${postId}`, function(err, rows) {
        if (err) console.log(err);
        console.log(rows);

        res.render("edit_post", {isAuthenticated: req.isAuthenticated(), post: rows[0]});
      })
    } else {
      res.redirect("/")
    }
  });

  app.post("/edit_post/:postId", isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      const postId = req.params.postId;
      connection.query(`update posts set title=?, content=? where post_id=?`, [req.body.title, req.body.content, postId], function(err, rows) {
        if (err) console.log(err);
        console.log(rows);

        res.redirect("/");
      })
    } else {
      res.redirect("/")
    }
  });

  app.get("/remove_post/:postId", isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      const postId = req.params.postId;

      connection.query("delete from posts where post_id=?", [postId], function(err, rows) {
        if (err) console.log(err);
        console.log(rows);

        res.redirect("/");
      })
    } else {
      res.redirect("/")
    }
  });

  app.get("/edit_user/:userId", isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      const userId = req.params.userId;

      connection.query(`select * from users where user_id=${userId}`, function(err, rows) {
        if (err) console.log(err);
        console.log(rows);

        res.render("edit_user", {isAuthenticated: req.isAuthenticated(), user: rows[0]});
      })
    } else {
      res.redirect("/")
    }
  });

  app.post("/edit_user/:userId", isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      const userId = req.params.userId;
      connection.query(`update users set name=?, email=?, password=?, status=? where user_id=?`, [req.body.name, req.body.email, bcrypt.hashSync(req.body.password, null, null), req.body.user_status, userId], function(err, rows) {
        if (err) console.log(err);
        console.log(rows);

        res.redirect("/");
      })
    } else {
      res.redirect("/")
    }
  });

  app.get("/remove_user/:userId", isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      const userId = req.params.userId;

      connection.query("delete from users where user_id=?", [userId], function(err, rows) {
        if (err) console.log(err);
        console.log(rows);

        res.redirect("/");
      })
    } else {
      res.redirect("/")
    }
  });

  app.get("/edit_comment/:postId/:commentId", isLoggedIn, function(req, res) {
      const commentId = req.params.commentId;

      const postId = req.params.postId;
      console.log(postId);
      connection.query(`select * from posts where post_id=${postId}`, function(err, rows) {
        if (err) console.log(err);
        console.log(rows);
        connection.query(`SELECT users.user_id, users.name AS user, comments.comment_id, comments.comment FROM comments JOIN users ON comments.user_id = users.user_id
        WHERE comments.post_id = ${postId}`, function(err, results) {
          if (err) console.log(err);
          console.log(results);

          const comments = [];

          // assuming the SQL query has been executed and the rows are stored in a variable called `rows`
          for (let row of results) {
            comments.push({user: {user_id: row.user_id, name: row.user}, comment: {comment_id: row.comment_id, comment: row.comment}});
          }
          console.log(comments);

          connection.query("select * from comments where comment_id=?", [commentId], function(err, results2) {
            if (err) console.log(err);
            console.log(results2[0]);

            res.render("edit_comment", {isAuthenticated: req.isAuthenticated(), post: rows[0], comments: comments, current_user: req.user, comment_to_edit: results2[0]});
          })

        });
      });
  });

  app.post("/edit_comment/:postId/:commentId", isLoggedIn, function(req, res) {
      const commentId = req.params.commentId;
      const postId = req.params.postId;
      connection.query(`update comments set comment=? where comment_id=?`, [req.body.comment, commentId], function(err, rows) {
        if (err) console.log(err);
        console.log(rows);

        res.redirect(`/post/${postId}`);
      })
  });

  app.get("/remove_comment/:postId/:commentId", isLoggedIn, function(req, res) {
      const postId = req.params.postId;
      const commentId = req.params.commentId;

      connection.query("delete from comments where comment_id=?", [commentId], function(err, rows) {
        if (err) console.log(err);
        console.log(rows);

        res.redirect(`/post/${postId}`);
      })
  });
}


function isLoggedIn(req, res, next){
 if(req.isAuthenticated())
  return next();

 res.redirect('/login');
}