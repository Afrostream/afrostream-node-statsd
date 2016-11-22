'use strict';

 var SDC = require('statsd-client')
  , cluster = require('cluster')
  , client = null;

//
var numCPUs = parseInt(process.env.WEB_CONCURRENCY, 10) || require('os').cpus().length;

// pour ne pas "blinder" carbon de repertoires correspondant aux workers,
//  on module le numero du worker suivant le nombre de CPU
var workerId = "unknown";
if (cluster && cluster.worker && cluster.worker.id) {
  workerId = cluster.worker.id % numCPUs;
}
// on recherche le nom du container
var containerId = process.env.DYNO && String(process.env.DYNO).replace(/\./g, '-') || "unknown";

var wrapper = {
  increment: function (key, delta) {
    if (client) {
      client.increment(key, delta || 1);
    }
  },

  gauge: function (key, val) {
    if (client) {
      client.gauge(key, val);
    }
  },

  timing: function (key, val) {
    if (client) {
      client.timing(key, val);
    }
  }
};

var init = function (options) {
  options = options || {};

  if (options.disabled) {
    return;
  }

  var module = options.module || "unknown"
    , container = options.container || process.env.CONTAINER || containerId
    , worker = options.worker || process.env.WORKER || workerId
    , env = options.env || process.env.NODE_ENV || 'development'
    , host = options.host || 'graphite.afrostream.net'
    , port = options.port || 8125
    , prefix = options.prefix || '%module%.%env%.container.%container%.worker.%worker%.';

  // create client
  prefix = prefix
    .replace('%module%', module)
    .replace('%env%', env)
    .replace('%container%', container)
    .replace('%worker%', worker);

  client = new SDC({host: host, port: port, prefix: prefix});

  if (options.watchdog) {
    setInterval(function () {
      wrapper.increment('status.alive', 1);
    }, 1000).unref();
  }

  if (options.monitorMemory) {
    setInterval(function () {
      var memoryUsage = process.memoryUsage();
      wrapper.gauge('status.memory.rss', memoryUsage.rss / 1000000);
      wrapper.gauge('status.memory.heaptotal', memoryUsage.heapTotal / 1000000);
      wrapper.gauge('status.memory.heapused', memoryUsage.heapUsed / 1000000);
    }, 5000).unref();
  }
};

var middleware = function (options) {
  var options = options || {};
  var start = new Date();
  var prefix = options.prefix || 'route';
  var route = prefix + '.' + (options.route || 'all');

  return function (req, res, next) {
    res.once('finish', function() {
      // nb requests
      if (res.statusCode === 200) {
        wrapper.increment(route + '.success')
      } else if (res.statusCode >= 300 && res.statusCode < 400) {
        wrapper.increment(route + '.redirect')
      } else {
        wrapper.increment(route + '.error')
      }
      // jauge, ne différencie pas les erreurs des success...
      wrapper.gauge(route + '.time', new Date() - start);
    });
    next();
  };
};

var escapeKey = function (s) {
  return String(s || 'unknown').replace(/\./g, '-');
};

module.exports.client = wrapper;
module.exports.init = init;
module.exports.middleware = middleware;
module.exports.escapeKey = escapeKey;
