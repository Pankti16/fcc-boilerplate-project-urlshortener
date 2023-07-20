require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const dns = require('dns');
const mongoose = require('mongoose');

const app = express();

// Basic Configuration
const port = process.env.PORT || 3000;
const mySecret = process.env['MONGO_DB_URL'];
//Variable to hold connection status
let isConnected = false;

//Connect/Dis-connect to database
const dbConnect = () => {
  mongoose.connect(mySecret, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => isConnected = true);
}
const dbDisConnect = () => {
  mongoose.disconnect()
  .then(() => isConnected = false);
}

dbConnect();

app.use(cors());
// parse application/x-www-form-urlencoded
app.use(bodyParser.urlencoded({ extended: false }))

// parse application/json
app.use(bodyParser.json())

app.use('/public', express.static(`${process.cwd()}/public`));

//Mongodb stuff
const Schema = mongoose.Schema;
const Model = mongoose.model;
//Short url schema
const ShortUrlSchema = new Schema({
  short_url: {
    type: Number,
    required: true,
    unique: true,
  },
  original_url: {
    type: String,
    required: true,
  },
  status: {
    type: Boolean,
    default: true,
  }
});
//Short url model
const ShortUrl = Model('ShortUrl', ShortUrlSchema);
//Find by value of original url
const findByOriginalUrl = (original_url, done) => {
  ShortUrl.findOne({
    original_url,
    status: true
  }, function(err, data) {
    if (err) done(err, null);
    done(null, data);
  });
}
//Find by value of short url
const findByShortUrl = (short_url, done) => {
  ShortUrl.findOne({
    short_url,
    status: true
  }, function(err, data) {
    if (err) done(err, null);
    done(null, data);
  });
}
//Find last record
const findLastRecord = (done) => {
  ShortUrl.find()
    .sort({ _id: -1 })
    .limit(1)
    .exec(function(err, data) {
      if (err) done(err, null);
      done(null, data);
    });
}
//Add new record
const addOriginalUrl = (original_url, short_url, done) => {
  const _myShortUrl = new ShortUrl({
    original_url,
    short_url
  });
  _myShortUrl.save(function(err, data) {
    if (err) done(err, null);
    done(null, data);
  });
}

app.get('/', function(req, res) {
  res.sendFile(process.cwd() + '/views/index.html');
});

// add new shorturl/get existing one
app.post('/api/shorturl', function(req, res) {
  //Get url from request body
  const {url: original_url} = req.body;
  //Check if url is valid using dns lookup
  dns.lookup(original_url.replace('http://', '').replace('https://',''), function(err, address, family) {
    //If error then send error
    if (err) res.json({ error: 'invalid url' });
    //If database connection is done then check if url already exist
    if (isConnected) {
      findByOriginalUrl(original_url, function(orgError, orgData) {
        //If any error on fetching send error
        if (orgError) res.json({ error: 'Error checking into database!' });
        //If data is received then send that value
        if (orgData) {
          res.json({ original_url, short_url: orgData?.short_url });
        //Else insert new record in database
        } else {
          findLastRecord(function(lastError, lastData) {
            console.log(lastError, lastData);
            //If any error on getting last record send error
            if (lastError) res.json({ error: 'Error getting last record from database!' });
            //If data is received then use last records id to form new records id
            let lastId = 1;
            if (lastData && lastData?.length > 0) {
              lastId = lastData[0]?.short_url + 1;
            }
            //Insert into the database
            addOriginalUrl(original_url, lastId, function(addError, addData) {
              //If any error on inserting new record send error
              if (addError) res.json({ error: 'Error inserting new record to database!' });
              res.json({ original_url, short_url: lastId });
            });
          });
        }
      });
    } else {
      res.json({ error: 'Database connection error!' });
    }
  });
});

// open shorturl
app.get('/api/shorturl/:short_url', function(req, res) {
  //Get url from request params
  const {short_url} = req.params;
  //If database connection is done then get the original url
  if (isConnected) {
    findByShortUrl(short_url, function(shortError, shortData) {
      //If any error on fetching send error
      if (shortError) res.json({ error: 'Error getting from database!' });
      //If data is received then send that value
      if (shortData) {
        res.redirect(302, shortData?.original_url);
      //Else send error
      } else {
        res.json({ error: 'Url not found!' });
      }
    });
  } else {
    res.json({ error: 'Database connection error!' });
  }
});

app.listen(port, function() {
  console.log(`Listening on port ${port}`);
});
