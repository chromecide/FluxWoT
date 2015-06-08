var Thing = require(__dirname+"/../Thing.js");
var webSocket = require("ws");
var dataUtils = require(__dirname+"/../functions.js");
/**
 * Proxy for a Thing running on a Server WebSocket Interface
 * @param {[type]} id          [description]
 * @param {[type]} name        [description]
 * @param {[type]} description [description]
 * @param {[type]} tags        [description]
 * @param {[type]} socket      [description]
 */
function WebSocketThing(connection, idPath){
    var self = new Thing();
    self._connection = connection;
    self._callbackRegistry = {};

    self.start = function(){
        var cString;
        if((typeof this._connection)=="string"){
            //we need to connect
            cString = self._connection;
            self._connection = new webSocket(cString);
            self._remoteId = cString;

            self._connection.on("open", function(){
                console.log("Socket Connected");
                //send the first query
                var message = {
                    uri: self._remoteId.replace(/^ws\:\/\/[^\/]+/, ""),
                    method: "GET",
                    payload: {}
                };
                self._connection.send(JSON.stringify(message));
            });

            self._connection.on("message", function(messageString){
                //a message was recieved from the websocket server
                var message = JSON.parse(messageString);
                self.processMessage(message, function(){
                    if(!self._started && message.uri=="/"){
                        Thing.prototype.start.call(self);
                    }
                });
            });
        }else{

            //for now we'll assume it's an existing socket
            if(!idPath){
                throw new Error("No ID Path Supplied");
            }else{
                if((typeof idPath)=="string"){
                    self._remoteId = idPath+"/";
                    var cbId = dataUtils.uuid();
                    console.log(self._remoteId+" (callback="+cbId+")");

                    self._callbackRegistry[cbId] = function(err, thingCfg){

                        //Thing.call(self, thingCfg.id, thingCfg.name, thingCfg.description, thingCfg.tags);
                        self.id = thingCfg.id;
                        self.name = thingCfg.name;
                        self.description = thingCfg.description;
                        self.tags = thingCfg.tags;

                        if(thingCfg.properties){
                            for(var propName in thingCfg.properties){
                                var prop = thingCfg.properties[propName];
                                self.addProperty(propName, prop.name, prop.description, prop.type);
                            }
                        }

                        if(thingCfg.events){
                            for(var eventName in thingCfg.events){
                                var evt = thingCfg.events[eventName];
                                self.addProperty(eventName, evt.name, evt.description, evt.parameters);
                            }
                        }

                        if(thingCfg.actions){
                            for(var actionName in thingCfg.actions){
                                self.addAction(actionName, action.name, action.description, action.parameters, runActionFn(self, actionName));
                            }
                        }

                        Thing.prototype.start.call(self);
                    };

                    var message = {
                        uri: idPath,
                        method: "GET",
                        payload:{
                            callback_uri: "callbacks/"+cbId
                        }
                    };

                    self._connection.send(JSON.stringify(message));
                }else{
                    console.log("THING CFG SUPPLIED");
                    console.log(idPath);
                }
            }

            self._connection.on("message", function(messageString){
                console.log('processing message');
                var message = JSON.parse(messageString);
                console.log(message);
                self.processMessage(message, function(err){
                    if(!err){
                        Thing.prototype.start.call(self);
                    }
                });
            });
        }
    };

    self.stop = function(){
        self._connection.close();
    };

    self.subscribe = function(actionName, fn){
        if(!self._started){
            Thing.prototype.subscribe.call(self, actionName, fn);
        }else{
            if(actionName=="started"){
                fn.apply(self, self);
            }else{

                var cbId = dataUtils.uuid();
                self._callbackRegistry[cbId] = fn;
                var message = {
                    uri: self._remoteId+"subscribe/"+actionName,
                    method: "POST",
                    payload:{
                        callback_uri: "callbacks/"+cbId
                    }
                };
                self._connection.send(JSON.stringify(message));
            }
        }
    };

    self.processMessage = function(message, callback){
        console.log(message);
        //initial intriduction from the server
        if(!message.uri || message.uri=="/"){
            console.log("WS PROXY Initialisation");
            console.log(message);
            var thingCfg = message.payload;
            for(var key in thingCfg){
                if(key!='actions'){
                    self[key] = thingCfg[key];
                }
            }

            if(thingCfg.actions){
                for(var actionName in thingCfg.actions){
                    console.log(actionName);
                    self.addAction(actionName, thingCfg.actions[actionName].name, thingCfg.actions[actionName].description, thingCfg.actions[actionName].parameters, runActionFn(self, actionName));
                }
            }

            if(callback){
                console.log("NO ERRORS");
                callback(false);//no errors
            }
        }else{
            //message from the homeland?
            var pathParts = message.uri.split("/");
            if(pathParts[0]===""){
                pathParts.shift();
            }

            switch(pathParts[0]){
                case "callbacks":
                    var cbId = pathParts[1];
                    var fn = self._callbackRegistry[cbId];
                    if(fn){
                        console.log("APPLYING CALLBACK");
                        fn.apply(self, message.payload);
                    }
                    break;
            }
        }
    };

    return self;
}


    function runActionFn(self, actionName){
        return function(){


            console.log("RUNNING ACTION: "+self._connection.url.replace(/^ws\:\/\/[^\/]+/, "")+"actions/"+actionName);

            var argArray = [];
            for(var argItem in arguments){
                argArray.push(arguments[argItem]);
            }
            //strip the last argument if it's a function
            var cbId, suppliedCb;
            if((typeof argArray[argArray.length-1])=='function'){
                cbId = dataUtils.uuid();
                suppliedCb = argArray.pop();
                self._callbackRegistry[cbId] = suppliedCb;
            }
            
            var message = {
                uri: self._remoteId.replace(/^ws\:\/\/[^\/]+/, "")+"actions/"+actionName,
                method: "POST",
                payload: argArray
            };

            console.log(message);
            self._connection.send(JSON.stringify(message));
        };
    }

    function subscriptionCallbackFn(self, fn){
        return function(){
            var parameters = [];
            for(var arg in arguments){
                parameters.push(arguments[arg]);
            }

            var reply = {
                callback: cbId,
                uri: '/',
                payload: parameters
            };

            ws.send(JSON.stringify(reply), function(err){
                if(err){
                    //TODO: Unsubscribe
                    delete callbackRegistry[cbId];
                }
            });
        };
    }

module.exports = WebSocketThing;