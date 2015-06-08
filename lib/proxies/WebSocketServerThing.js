var Thing = require(__dirname+"/../Thing.js");
var util = require("util");

var webSocket = require("ws");
var webSocketServer = webSocket.Server;

function WebSocketServerThing(host, port, id, name, description, tags, cb){
    var self = this;
    if(!self._callbackRegistry){
        self._callbackRegistry = {};
    }
    
    self._serverCfg = {
        host: host,
        port: port
    };
    Thing.call(self, id, name, description, tags);
}

    util.inherits(WebSocketServerThing, Thing);

    WebSocketServerThing.prototype.start = function(){
        var self = this;

        self._wsServer = new webSocketServer({
            port: self._serverCfg.port
        });

        self._wsServer.on("connection", function(ws){
            //send the client the info about the
            /*self.processMessage({
                uri: ws.upgradeReq.url?ws.upgradeReq.url:"/",
                method:"GET",
                payload: null
            }, function(reply){
                ws.send(JSON.stringify({
                    uri: "/",
                    payload: reply.payload
                }));
            });*/

            ws.on("message", function(messageString){
                var message = JSON.parse(messageString);
                console.log(message);
                var bContinue = self.processRawMessage(ws, message);
                if(bContinue){
                    console.log(message);
                    self.processMessage(message, function(reply){
                        reply.uri = message.payload.callback_uri||"/";
                        console.log(reply);
                        console.log("SENDING REPLY");
                        ws.send(JSON.stringify(reply));
                    });
                }
            });
        });

        Thing.prototype.start.call(self);
    };

    WebSocketServerThing.prototype.processRawMessage = function(){
        return true;
    };

    WebSocketServerThing.prototype.processMessage = function(message, callback){
        var self = this;
        var pathParts = message.uri.split("/");
        if(pathParts[0]===""){
            pathParts.shift();
        }

        if(pathParts.length===0){
            pathParts = ["/"];
        }
        switch(pathParts[0]){
            case "subscribe":
                console.log("Subscribing");
                var subCbId = Thing.dataUtils.uuid();

                self._callbackRegistry[subCbId] = subscriptionCallBackFn(ws, message.payload.callback_uri);
                self.subscribe(pathParts[1], self._callbackRegistry[subCbId]);
                break;
            default:
                Thing.prototype.processMessage.call(self, message, function(reply){
                    callback.apply(self, arguments);
                });
                break;
        }
    };

    WebSocketServerThing.prototype.stop = function(){
        self._wsServer.close();
    };

    WebSocketServerThing.prototype.subscriptionCallbackFn = function subscriptionCallBackFn(socket, cbPath){
        return function(){
            var argList = [];
            var isFirst = true;
            for(var arg in arguments){
                if(!isFirst){ //first is the event name
                    argList.push(arguments[arg]);
                }else{
                    isFirst = false;
                }
            }

            var message = {
                uri: cbPath,
                method: "POST",
                payload: argList
            };

            console.log(message);
            socket.send(JSON.stringify(message));
        };
    };

    function getCallbackFn(socket, cbPath){
        return function(reply){
            var message = {
                uri: cbPath,
                method: "POST",
                payload: reply
            };
            socket.send(JSON.stringify(reply));
        };
    }

module.exports = WebSocketServerThing;