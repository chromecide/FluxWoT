var bindingBase =require(__dirname+"/../binding.js");

var webSocket = require("ws");
var webSocketServer = webSocket.Server;

var util = require("util");

function binding(host, port, cb){
    bindingBase.call(this);

    var self = this;

    var wss = new webSocketServer({
        port: port
    });

    wss.on("connection", function(ws){
        ws.on("message", function(messageString){
            var message = JSON.parse(messageString);
            self.notify(message, ws);
        });
    });

    wss.on("error", function(){
        console.log("WEB SOCKET BINDING ERROR");
        console.log(err);
    });

    wss.on("listening", function(){
        if(cb){
            cb(false, self);
        }
    });
}

    util.inherits(binding, bindingBase);

    binding.prototype.reply = function(originalSender, reply){
        reply = JSON.stringify(reply);
        originalSender.send(reply);
    };

module.exports = binding;