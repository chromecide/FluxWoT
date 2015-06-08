var Thing = require(__dirname+"/../../lib/Thing.js");
var WebSocketServerThing = require(__dirname+"/../../lib/proxies/WebSocketServerThing.js");
var WebSocketThing = require(__dirname+"/../../lib/proxies/WebSocketThing.js");

var Hub = new WebSocketServerThing("localhost", 8081, "HubTest", "Hub Test", "A Basicc test Hub", ["Test", "Hub"]);

Hub._things = {};

var callbackRegistry = {

};

Hub._loadThingDefs = function(thingList, processedThings, cb){
    if(thingList.length===0){
        cb(processedThings);
        return;
    }

    var nextThing = thingList.shift();

    nextThing.get("", function(err, t){
        processedThings[t.id] = t;
        Hub._loadThingDefs(thingList, processedThings, cb);
    });
};

Hub.processRawMessage = function(ws, message){
    console.log("PROCESSING RAW MESSAGE");
    if(message.uri=="/actions/register"){
        //we need to turn the supplied config into an actual Thing
        var thingCfg = message.payload;
        console.log(thingCfg);
        var remoteThing = WebSocketThing(ws, thingCfg.id);
        remoteThing.start();
        console.log(remoteThing);
    }else{
        return true;
    }
};

Hub.processMessage = function(message, callback){
    var pathParts = message.uri.split("/");

    if(pathParts[0]===""){
        pathParts.shift();
    }

    switch(pathParts[0]){
        case "/":
            console.log("LOADING THINGDEF");

            WebSocketServerThing.prototype.processMessage.call(Hub, message, function(reply){
                
                var thingList = [];
                for(var thingName in Hub._things){
                    thingList.push(Hub._things[thingName]);
                }
                Hub._loadThingDefs(thingList, {}, function(thingDefs){
                    reply.payload._things = thingDefs;
                    callback(reply);
                });
            });
            break;
        case "_things":
            if(pathParts.length==1){
                WebSocketServerThing.prototype.processMessage.apply(Hub, arguments);
            }else{
                console.log(message);
                var thingId = pathParts[1];
                var t = Hub._things[thingId];

                message.uri = pathParts.join("/");
                pathParts.shift();
                pathParts.shift();

                message.uri = pathParts.join("/");
                if(message.uri===""){
                    message.uri = "/";
                }

                if(pathParts[0]=="subscribe"){
                    t.subscribe(pathParts[1], function(){
                        var argList = [];

                        for(var arg in arguments){
                            argList.push(arguments[arg]);
                        }

                        var reply = {
                            status: 200,
                            uri: message.payload.callback_uri||"/",
                            payload: argList
                        };

                        callback.call(Hub, reply);
                    });
                }else{
                    t.processMessage(message, function(reply){
                        if(pathParts[0]!="subscribe"){
                            if(message.uri=="/"){
                                reply.payload = [false, reply.payload];
                            }

                            callback(reply);
                        }else{
                            console.log("SHOULD BE NO REPLY");
                        }
                    });
                }
            }
            break;
        case "actions":
            if(pathParts[1] && pathParts[1] =="register"){
                console.log("Intercepting register");
                console.log(message);
                var thingCfg = message.payload;
                console.log(thingCfg);
                //var thingToReg = new WebSocketThing(self._c)
            }else{
                WebSocketServerThing.prototype.processMessage.apply(Hub, arguments);
            }
            break;
        default:
            WebSocketServerThing.prototype.processMessage.apply(Hub, arguments);
            break;
    }
    
};

Hub.get = function(path, cb){
    console.log("INTERCEPTED GET: "+path);
    if(!path){
        path="";
    }
    var pathParts = path.split("/");
    
    if(pathParts[0]===""){
        pathParts.shift();
    }

    if(pathParts.length===0){
        pathParts=["/"];
    }

    switch(pathParts[0]){
        case "/":
            WebSocketServerThing.prototype.get.call(Hub, path, function(err, val){
                cb(err, val);
            });
            break;
        case "_things":
            if(pathParts.length>1){
                console.log("LOADING SUB THING");
                if(Hub._things[pathParts[1]]){
                    var t = Hub._things[pathParts[1]];
                    var tPath = "";
                    
                    if(pathParts.length>2){
                        pathParts.shift();// remove _things
                        pathParts.shift(); //remove id
                        tPath = pathParts.join("/");
                    }
                    if(pathParts.length>1){
                        if(pathParts[0] =="subscribe"){
                            t.subscribe(pathParts[1], function(){
                                var reply = {
                                    status: 200,
                                    callback_uri: ""
                                };
                            });
                        }
                        
                    }else{
                        t.get(tPath, function(err, val){
                            console.log("+++++++++++++++++++");
                            console.log(val);
                            cb(err, val);
                        });
                    }
                }
            }else{
                Hub._loadThingDefs(thingList, {}, function(thingDefs){
                    var reply = {
                        status: 200,
                        payload: thingDefs
                    };
                    callback(reply);
                });
            }
            break;
        default:
            WebSocketServerThing.prototype.get.call(Hub, path, cb);
            break;
    }
};

Hub.subscribe("started", function(){
    console.log("Hub Started:"+this.name);
    console.log(this);
});

Hub.addProperty(
    "_things",
    "Thing List",
    "List of Things proxied by this Hub",
    "ThingArray"
);


Hub.addEvent(
    "_things",
    "Things Collection Events",
    {
        //valid values are ADDED, REMOVED
        type: {
            name: "type",
            type: "string"
        },
        thing: {
            name: "thing",
            type: "thing"
        }

    }
);

Hub.addAction(
    "register",
    "Register Thing",
    "Register a Thing to be Proxied",
    {
        "thing":{
            type: "Thing"
        },
        "callback_uri":{
            type: "string"
        }
    },
    function(thing, callback){
        if(!Hub._things[thing.id]){
            //we need to make sure it's not just a thing cfg for a remote thing
            if(thing.get && (typeof thing.get)=="function"){
                Hub._things[thing.id] = thing;
            }else{
                console.log("NEED TO TURN this into a ThingObject")
            }
            
            thing.get("", function(err, thingCfg){
                Hub.emit("_things", "ADDED", thingCfg);
                callback(false, {});
            });
        }else{
            callback(new Error("Thing ID Exists"));
        }
    });

//REDUNDANT ON A SERVER

// Hub.addAction(
//     "getThing",
//     "Gets the definition of a Proxied Thing",
//     {
//         id: {
//             name: 'Thing ID',
//             type: 'string'
//         },
//         callback_uri: {
//             name: 'Callback URI',
//             type: 'string'
//         }
//     },
//     function(id, callback){
//         console.log("GETTING THING on SERVER");
//         if(Hub._things[id]){
//             console.log("LOADED SUBBY");
//             var retThing = Hub._things[id];
//             retThing.get("", function(err, thingCfg){

//                 callback(false, thingCfg);
//             });
//         }else{
//             console.log("DOING ERROR CALLBACK");
//             callback(new Error("Thing not Found"));
//         }
//     });

Hub.start();