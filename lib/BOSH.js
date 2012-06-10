var http = require('http');
var ltx = require('ltx');
var url = require('url');
var events = require('events');
var util = require('util');
var dns = require('dns');

var BOSH = function(aURL, aAttrs) {
  var parsedURL = url.parse(aURL);
  this.port = parsedURL.port;
  this.host = parsedURL.hostname;
  this.path = parsedURL.path;
  this.rid = 1337;
  this.currentRequests = 0;
  this.maxHTTPRetries = 5;
  this.queue = [];

  var attrs = {
    content: 'text/xml; charset=utf-8',
    hold: '1',
    rid: this.rid,
    ver: '1.6',
    wait: '60'
  };
  for (var i in aAttrs)
    attrs[i] = aAttrs[i];

  var that = this;

  //~ dns.lookup(this.host, null, function(err, address) {
    //~ that.address = address;
    process.nextTick(function () {
      that.request(attrs, null, function(data) {
        that.emit('open', data.toString());
        that.sid = data.attrs.sid;
        that.maxRequests = data.attrs.requests || 2;
        //~ that.request({}, null, function(data) {
          //~ that.processResponse(data)
        //~ });
        //~ that.request({}, null);
      });
    });
  //~ });
};

util.inherits(BOSH, events.EventEmitter);

BOSH.prototype.request = function(attrs, children, aOnSuccess, aOnError, aRetry) {
  if (children && children[0] && children[0].name === 'body') {
    var body = children[0];
  }
  else {
    var body = new ltx.Element('body');
    if (children) {
      if(util.isArray(children))
        for (var k in children)
          body.cnode(children[k]);
      else
        body.cnode(children);
    }
  }

  //rid
  body.attrs.rid = this.rid++;
  //sid
  if (this.sid)
    body.attrs.sid = this.sid;
  //xmlns
  body.attrs.xmlns = 'http://jabber.org/protocol/httpbind';
  
  for (var i in attrs)
    body.attrs[i] = attrs[i];
  
  var options = {
    host: this.host,
    port: this.port,
    path: this.path,
    method: 'POST',
    agent: false,
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'Content-Length': body.toString().length
    }
  };

  var that = this;
  
  var retry = aRetry || 0;

  var req = http.request(options)
  req.on('response', function(res) {
    if (res.statusCode < 200 || res.statusCode >= 400) {
      that.emit('error', "HTTP status " + res.statusCode);
      that.emit('close');
      return;
    }
    var body = '';
    res.setEncoding('utf8');
    res.on('data', function (chunk) {
      body += chunk;
    });
    res.on('close', function (error) {
      that.currentRequests--;
      console.log('close');
      if (error)
        console.log(error);
    });
    res.on('end', function () {
      that.currentRequests--;
      that.emit('rawin', body);
      try {
        var el = ltx.parse(body);
      }
      catch(e) {
        console.log('toto');
        console.log(e);
        console.log(res);
      }
      if (aOnSuccess)
        aOnSuccess(el);
        
      that.processResponse(el);
    });

  });
  req.on('error', function(error) {
    if (retry < that.maxHTTPRetries) {
      that.request(attrs, children, aOnSuccess, aOnError, ++retry);
    }
    else {
      console.log('error: ');
      console.log(error);
      that.emit('close');
      that.emit('error', error);
      if (aOnError)
        aOnError(error);
    }
  });
  this.emit('rawout', body.toString());

  for(var i = 0; i < body.children.length; i++) {
    var child = body.children[i];
    if (child.name && child.attrs && child.children)
      that.emit('out', child);
  }

  req.end(body.toString(), 'utf8');
  this.currentRequests++;
};

BOSH.prototype.send = function(aData) {
  var el = '';
  
  if (aData) {
    el = aData.root();
  }
  else if (typeof aData == 'string') {
    try {
      el = ltx.parse(aData);
    }
    catch(e) {
      console.log(e);
      console.log(aData);
    }
  }

  this.queue.push(el);
  
  process.nextTick(this.mayRequest.bind(this));
};

BOSH.prototype.close = function(aData) {
};

BOSH.prototype.processResponse = function(bodyEl) {
  if (bodyEl && bodyEl.children) {
    for(var i = 0; i < bodyEl.children.length; i++) {
      var child = bodyEl.children[i];
      if (child.name && child.attrs && child.children)
        this.emit('in', child);
    }
  }
  if (bodyEl && bodyEl.attrs.type === 'terminate') {
    this.emit('error', new Error(bodyEl.attrs.condition || "Session terminated"));
    this.emit('close');
  }

  //~ if (this.queue.length == 0)
    //~ this.request({}, []);
};


BOSH.prototype.mayRequest = function() {
  var that = this;
  var canRequest =
    this.sid && (this.currentRequests === 0 || ((this.queue.length > 0 && this.currentRequests < this.maxRequests))
	);
  if (!canRequest)
    return;

  var stanzas = this.queue;
  this.queue = [];
  //~ this.rid++;
  this.request({}, stanzas,
    //success
    function(data) {
      if (data)
        that.processResponse(data);

      process.nextTick(that.mayRequest.bind(that));
      
    },
    //error
    function(error) {
      that.emit('error', error);
      that.emit('close');
      delete that.sid;
    }
  );
};

exports.BOSH = BOSH;
