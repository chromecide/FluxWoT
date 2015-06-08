var webSocket = require("ws");
var webSocketServer = webSocket.Server;

var util = require("util");

function wsServerInterface(host, port, cb){

    var self = this;

    var wss = new webSocketServer({
        port: port
    });

    wss.on("connection", function(ws){
        ws.on("message", function(messageString){
            var message = JSON.parse(messageString);
            
            this.thing.processMessage(message, sender, function(err, reply){
                console.log(reply);
                if(err){
                    this.sendErrorResponse(reply);
                }
            });
        });
    });

    wss.on("error", function(){
        console.log("WEB SOCKET wsServerInterface ERROR");
        console.log(err);
    });

    wss.on("listening", function(){
        if(cb){
            cb(false, self);
        }
    });
}
    
    wsServerInterface.prototype.setThing = function(thing){

    };

    wsServerInterface.prototype.reply = function(originalSender, reply){
        reply = JSON.stringify(reply);
        originalSender.send(reply);
    };

module.exports = wsServerInterface;