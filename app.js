const express = require('express');
const mysql = require('mysql2');
const session = require('express-session');
const flash = require('connect-flash');
const multer = require('multer');
const app = express();

// Set up multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'public/images'); // Directory to save uploaded files
    },
    filename: (req, file, cb) => {
        cb(null, file.originalname); 
    }
});

const upload = multer({ storage: storage });

const db = mysql.createConnection({
    host: 'y20w5f.h.filess.io',
    port: 3307,
    user: 'Ca2_cagesummer',
    password: '6a2219a0553c16c6d1268ac34c04f60757a09fa0',
    database: 'Ca2_cagesummer'
  });

db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('Connected to MySQL database');
});

// Set up view engine
app.set('view engine', 'ejs');
//  enable static files
app.use(express.static('public'));
// enable form processing
app.use(express.urlencoded({
    extended: false
}));

//TO DO: Insert code for Session Middleware below 
app.use(session({
    secret: 'secret',
    resave: false,
    saveUninitialized: true,
    // Session expires after 1 week of inactivity
    cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } 
}));

app.use(flash());

// Middleware to check if user is logged in
const checkAuthenticated = (req, res, next) => {
    if (req.session.user) {
        return next();
    } else {
        req.flash('error', 'Please log in to view this resource');
        res.redirect('/login');
    }
};

// Middleware to check if user is admin
const checkAdmin = (req, res, next) => {
    if (req.session.user.role === 'admin') {
        return next();
    } else {
        req.flash('error', 'Access denied');
        res.redirect('/view');
    }
};

// Middleware for form validation
const validateRegistration = (req, res, next) => {
    const { username, email, password, address, contact, role } = req.body;

    if (!username || !email || !password || !address || !contact || !role) {
        return res.status(400).send('All fields are required.');
    }
    
    if (password.length < 6) {
        req.flash('error', 'Password should be at least 6 characters long');
        req.flash('formData', req.body);
        return res.redirect('/register');
    }
    next();
};

// Define routes
app.get('/',  (req, res) => {
    const moviePosters = [
        "darkknight.jpg",
        "dune.jpg",
        "inception.jpg",
        "lionking.jpg",
        "hangover.jpg"
    ];
  res.render("index", { user: req.session.user, posters: moviePosters });
});

app.get('/inventory', checkAuthenticated, checkAdmin, (req, res) => {
    // Fetch data from MySQL
    db.query('SELECT * FROM movies', (error, results) => {
      if (error) throw error;
      res.render('inventory', { movies: results, user: req.session.user });
    });
});
// register/login- misha
app.get('/register', (req, res) => {
    res.render('register', { messages: req.flash('error'), formData: req.flash('formData')[0] });
});

app.post('/register', validateRegistration, (req, res) => {

    const { username, email, password, address, contact, role } = req.body;

    const sql = 'INSERT INTO users (username, email, password, address, contact, role) VALUES (?, ?, SHA1(?), ?, ?, ?)';
    db.query(sql, [username, email, password, address, contact, role], (err, result) => {
        if (err) {
            throw err;
        }
        console.log(result);
        req.flash('success', 'Registration successful! Please log in.');
        res.redirect('/login');
    });
});


app.get('/login', (req, res) => {
    res.render('login', { messages: req.flash('success'), errors: req.flash('error') });
});

app.post('/login', (req, res) => {
    const { email, password } = req.body;

    // Validate email and password
    if (!email || !password) {
        req.flash('error', 'All fields are required.');
        return res.redirect('/login');
    }

    const sql = 'SELECT * FROM users WHERE email = ? AND password = SHA1(?)';
    db.query(sql, [email, password], (err, results) => {
        if (err) {
            console.error('Database error:', err);
            req.flash('error', 'Database error occurred. Please try again later.');
            return res.redirect('/login');
        }

        if (results.length > 0) {
            req.session.user = results[0]; 
            req.flash('success', 'Login successful!');
            if(req.session.user.role == 'user')
                res.redirect('/list');
            else
                res.redirect('/inventory');
        } else {
            // Invalid credentials
            req.flash('error', 'Invalid email or password.');
            res.redirect('/login');
        }
    });
});

app.get('/list', (req, res) => {
    const sql = 'SELECT * FROM movies';
    db.query(sql, (error, results) => {
        if (error) {
            console.error('Database query error:', error.message);
            return res.status(500).send('Database query error');
        }
        res.render('list', { movies: results, user: req.session.user });
    });
});

app.post('/add-to-watched/:id', checkAuthenticated, (req, res) => {
    const movieId = parseInt(req.params.id);

    db.query('SELECT * FROM movies WHERE movieId = ?', [movieId], (error, results) => {
        if (error) throw error;

        if (results.length > 0) {
            const movie = results[0];

            // Initialize cart in session if not exists
            if (!req.session.watched) {
                req.session.watched = [];
            }

            // Check if movie already in cart
            const existingItem = req.session.watched.find(item => item.movieId === movieId);
            if (existingItem) {
                print('Movie is already in watched list')
                res.redirect('/watched');
            } else {
                req.session.watched.push({
                    movieId: movie.movieId,
                    movieName: movie.movieName,
                    release_date: movie.release_date,
                    genre: movie.genre,
                    image: movie.image
                });
            }

            res.redirect('/watched');
        } else {
            res.status(404).send("movie not found");
        }
    });
});

app.get('/watched', checkAuthenticated, (req, res) => {
    const watched = req.session.watched || [];
    res.render('watched', { watched, user: req.session.user });
});

app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

app.get('/movie/:id', checkAuthenticated, (req, res) => {
  // Extract the movie ID from the request parameters
  const movieId = req.params.id;

  // Fetch data from MySQL based on the movie ID
  db.query('SELECT * FROM movies WHERE movieId = ?', [movieId], (error, results) => {
      if (error) throw error;

      // Check if any movie with the given ID was found
      if (results.length > 0) {
          // Render HTML page with the product data
          res.render('movie', { movie: results[0], user: req.session.user  });
      } else {
          // If no movie with the given ID was found, render a 404 page or handle it accordingly
          res.status(404).send('movie not found');
      }
  });
});

app.get('/addMovie', checkAuthenticated, checkAdmin, (req, res) => {
    // Pass both user and messages to the template
    res.render('addMovie', { 
        user: req.session.user, 
        messages: req.flash('errorMessages') // Retrieve any flash messages
    });
});
 
app.post('/addMovie', upload.single('image'), (req, res) => {
    // Extract product data from the request body
    const { name, release_date, genre } = req.body;
    let image;
 
    if (req.file) {
        image = req.file.filename; // Save only the filename
    } else {
        image = null;
    }
 
    const sql = 'INSERT INTO movies (movieName, release_date, genre, image) VALUES (?, ?, ?, ?)';
 
    // Insert the new movie into the database
    db.query(sql, [name, release_date, genre, image], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error adding movie:", error);
            req.flash('errorMessages', 'Error adding movie. Please try again.');
            res.redirect('/addMovie'); // Redirect back to the 'addMovie' form with error message
        } else {
            // Send a success response
            res.redirect('/inventory');
        }
    });
});

//Update by Khant Zay Nyi
app.get('/updateMovie/:id',checkAuthenticated, checkAdmin, (req,res) => {
    const movieId = req.params.id;
    const sql = 'SELECT * FROM movies WHERE movieId = ?';

    // Fetch data from MySQL based on the movie ID
    db.query(sql , [movieId], (error, results) => {
        if (error) throw error;

        // Check if any movie with the given ID was found
        if (results.length > 0) {
            // Render HTML page with the movie data
            res.render('updateMovie', { movie: results[0] });
        } else {
            // If no movie with the given ID was found, render a 404 page or handle it accordingly
            res.status(404).send('Movie not found');
        }
    });
});

app.post('/updateMovie/:id', upload.single('image'), (req, res) => {
    const movieId = req.params.id;
    // Extract movie data from the request body
    const { name, release_date, genre } = req.body;
    let image  = req.body.currentImage; //retrieve current image filename
    if (req.file) { //if new image is uploaded
        image = req.file.filename; // set image to be new image filename
    } 

    const sql = 'UPDATE movies SET movieName = ? , release_date = ?, genre = ?, image =? WHERE movieId = ?';
    // Insert the new product into the database
    db.query(sql, [name, release_date, genre, image, movieId], (error, results) => {
        if (error) {
            // Handle any error that occurs during the database operation
            console.error("Error updating movie:", error);
            res.status(500).send('Error updating movie');
        } else {
            // Send a success response
            res.redirect('/inventory');
        }
    });
});


// darren
// checkadmin needed to ensure only admins can delete
app.post('/deleteMovie/:id', checkAuthenticated, checkAdmin, (req, res) => {
    const movieId = req.params.id;

    db.query('DELETE FROM movies WHERE movieId = ?', [movieId], (error, results) => {
        if (error) {
            console.error("Error deleting movie:", error);
            res.status(500).send('Error deleting movie');
        } else {
            res.redirect('/inventory');
        }
    });
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
