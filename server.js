require("dotenv").config();

var express = require("express");
var passport = require("passport");
var Strategy = require("passport-twitter").Strategy;

const low = require("lowdb");
const FileSync = require("lowdb/adapters/FileSync");

const adapter = new FileSync("tokens.json");
const db = low(adapter);
db.defaults({ accounts: [] }).write();

// Configure the Twitter strategy for use by Passport.
//
// OAuth 1.0-based strategies require a `verify` function which receives the
// credentials (`token` and `tokenSecret`) for accessing the Twitter API on the
// user's behalf, along with the user's profile.  The function must invoke `cb`
// with a user object, which will be set at `req.user` in route handlers after
// authentication.
passport.use(
  new Strategy(
    {
      consumerKey: process.env["CONSUMER_KEY"],
      consumerSecret: process.env["CONSUMER_SECRET"],
      callbackURL: process.env["BASEURL"] + "/auth/twitter/callback",
    },
    function (token, tokenSecret, profile, cb) {
      // In this example, the user's Twitter profile is supplied as the user
      // record.  In a production-quality application, the Twitter profile should
      // be associated with a user record in the application's database, which
      // allows for account linking and authentication with other identity
      // providers.

      // var Twit = require("twit");

      // var T = new Twit({
      //   consumer_key: process.env["CONSUMER_KEY"], //get this from developer.twitter.com where your app info is
      //   consumer_secret: process.env["CONSUMER_SECRET"], //get this from developer.twitter.com where your app info is
      //   access_token: token,
      //   access_token_secret: tokenSecret,
      //   timeout_ms: 60 * 1000, // optional HTTP request timeout to apply to all requests.
      //   strictSSL: true, // optional - requires SSL certificates to be valid.
      // });

      db.get("accounts")
        .push({
          id: profile.id,
          user: profile.username,
          token,
          tokenSecret,
          used: false,
        })
        .write();

      const newAccounts = db.get("accounts").uniqBy("user").value();

      db.set("accounts", newAccounts).write();

      console.log(profile.username);
      console.log(token);
      console.log(tokenSecret);

      //
      //  tweet 'hello world!'
      //
      // T.post('statuses/update', { status: 'hello world!' }, function(err,
      // data, response) {
      //   console.log(data)
      // })

      return cb(null, profile);
    }
  )
);

// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  In a
// production-quality application, this would typically be as simple as
// supplying the user ID when serializing, and querying the user record by ID
// from the database when deserializing.  However, due to the fact that this
// example does not have a database, the complete Twitter profile is serialized
// and deserialized.
passport.serializeUser(function (user, cb) {
  cb(null, user);
});

passport.deserializeUser(function (obj, cb) {
  cb(null, obj);
});

// Create a new Express application.
var app = express();

// Configure view engine to render EJS templates.
app.set("views", __dirname + "/views");
app.set("view engine", "ejs");

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require("morgan")("combined"));
app.use(require("body-parser").urlencoded({ extended: true }));
app.use(
  require("express-session")({
    secret: "keyboard cat",
    resave: true,
    saveUninitialized: true,
  })
);

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());

// Define routes.
app.get("/", function (req, res) {
  res.render("home", { user: req.user });
});

app.get("/login", function (req, res) {
  console.log("Headers:");
  console.log(req.headers);
  res.render("login");
});

app.get("/login/twitter", passport.authenticate("twitter"));

app.get(
  "/auth/twitter/callback",
  passport.authenticate("twitter", { failureRedirect: "/login" }),
  function (req, res) {
    res.redirect("/");
  }
);

app.get("/profile", require("connect-ensure-login").ensureLoggedIn(), function (
  req,
  res
) {
  res.render("profile", { user: req.user });
});

app.get("/logout", function (req, res) {
  req.session.destroy(function (err) {
    res.redirect("/");
  });
});

app.get(
  "/unregister",
  require("connect-ensure-login").ensureLoggedIn(),
  (req, res) => {
    console.log(req.user.username);
    db.get("accounts").remove({ user: req.user.username }).write();
    res.redirect("/logout");
  }
);

app.listen(process.env["PORT"] || 8080);
