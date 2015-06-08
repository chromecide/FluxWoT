var connect = require('connect');
var http = require('http');
var compression = require('compression');
var cors = require('cors');
var formidable = require('formidable');
var qs = require('qs');
var jsonld = require('jsonld');
var util = require("util");

function HttpInterface(protocol, host, port, cb){
    var self = this;
    
    var app = connect();
    app.use(compression());
    app.use(cors());

    app.use(function(req, res, next){
        var form = new formidable.IncomingForm();
        form.encoding = "utf-8";
        form.parse(req, function(err, fields){
            if(err){
                res.writeHead(400, {'content-type':'application/json'});
            }else{
                console.log(fields);
                next();
            }
        });
    });

    app.use(function(req, res, next){
        qs.parse(req.url);
        next();
    });


    app.use(function(req, res, next){
        self.processRequest(req, res, next);
    });

    this.app = app;

    this.httpServer = http.createServer(app);
    
    this.httpServer.on("error", function(err){
        if(cb){
            cb(err);
        }
    });

    this.httpServer.on("listening", function(){
        if(cb){
            cb(false, self);
        }
    });

    this.httpServer.listen(port);
}
    HttpInterface.prototype.setThing = function(thing){
        this.thing = thing;
    };

    HttpInterface.prototype.processRequest = function(req, res, next){
        var message = {
            uri: req.url,
            method: req.method,
            payload: req.method=="GET"?req.qs:JSON.parse(req.body)
        };

        var sender = {
            request: req,
            response: res
        };

        if(message.uri=="subscribe"){
            this.reply(sender, {
                status: 501, //NOT IMPLEMENTED
                payload:{
                    "message":"Subscription via HTTP not supported"
                }
            });
        }else{
            this.thing.processMessage(message, messageCallbackFn(this, sender));
        }
    };

    HttpInterface.prototype.reply = function(sender, message){
        sender.response.writeHead(message.status, {"content-type":"application/json"});
        sender.response.end(JSON.stringify(message.payload));
    };

    function messageCallbackFn(self, sender){
        return function(reply){
            self.reply(sender, reply);
        };
    }

module.exports = HttpInterface;