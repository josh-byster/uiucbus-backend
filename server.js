const express = require("express");
const fetch = require("node-fetch");
const https = require("https");
const redis = require("redis");
const bluebird = require("bluebird");
const morgan = require("morgan");
const helmet = require("helmet");

const API_URI = "https://developer.mtd.org/api/v2.2/json";
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
app.use(morgan("dev"));
app.use(helmet());
const port = process.env.PORT;
const host = process.env.NODE_ENV === "production" ? process.env.REDIS_URL : "";

var client = redis.createClient(host);
bluebird.promisifyAll(redis);

app.all("/*", function(req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "X-Requested-With");
  next();
});

app.get("/api/getdeparturesbystop", async (req, res) => {
  const { stop_id } = req.query;
  if (!stop_id) {
    return res.send("invalid");
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
  // set the base url
  let apiReqUrl = `${API_URI}/${req.params[0]}?key=${CUMTD_API_KEY}`;
  for (var key in req.query) {
    // if some reason the key is a query param, ignore it
    if (key != "key") {
      // iterate over all keys, adding each to the URL
      apiReqUrl += `&${key}=${req.query[key]}`;
    }
  }
  const json = await fetch(apiReqUrl, opts).then(res => res.json());
  res.send(json);
});

const updateCache = async stop_id => {
  // get latest info
  let json = await fetch(
    `${API_URI}/getdeparturesbystop?key=${CUMTD_API_KEY}&stop_id=${stop_id}&pt=${MAX_EXPECTED_MINS_AWAY}`,
    opts
  ).then(res => res.json());

  await client.setAsync(stop_id, JSON.stringify(json));
  return json;
};

app.listen(port, () => console.log(`Express app listening on port ${port}!`));
