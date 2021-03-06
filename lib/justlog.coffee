path    = require 'path'
ep      = require 'event-pipe'
os      = require 'options-stream'
levels  = require './levels'
Log     = require './log'

{info, debug, warn, error} = levels

cwd = process.cwd()

defaultAccessLogFile = "
[#{cwd}/logs/#{path.basename (path.basename process.argv[1] , '.js'), '.coffee'}-access-]YYYY-MM-DD[.log]
"

logs = []
flushTime = 1000
timer = null

heartBeat = ->
  now = new Date().getTime()
  inst.heartBeat now for inst in logs
  timer = setTimeout ->
    heartBeat()
  , flushTime

heartBeat()

factory =
  config : (opt)->
    flushTime = opt.flushTime if opt.flushTime
    clearTimeout timer if timer
    heartBeat()

  create : (options)->
    log = Log options
    logs.push log
    log

  end : (cb = ->)->
    fns = []
    fn = (inst)->
      ->
        inst.close @
    for inst in logs
      fns.push fn inst

    logs.length = 0
    pipe = ep()
    pipe.on 'error', cb
    pipe.lazy fns if fns.length
    pipe.lazy ->
      cb()
    pipe.run()

  ###
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
  ###
  middleware : (options) ->
    options = os
      file:
        path    : defaultAccessLogFile
        pattern : 'accesslog-rt'
      stdio :
        pattern : 'accesslog-color'
    , options
    # make sure level info need log
    options.file.level |= info
    options.stdio.level |= info
    # new log object
    log = Log options
    logs.push log
    # middleware
    mw = (req, resp, next) =>
      # response timer
      req.__justLogStartTime = new Date
      # hack resp.end
      end = resp.end
      resp.end = (chunk, encoding) ->
        resp.end = end
        resp.end chunk, encoding
        log.info {
          'remote-address' : req.socket.remoteAddress
          method           : req.method
          url              : req.originalUrl || req.url
          version          : req.httpVersionMajor + '.' + req.httpVersionMinor
          status           : resp.statusCode
          'content-length' : parseInt resp.getHeader('content-length'), 10
          headers          : req.headers
          rt               : new Date() - req.__justLogStartTime
        }
      next()
    mw.justlog = log
    mw

create = (options)->
  log = new Log options
  logs.push log
  log
# set levels const
create[k.toUpperCase()] = v for k, v of levels.levels
# exports
module.exports = create

module.exports[k] = v for k, v of factory
