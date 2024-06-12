var bcrypt = require('bcrypt-nodejs');

//configure image uploading
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads')
  },
  filename: function (req, file, cb) {
    cb(null, file.fieldname + '-' + Date.now())
  }
});
const upload = multer({ storage: storage })

//connect to the database
var dbconfig = require("../config/database");
var connection = require('mysql').createPool(dbconfig);
connection.query('USE ' + dbconfig.database, function(err, rows) {
  if (err) throw err;
  console.log("Connected!");
});


module.exports = function(app, passport) {

  //This route is for users with status "user"
  //It fetches 10 latest and renders the index.ejs page
 app.get('/', function(req, res){

  //if the user is admin, then redirect to the admin page
  if (req.user && req.user.status === "admin") res.redirect("/admin")
  else {
    connection.query("SELECT * FROM posts ORDER BY date_published DESC LIMIT 10", function(err, posts) {
      if (err) {
        console.log(err);     
      } 

      res.render('index.ejs', {isAuthenticated: req.isAuthenticated(), posts: posts});
      
    })
  }
 });



 //This route is for users with status "admin"
 //It fetches 10 latest and users and renders the admin.ejs page
 app.get("/admin", function(req, res) {

  //check if the user is admin
  if (!req.isAuthenticated()) res.redirect("/")
  else if (req.user.status !== "admin") res.redirect("/");
  else {
    //get 10 latest posts
    connection.query("SELECT * FROM posts ORDER BY date_published DESC LIMIT 10", function(err, posts) {
    if (err) {
      console.log(err);
    } 
    
    //get the users
    connection.query("select * from users", function(err, users) {
      if (err) {
        console.log(err);
      } 

      res.render("admin.ejs", {isAuthenticated: req.isAuthenticated(), posts: posts, users: users, current_user: req.user});
    })
    
    })
  }
 });



 //This route renders the blog.ejs page where all posts are displayed
 app.get("/posts", function(req, res) {
  connection.query("SELECT * FROM posts ORDER BY date_published DESC", function(err, posts) {
    if (err) {
      console.log(err);
    } 

    res.render('blog.ejs', {isAuthenticated: req.isAuthenticated(), posts: posts, user: req.user ? req.user : ""});
    
  })
 })



 //renders the login.ejs page
 app.get('/login', function(req, res){
  res.render('login.ejs', {isAuthenticated: req.isAuthenticated(), message:req.flash('loginMessage')});
 });



 //logins the user through passport and sets the cookie
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



  //renders the users profile
 app.get('/profile', isLoggedIn, function(req, res){
  connection.query(`select * from users where user_id=${req.user.user_id}`, function(err, rows) {
    const user = rows[0];
    res.render('profile.ejs', {
      isAuthenticated: req.isAuthenticated(),
      user: user
    });
  });
 });



 //logs the user out and destroys the session, provided by passport
 app.get('/logout', function(req,res){
  req.logout(function(err) {
    if (err) console.log(err);  
    res.redirect('/');
  });
 })



 //renders add_post.ejs which allows the admin users to write a post
 app.get('/add_post', isLoggedIn, function(req, res) {
  if (req.user.status === "admin") {
    res.render('add_post.ejs', {isAuthenticated: req.isAuthenticated()});
  } else {
    res.redirect("/");
  }
 })



 //processes the form and inserts the post into the posts table
 app.post('/add_post', isLoggedIn, upload.single('image'), function(req, res) {
  if (req.user.status === "admin") {
    var insertQuery = "INSERT INTO posts (user_id, publisher_name, date_published, img_url, img_alt, title, content) values (?, ?, NOW(), ?, ?, ?, ?)";

    connection.query(insertQuery, [req.user.user_id, req.user.name, req.file ? req.file.path : "", req.file ? req.body.img_alt : "", req.body.title, req.body.content],
    function(err, rows){
      if (err) console.log(err)
      else res.redirect("/");
    });
  } else {
    res.redirect("/");
  }
 });



 //renders add_user.ejs which allows the admin users to add a user
 app.get('/add_user', function(req, res) {
  //  if (req.user.status === "admin") {
     res.render('add_user.ejs', {isAuthenticated: req.isAuthenticated()});
  //  } else {
  //    res.redirect("/");
  //  }
  });



  //processes the form and inserts the user into the users table
  app.post('/add_user', function(req, res) {
    // if (req.user.status === "admin") {
      console.log(req.body);
      var insertQuery = "INSERT INTO users (name, email, password, status) values (?, ?, ?, ?)";
  
      connection.query(insertQuery, [req.body.name, req.body.email, bcrypt.hashSync(req.body.password, null, null), req.body.user_status],
      function(err, rows){
        console.log(rows);
        if (err) console.log(err)
        else res.redirect("/");
      });
    // } else {
    //   res.redirect("/");
    // }
  });



  //renders read_post.ejs where the post with the provided id and the comments related to the post are displayed
  app.get("/post/:postId", function(req, res) {
    const postId = req.params.postId;
    connection.query(`select * from posts where post_id=${postId}`, function(err, posts) {
      if (err) console.log(err);

      connection.query(`SELECT users.user_id, users.name AS user, comments.comment_id, comments.comment FROM comments JOIN users ON comments.user_id = users.user_id
      WHERE comments.post_id = ${postId}`, function(err, rows) {
        if (err) console.log(err);
        console.log(rows);

        const comments = [];

        for (let row of rows) {
          comments.push({user: {user_id: row.user_id, name: row.user}, comment: {comment_id: row.comment_id, comment: row.comment}});
        }
        console.log(comments);

        res.render("read_post", {isAuthenticated: req.isAuthenticated(), post: posts[0], comments: comments, current_user: req.user});
      });
    });
  });



  //processes the form and inserts the comment into the comments table
  app.post("/add_comment/:postId", isLoggedIn, function(req, res) {
    const postId = req.params.postId;
    var insertQuery = "INSERT INTO comments (user_id, post_id, comment) values (?, ?, ?)";

    connection.query(insertQuery, [req.user.user_id, postId, req.body.comment], function(err, rows) {
      if (err) console.log(err)
      else res.redirect(`/post/${postId}`);
    });
  });



  //renders edit_post.ejs that allows admin users to edit the post
  app.get("/edit_post/:postId", isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      const postId = req.params.postId;
      connection.query(`select * from posts where post_id=${postId}`, function(err, posts) {
        if (err) console.log(err);

        res.render("edit_post", {isAuthenticated: req.isAuthenticated(), post: posts[0]});
      })
    } else {
      res.redirect("/");
    }
  });



  //updates the post in the posts table
  app.post("/edit_post/:postId", isLoggedIn, upload.single('image'), function(req, res) {
    if (req.user.status === "admin") {
      const postId = req.params.postId;

      //if image file exists
      if (req.file) {
        connection.query(`update posts set img_url=?, img_alt=?, title=?, content=? where post_id=?`, [req.file.path, req.body.img_alt, req.body.title, req.body.content, postId], function(err, rows) {
          if (err) console.log(err);

          res.redirect("/");
        })
      } else {
        connection.query(`update posts set img_alt=?, title=?, content=? where post_id=?`, [req.body.img_alt, req.body.title, req.body.content, postId], function(err, rows) {
          if (err) console.log(err);
          console.log(rows);

          res.redirect("/");
        })
      }
    } else {
      res.redirect("/");
    }
  });



  //removes the post
  app.get("/remove_post/:postId", isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      const postId = req.params.postId;

      connection.query("delete from posts where post_id=?", [postId], function(err, rows) {
        if (err) console.log(err);
        console.log(rows);

        res.redirect("/");
      })
    } else {
      res.redirect("/");
    }
  });



  //renders edit_user.ejs that allows admin users to edit the user
  app.get("/edit_user/:userId", isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      const userId = req.params.userId;

      connection.query(`select * from users where user_id=${userId}`, function(err, users) {
        if (err) console.log(err);

        res.render("edit_user", {isAuthenticated: req.isAuthenticated(), user: users[0]});
      })
    } else {
      res.redirect("/");
    }
  });



  //processes the form and updates the user with the provided user_id
  app.post("/edit_user/:userId", isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      const userId = req.params.userId;

      //if the password was not provided
      if (req.body.password === "") {
        res.redirect("/edit_user/" + userId);
      } else {
        connection.query(`update users set name=?, email=?, password=?, status=? where user_id=?`, [req.body.name, req.body.email, bcrypt.hashSync(req.body.password, null, null), req.body.user_status, userId], function(err, rows) {
          if (err) console.log(err);

          res.redirect("/");
        })
      }
    } else {
      res.redirect("/");
    }
  });



  //removes the user with the provided user_id
  app.get("/remove_user/:userId", isLoggedIn, function(req, res) {
    if (req.user.status === "admin") {
      const userId = req.params.userId;

      connection.query("delete from users where user_id=?", [userId], function(err, rows) {
        if (err) console.log(err);

        res.redirect("/");
      })
    } else {
      res.redirect("/");
    }
  });



  //renders edit_comment.ejs that allows the users to edit their comment
  app.get("/edit_comment/:postId/:commentId", isLoggedIn, function(req, res) {
      const commentId = req.params.commentId;
      const postId = req.params.postId;

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



  //updates the comment
  app.post("/edit_comment/:postId/:commentId", isLoggedIn, function(req, res) {
      const commentId = req.params.commentId;
      const postId = req.params.postId;
      connection.query(`update comments set comment=? where comment_id=?`, [req.body.comment, commentId], function(err, rows) {
        if (err) console.log(err);
        console.log(rows);

        res.redirect(`/post/${postId}`);
      })
  });



  //removes the comment
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