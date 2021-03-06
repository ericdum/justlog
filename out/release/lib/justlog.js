// Generated by CoffeeScript 1.8.0
var Log, create, cwd, debug, defaultAccessLogFile, ep, error, factory, flushTime, heartBeat, info, k, levels, logs, os, path, timer, v, warn, _ref;

path = require('path');

ep = require('event-pipe');

os = require('options-stream');

levels = require('./levels');

Log = require('./log');

info = levels.info, debug = levels.debug, warn = levels.warn, error = levels.error;

cwd = process.cwd();

defaultAccessLogFile = "[" + cwd + "/logs/" + (path.basename(path.basename(process.argv[1], '.js'), '.coffee')) + "-access-]YYYY-MM-DD[.log]";

logs = [];

flushTime = 1000;

timer = null;

heartBeat = function() {
  var inst, now, _i, _len;
  now = new Date().getTime();
  for (_i = 0, _len = logs.length; _i < _len; _i++) {
    inst = logs[_i];
    inst.heartBeat(now);
  }
  return timer = setTimeout(function() {
    return heartBeat();
  }, flushTime);
};

heartBeat();

factory = {
  config: function(opt) {
    if (opt.flushTime) {
      flushTime = opt.flushTime;
    }
    if (timer) {
      clearTimeout(timer);
    }
    return heartBeat();
  },
  create: function(options) {
    var log;
    log = Log(options);
    logs.push(log);
    return log;
  },
  end: function(cb) {
    var fn, fns, inst, pipe, _i, _len;
    if (cb == null) {
      cb = function() {};
    }
    fns = [];
    fn = function(inst) {
      return function() {
        return inst.close(this);
      };
    };
    for (_i = 0, _len = logs.length; _i < _len; _i++) {
      inst = logs[_i];
      fns.push(fn(inst));
    }
    logs.length = 0;
    pipe = ep();
    pipe.on('error', cb);
    if (fns.length) {
      pipe.lazy(fns);
    }
    pipe.lazy(function() {
      return cb();
    });
    return pipe.run();
  },

  /*
  /**
   * connect middleware
     * @param  {Object} options
     *  - {String} [encodeing='utf-8'],        log text encoding
     *  - file :
     *    - {Number} [level=error|warn],       file log levels
     *    - {String} [pattern='accesslog-rt'], log line pattern
     *    - {String} [mode='0664'],            log file mode
     *    - {String} [dir_mode='2775'],        log dir mode
     *    - {String} [path="[$CWD/logs/$MAIN_FILE_BASENAME-access-]YYYY-MM-DD[.log]"],   log file path pattern
     *  - stdio:
     *    - {Number}         [level=all],              file log levels
     *    - {String}         [pattern='accesslog-rt'], log line pattern
     *    - {WritableStream} [stdout=process.stdout],  info & debug output stream
     *    - {WritableStream} [stderr=process.stderr],  warn & error output stream
   * @param  {Function} cb(justlog)
   * @return {Middlewtr}
   */
  middleware: function(options) {
    var log, mw;
    options = os({
      file: {
        path: defaultAccessLogFile,
        pattern: 'accesslog-rt'
      },
      stdio: {
        pattern: 'accesslog-color'
      }
    }, options);
    options.file.level |= info;
    options.stdio.level |= info;
    log = Log(options);
    logs.push(log);
    mw = (function(_this) {
      return function(req, resp, next) {
        var end;
        req.__justLogStartTime = new Date;
        end = resp.end;
        resp.end = function(chunk, encoding) {
          resp.end = end;
          resp.end(chunk, encoding);
          return log.info({
            'remote-address': req.socket.remoteAddress,
            method: req.method,
            url: req.originalUrl || req.url,
            version: req.httpVersionMajor + '.' + req.httpVersionMinor,
            status: resp.statusCode,
            'content-length': parseInt(resp.getHeader('content-length'), 10),
            headers: req.headers,
            rt: new Date() - req.__justLogStartTime
          });
        };
        return next();
      };
    })(this);
    mw.justlog = log;
    return mw;
  }
};

create = function(options) {
  var log;
  log = new Log(options);
  logs.push(log);
  return log;
};

_ref = levels.levels;
for (k in _ref) {
  v = _ref[k];
  create[k.toUpperCase()] = v;
}

module.exports = create;

for (k in factory) {
  v = factory[k];
  module.exports[k] = v;
}
