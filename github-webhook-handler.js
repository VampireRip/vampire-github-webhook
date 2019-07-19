const EventEmitter = require('events');
const crypto = require('crypto');
const bl = require('bl');

function create(options) {
  if (typeof options !== 'object')
    throw new TypeError('must provide an options object');

  if (typeof options.secret !== 'string')
    throw new TypeError(`'secret' is not provided.`);

  const {fallthrough} = options;

  const sign = data =>
      `sha1=${crypto.createHmac('sha1', options.secret).update(data).digest('hex')}`;

  const verify = (signature, data) =>
      crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(sign(data)));

  let events = options.events || '*';

  if (typeof events === 'string')
    events = [events, 'ping'];

  if (events.indexOf('*') !== -1)
    events = undefined;

  // make it an EventEmitter, sort of
  Reflect.setPrototypeOf(handler, EventEmitter.prototype);
  EventEmitter.call(handler);

  handler.sign = sign;
  handler.verify = verify;

  return handler;

  function handler(req, res, next) {
    function generateError (code, error) {
      handler.emit('error', {code, error, req, res});
      if(fallthrough) return next();
    }

    if (req.method !== 'POST')
      return generateError(405, 'method not allowed');

    const sig = req.headers['x-hub-signature']
        , event = req.headers['x-github-event']
        , id = req.headers['x-github-delivery'];

    if (!sig)
      return generateError(401, 'X-Hub-Signature is not present');

    if (!event)
      return generateError(400, 'X-Github-Event is not present');

    if (!id)
      return generateError(400, 'X-Github-Delivery is not present');

    if (events && events.indexOf(event) === -1)
      return next();

    const callback = function(err, data) {
      if (err)
        return generateError(500, err.message);

      if (!verify(sig, data))
        return generateError(403, 'X-Hub-Signature not match');

      let obj;
      try {
        obj = JSON.parse(data.toString());
      } catch (e) {
        return generateError(400, 'request body parse failed');
      }

      res.writeHead(200, {'Content-Type': 'application/json'});
      res.end('{"code":0, "message":"ok"}');

      var emitData = {
        event
        , id
        , payload: obj
        , protocol: req.protocol
        , host: req.headers['host']
        , url: req.url,
      };
      handler.emit(event, emitData);
      handler.emit('*', emitData);
    };

    if(req.body) 
      callback(null, JSON.stringify(req.body));
    else
      req.pipe(bl(callback));
  }
}

module.exports = create;
