const express = require("express");
const fetch = require("node-fetch");
const https = require("https");
const redis = require("redis");
const bluebird = require("bluebird");

const API_URL = "https://developer.mtd.org/api/v2.2/json/";
const MAX_EXPECTED_MINS_AWAY = 60;

// add the HTTP Keep-Alive header to speed up proxy requests
const opts = {
  agent: new https.Agent({
    keepAlive: true
  })
};

// create express app on port 3000
const app = express();
const port = 3000;

client = redis.createClient();
bluebird.promisifyAll(redis);

app.get("/api/*", async (req, res) => {
  let json = await fetch(
    `${API_URL}/getdeparturesbystop?key=${CUMTD_API_KEY}&stop_id=PAR&pt=${MAX_EXPECTED_MINS_AWAY}`,
    opts
  ).then(res => res.json());
  res.send(json);
});

app.get("/redis", async (req,res) => {
    let retval = await client.getAsync("string key"); 
    res.send(retval);
});

app.listen(port, () => console.log(`Express app listening on port ${port}!`));
