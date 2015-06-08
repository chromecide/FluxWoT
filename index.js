var dataUtils = require(__dirname+"/lib/functions.js");

var webSocket = require('ws');
var webSocketServer = webSocket.Server;

var Thing = require(__dirname+"/lib/Thing.js");
var iHTTP = require(__dirname+"/lib/interfaces/http.js");

var Hub = new Thing("Hub", "FluxWot Hub", "Web of things Hub", ["Hub", "Web of Things"]);

var things = {};

var isLocal = true;

var callbackRegistry = {};

Hub.processMessage = function(message, callback){
    var self = this;
    var pathParts = message.uri.split("/");
    for(var i=pathParts.length-1;i>=0;i--){
        if(pathParts[i]===""){
            pathParts.splice(i, 1);
        }
    }
    if(pathParts.length===0){
        Thing.prototype.processMessage.call(self, message, function(reply){
            o = {};
            for(var thingName in things){
                o[thingName] = things[thingName].get();
            }
            //add the things list
            reply.payload.things = o;
            callback(reply);
        });
    }else{
        switch(pathParts[0]){
            case '':
                Thing.prototype.processMessage.call(self, message, function(reply){
                    o = {};
                    for(var thingName in things){
                        o[thingName] = things[thingName].get();
                    }
                    //add the things list
                    reply.payload.things = o;
                    callback(reply);
                });
                break;
            /*case 'register':
                console.log(message.payload);
                break;*/
            case 'things':
                console.log("HERERERERERERERER");
                if(pathParts.length==1){
                    o = {};
                    for(var thingName in things){
                        o[thingName] = things[thingName].get();
                    }
                }else{
                    //need to pass handling to the ACTUAL thing being targeted
                    console.log("GETTING THING");
                    self.getThing(pathParts[1], function(err, targetThing){
                        console.log(targetThing);
                        pathParts.shift();
                        pathParts.shift();
                        message.uri = pathParts.join("/");
                        targetThing.processMessage(message, function(reply){
                            if(callback){
                                callback(reply);
                            }
                        });
                    });
                }
                break;
            default:
                Thing.prototype.processMessage.apply(this, arguments);
                break;
        }
    }
};

Hub.register = function(thing, cb){
    console.log("REGISTERING THING");
    if(isLocal){
        things[thing.id] = thing;
        cb(false);
        console.log("EMITTING 1");
        Hub.emit.call(Hub, "added", thing);
    }else{
        //but we also need to register via proxy
        thing.get("", function(err, val){
            var cbId = dataUtils.uuid();
            callbackRegistry[cbId] = function(reply){
                
                if(reply.status==200){
                    things[thing.id] = thing;
                    cb(false);
                    Hub.emit.call(Hub, "added", thing);
                }else{
                    cb(reply);
                }
            };

            Hub._server.send(JSON.stringify({
                uri: "register",
                method: "POST",
                payload: val,
                callback: cbId
            }));
        });
        
    }
};

Hub.getThing = function(id, cb){
    if(id=="/"){
        cb(false, Hub);
    }else{
        if(things[id]){
            cb(false, things[id]);
        }else{
            if(!this._deferredGetThings){
                this._deferredGetThings = {};
            }
            if(!this._deferredGetThings[id]){
                this._deferredGetThings[id] = [];
            }
            this._deferredGetThings[id].push(cb);
        }
    }
};

new iHTTP("http://", "localhost", 3000, function(err, httpInterface){
    if(err){
        if(err.errno == "EADDRINUSE"){
            isLocal = false;

            //hub already running
            var ws = new webSocket("ws://127.0.0.1:8081");
            console.log("SETTING SUBSCRIBE");
            Hub.subscribe = proxySubscribeFn("/", ws);
            Hub.subscribe("added", function(addedThing){
                if(Hub._deferredGetThings){
                    if(Hub._deferredGetThings[addedThing.id]){
                        for(var i=0;i<Hub._deferredGetThings[addedThing.id].length;i++){
                            Hub._deferredGetThings[addedThing.id][i].call(Hub, false, addedThing);
                        }
                        delete Hub._deferredGetThings[addedThing.id];
                    }
                }
            });
            Hub._server = ws;
            ws.on("open", function(){
                console.log("CONNECTED");
            });

            ws.on("message", function(message){
                message = JSON.parse(message);
                console.log(message);
                if(!message.callback ||(!callbackRegistry[message.callback])){

                    switch(message.uri){
                        case "/": //proxy introduction
                            for(var key in message.payload){
                                
                                Hub[key] = message.payload[key];

                                if(key=="things"){
                                    var thingList = message.payload.things;

                                    for(var thingName in thingList){
                                        var thingCfg = thingList[thingName];
                                        var proxiedThing = new Thing(thingCfg.id, thingCfg.name, thingCfg.description, thingCfg.tags);
                                        proxiedThing.subscribe = proxySubscribeFn(proxiedThing.id, ws);

                                        if(thingCfg.properties){
                                            proxiedThing.properties = thingCfg.properties;
                                        }
                                        
                                        if(thingCfg.events){
                                            proxiedThing.properties = thingCfg.properties;
                                        }

                                        if(thingCfg.actions){
                                            for(var actionName in thingCfg.actions){
                                                proxiedThing.addAction(actionName, thingCfg.description, thingCfg.parameters, proxyActionFn(ws, thingCfg.id, actionName));
                                            }
                                        }
                                        things[proxiedThing.id] = proxiedThing;
                                        proxiedThing.start();
                                    }
                                }
                            }

                            Hub.start();
                            break;
                        case "subscribe":
                            console.log("SUBSCRIBING");
                            Hub.getThing(message.payload.id, function(err, proxiedThing){
                                proxiedThing.subscribe.call(proxiedThing, message.payload.event, proxySubscribeCallbackFn(message.callback, ws));
                            });
                            break;
                        default:

                            Hub.processMessage(message);
                            break;
                    }
                }else{
                    console.log(message.uri);
                    if(message.uri=="subscribed_event"){
                        if(callbackRegistry[message.callback]){
                            var evtfn = callbackRegistry[message.callback];
                            evtfn.apply(this, message.payload);
                        }
                    }else{
                        if(callbackRegistry[message.callback]){
                            var fn = callbackRegistry[message.callback];
                            delete message.callback;
                            fn(message);
                            delete callbackRegistry[message.callback];
                        }
                    }
                }
            });
        }else{
            throw err;
        }
    }else{
        //hub wasn't already running
        //create the web socket server
        isLocal = true;
        httpInterface.setThing(Hub);
        startHubServer(8081, function(err, server){
            Hub.start();
        });
    }
});

function startHubServer(port, cb){
    var wss = new webSocketServer({
        port: port
    });

    wss.on("connection", function(ws){
        console.log(ws.upgradeReq.url);
        //send the client the info about the
        Hub.processMessage({
            uri: ws.upgradeReq.url?ws.upgradeReq.url:"/",
            method:"GET",
            payload: null
        }, function(reply){
            ws.send(JSON.stringify({
                uri: "/",
                payload: reply.payload
            }));
        });
        

        ws.on("message", function(messageString){
            var message = JSON.parse(messageString);
            var pathParts = message.uri.split("/");
            if(pathParts[0]===""){
                pathParts.shift();
            }
            console.log(pathParts);
            switch(pathParts[0]){
                case "things":
                    //the Hub Message Processing Can Handle this
                    if(message.callback){
                        console.log("PROCESSING THINGS MESSAGE with Callback");
                        console.log(message);
                        Hub.processMessage(message, proxyActionCallbackFn(message.callback, ws));
                    }else{
                        Hub.processMessage(message, function(){
                        //no-one cares
                        });
                    }
                    
                    break;
                case "register":
                    thingCfg = message.payload;
                    var proxiedThing = new Thing(thingCfg.id, thingCfg.name, thingCfg.description, thingCfg.tags);
                    proxiedThing.subscribe = proxySubscribeFn(thingCfg.id, ws);
                    if(thingCfg.properties){
                        proxiedThing.properties = thingCfg.properties;
                    }
                    
                    if(thingCfg.events){
                        proxiedThing.properties = thingCfg.properties;
                    }

                    if(thingCfg.actions){
                        for(var actionName in thingCfg.actions){
                            console.log(thingCfg.actions[actionName]);
                            proxiedThing.addAction(actionName, thingCfg.description, thingCfg.parameters, proxyActionFn(ws, thingCfg.id, actionName));
                        }
                    }

                    things[proxiedThing.id] = proxiedThing;
                    
                    proxiedThing.start();
                    Hub.emit.call(Hub, "added", proxiedThing);
                    if(message.callback){
                        var reply = {
                            status: 200,
                            payload:{},
                            callback: message.callback
                        };

                        ws.send(JSON.stringify(reply));
                    }
                    break;
                case "subscribe":
                    console.log("RECIEVED");
                    Hub.getThing(message.payload.id, function(err, proxiedThing){
                        console.log("PASSING IT ON");
                        proxiedThing.subscribe(message.payload.event, proxySubscribeCallbackFn(message.callback, ws));
                    });
                    break;
                case "subscribed_event":
                    if(callbackRegistry[message.callback]){
                        var fn = callbackRegistry[message.callback];
                        fn.apply(this, message.payload);
                    }
                    break;
                default:

                    break;
            }
        });
    });

    wss.on("error", function(){
        console.log("WEB SOCKET wsServerInterface ERROR");
        console.log(err);
        cb(err);
    });

    wss.on("listening", function(){
        if(cb){
            cb(false, wss);
        }
    });
}

function proxySubscribeFn(id, ws){

    return function(eventName, fn){
        console.log("Subscribing To: "+eventName);
        if(!this._started){
            console.log('deferring');
            console.log(eventName);
            this._deferredTasks.push({
                fn: 'subscribe',
                args: [eventName, fn]
            });
        }else{
            console.log("Not Deferred");
            if(eventName=="started"){
                fn.apply(this, [this]);
            }else{
                var cbId = dataUtils.uuid();
                if(eventName=="added" && id=="/"){
                    var fn2 = function(addedThing){

                        var proxiedThing = new Thing(addedThing.id, addedThing.name, addedThing.description, addedThing.tags);
                        proxiedThing.subscribe = proxySubscribeFn(proxiedThing.id, ws);

                        if(addedThing.properties){
                            proxiedThing.properties = addedThing.properties;
                        }
                        
                        if(addedThing.events){
                            proxiedThing.properties = addedThing.properties;
                        }

                        if(addedThing.actions){
                            for(var actionName in addedThing.actions){
                                proxiedThing.addAction(actionName, addedThing.description, addedThing.parameters, proxyActionFn(ws, addedThing.id, actionName));
                            }
                        }
                        console.log("ADDED THING: "+addedThing.id);
                        things[proxiedThing.id] = proxiedThing;
                        proxiedThing.start();
                        fn.call(this, proxiedThing);
                    };
                    callbackRegistry[cbId] = fn2;
                }else{
                    callbackRegistry[cbId] = fn;
                }
                
                var message = {
                    uri: "subscribe",
                    method: "POST",
                    payload:{
                        id: id,
                        event: eventName
                    },
                    callback: cbId
                };
                
                ws.send(JSON.stringify(message));
            }
        }
    };
}

function proxySubscribeCallbackFn(cbId, ws, errcb){
    console.log("CALLING SUBSCRIBED EVENT");
    return function(){
        var parameters = [];
        for(var arg in arguments){
            parameters.push(arguments[arg]);
        }

        var reply = {
            callback: cbId,
            uri: 'subscribed_event',
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

function proxyActionCallbackFn(cbId, ws){
    return function(reply){
        reply.callback = cbId;
        ws.send(JSON.stringify(reply));
    };
}
function proxyActionFn(ws, thingId, actionName){
    return function(data){
        console.log("PROXYING ACTION");
        var argArray = [];
        for(var argItem in arguments){
            argArray.push(arguments[argItem]);
        }
        //strip the last argument if it's a function
        var cbId, suppliedCb;
        if((typeof argArray[argArray.length-1])=='function'){
            cbId = dataUtils.uuid();
            suppliedCb = argArray.pop();
            callbackRegistry[cbId] = suppliedCb;
        }
        
        var message = {
            uri: "things/"+thingId+"/actions/"+actionName,
            method: "POST",
            payload: argArray
        };

        if(cbId){
            message.callback = cbId;
        }
        console.log("SENDING MESSAGE");
        ws.send(JSON.stringify(message));
    };
}

Hub.Thing = Thing;
module.exports = Hub;
/*var Thing = require(__dirname+"/lib/thing.js");
var ThingHub = require(__dirname+"/lib/ThingHub.js");
var ThingHubProxy = require(__dirname+"/lib/ThingHubProxy.js");

var BindingHTTP = require(__dirname+"/lib/bindings/http.js");
var BindingWS = require(__dirname+"/lib/bindings/ws.js");

var httpBinding;


var hub = new ThingHub([], "Gateway", "Gateway", "A HTTP/WebSocket Gateway", ["Hub", "Gateway"]);
//first let's see if there is a socket connection running on the local machine

new BindingHTTP("http://", "localhost", 8080, function(err, httpBinding){
    //console.log(arguments);
    if(err){
        //already a server running
        var ThingHttpProxy = require(__dirname+"/lib/proxyHttp.js");

        new ThingProxyWS("ws://localhost:8081", function(err, replacementHub){
            if(!err){
                console.log('replacing');
                console.log(replacementHub);
                replacementHub._eventMethods = hub._eventMethods;
                replacementHub.subscriptions = hub.subscriptions;
                hub = replacementHub;
                hub.start();
            }
        });
    }else{
        hub.registerBinding(httpBinding);
        new BindingWS("ws://localhost", 8081, function(err, wsBinding){
            hub.registerBinding(wsBinding);
            hub.start();
        });
    }
});

//internal web socket binding


module.exports = hub;*/