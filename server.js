const express = require("express");
const fetch = require("node-fetch");
const https = require("https");
const redis = require("redis");
const bluebird = require("bluebird");

const API_URL = "https://developer.mtd.org/api/v2.2/json/";
const CUMTD_API_KEY = process.env.CUMTD_API_KEY;
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

var client = redis.createClient();
bluebird.promisifyAll(redis);

app.get("/api/getdeparturesbystop", async (req, res) => {
  const { stop_id } = req.query;
  if(!stop_id){
      return res.send('invalid');
  }
  let stringifiedCurrentEntry = await client.getAsync(stop_id);
  let resp;

  if (stringifiedCurrentEntry) {
    // cache hit!
    const JSONCurrentEntry = JSON.parse(stringifiedCurrentEntry);
    if (new Date() - new Date(JSONCurrentEntry.time) > 60 * 1000) {
      // outdated, replace!
      resp = await updateCache(stop_id);
      resp.from_cache = false;
    } else {
      resp = JSONCurrentEntry;
      resp.from_cache = true;
    }
  } else {
    // missing from the cache store, add new entry
    resp = await updateCache(stop_id);
    resp.from_cache = false;
  }
  res.send(resp);
});

app.get("/api/*", async (req, res) => {
    console.log("Hey!");
});
const updateCache = async stop_id => {
  let json = await fetch(
    `${API_URL}/getdeparturesbystop?key=${CUMTD_API_KEY}&stop_id=${stop_id}&pt=${MAX_EXPECTED_MINS_AWAY}`,
    opts
  ).then(res => res.json());

  await client.setAsync(stop_id, JSON.stringify(json));
  return json;
};



app.listen(port, () => console.log(`Express app listening on port ${port}!`));
