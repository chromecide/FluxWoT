var jsonld = require("jsonld");
var dataUtils = require(__dirname+"/functions.js");

function Thing(id, name, description, tags){
    this._isThing = true;
    this._running = false;
    this._started = false;
    this._deferredTasks = [];
    this._callbackRegistry = {};

    this.id = id;
    this.name = name;
    this.description = description;

    this.tags = tags;

    if(this.properties){
        //fill in the blanks
        
    }else{
        this.properties = {};
    }
    
    if(!this.links){
        this.links = {
            "properties": {
                "link": "properties/",
                "title": "List of Properties"
            },
            "events": {
                "link": "events/",
                "title": "List of Events"
            },
            "actions": {
                "link": "actions/",
                "title": "List of Actions"
            }
        };
    }

    if(!this.events){
        this.events = [];
    }

    for(var i=0;i<this.events.length;i++){
        var streamName = this.events[i];
    }

    if(!this.actions){
        this.actions = {};
    }

    this.subscriptions = {};

    this._eventMethods = {};
}


    Thing.prototype.start = function(cb){
        this._started = true;
        if(this._deferredTasks){
            processDeferredTasks(this, this._deferredTasks);
        }else{
            console.log("no deferred Tasks");
        }

        this.emit("started", this);
        if(cb){
            cb(false, this);
        }
    };

    Thing.prototype.stop = function(cb){
        this._started = false;
        this.emit("stopped", this);

        if(cb){
            cb(false, this);
        }
    };

    Thing.prototype.get = function(path, cb){
        var o;
        if(!path){
            o = {
                id: this.id,
                name: this.name,
                description: this.description,
                tags: this.tags,
                properties: this.properties,
                actions:this.actions,
                events: this.events
            };

            if(o.properties){
                for(var propName in o.properties){
                    var prop = o.properties[propName];
                    var val = this[propName];
                    console.log(val);
                }
            }
            // if(this.things){
            //     o.things = {};
            //     for(var thingName in this.things){
            //         o.things[thingName] = {
            //             id: this.things[thingName].id,
            //             name: this.things[thingName].name,
            //             description: this.things[thingName].description,
            //             tags:this.things[thingName].tags
            //         };
            //     }
            // }
        }else{
            // if(path=="things"){
            //     o = {};
            //     for(var thingName in this.things){
            //         o[thingName] = {
            //             id: this.things[thingName].id,
            //             name: this.things[thingName].name,
            //             description: this.things[thingName].description,
            //             tags:this.things[thingName].tags
            //         };
            //     }
            // }else{
                o = dataUtils.getObjectValueByString(this, path);
            //}
        }
        if(cb){
            cb(false, o);
        }
        return o;
    };

    Thing.prototype.set = function(prop, val){
        if(this.properties["_"+prop]){
            //TODO: there may be some validation required

        }else{
            dataUtils.setObjectValueByString(this.properties.customFields, prop, val);
        }
    };

    Thing.prototype.emit = function(streamName, data){
        var eventMethods = dataUtils.getObjectValueByString(this._eventMethods, streamName);
        
        if(eventMethods && eventMethods.length>0){
            var argList = [];
            for(var arg in arguments){
                argList.push(arguments[arg]);
            }
            for(var fIdx=0;fIdx<eventMethods.length;fIdx++){
                var fn = eventMethods[fIdx];
                fn.apply(this, argList);
            }
        }
    };

    Thing.prototype.processMessage = function(message, callback){
        console.log(this.name+":");
        console.log(message);
        var self = this;
        var pathParts = message.uri.split("/");
        for(var i=pathParts.length-1;i>=0;i--){
            if(pathParts[i]===""){
                pathParts.splice(i, 1);
            }
        }

        if(pathParts.length===0){
            this.get("", function(err, def){
                if(!err){
                    if(callback){
                        callback({
                            status: 200, //ok
                            payload: def
                        });
                    }
                }else{
                    var message = {
                        status: 500, //internal server errror
                        payload: err
                    };
                    if(callback){
                        callback(message);
                    }
                    
                }
            });
        }else{
            switch(pathParts[0]){
                case "events":
                    this.get("events", function(err, evtDef){
                        if(callback){
                            callback({
                                status: 200, //ok
                                payload: evtDef
                            });
                        }
                    });
                    break;
                case "actions":
                    if(pathParts.length==1){
                        this.get("actions", function(err, actionDef){
                            if(callback){
                                callback({
                                    status: 200, //ok
                                    payload: actionDef
                                });
                            }
                        });
                    }else{
                        if(message.method=="POST"){
                            console.log("RUNNING ACTION");
                            console.log(message);
                            this.runAction(pathParts[1], message.payload, function(returnedData){
                                if(callback){
                                    callback(returnedData);
                                }
                            });
                        }else{
                            if(callback){
                                callback({
                                    status: 405, //method not allowed
                                    payload: {
                                        message: "Method Not Allowed"
                                    }
                                });
                            }
                        }
                    }
                    break;
                default:
                    //see if we have a matching property
                    if(self.properties[pathParts[0]]){
                        self.get(pathParts.join("/"), function(err, prop){
                            console.log(message);
                            if(callback){
                                if(err){
                                    callback({
                                        status: 404,
                                        payload: {
                                            message: err.toString()
                                        }
                                    });
                                }else{
                                    console.log(message);
                                    callback({
                                        status: 200,
                                        uri: message.payload.callback_uri,
                                        payload: [false, prop]
                                    });
                                }
                                    
                            }
                        });
                    }else{
                        if(callback){
                            callback({
                                status: 404, //not found
                                payload:{
                                    "message":"Not Found"
                                }
                            });
                        }
                    }
                    
                    break;
            }
        }
    };

    Thing.prototype.runAction = function(actionName, data, cb){
        if(this.actions && this.actions[actionName] && this[actionName]){
            var actionCfg = this.actions[actionName];
            var fn = this[actionName];
            fn(data, function(reply){
                if(cb){
                    cb(reply);
                }
            });
        }else{
            if(cb){
                cb({
                    status: 404,
                    payload: {
                        message: "Not Found"
                    }
                });
            }
        }
    };

    Thing.prototype.addAction = function(id, name, description, params, fn){
        this.actions[id] = {
            name: name,
            description: description,
            parameters: params
        };
        this[id] = fn;
    };

    Thing.prototype.addEvent = function(id, name, description, params){
        this.events = {
            name: name,
            description: description,
            parameters: params
        };
    };

    Thing.prototype.addProperty = function(id, name, description, type){
        this.properties[id] = {
            name: name,
            description: description,
            type: type
        };
    };

    Thing.prototype.subscribe = function(streamName, thing){
        if(!this._started){
            this._deferredTasks.push({
                fn: 'subscribe',
                args: [streamName, thing]
            });
        }else{
            var eventMethods = dataUtils.getObjectValueByString(this._eventMethods, streamName);

            if(!eventMethods){
                eventMethods = [];
            }

            eventMethods.push(thing);
            dataUtils.setObjectValueByString(this._eventMethods, streamName, eventMethods);
        }
    };

    function processDeferredTasks(deferredThing, tasks){
        for(var i=0;i<tasks.length;i++){
            deferredThing[tasks[i].fn].apply(deferredThing, tasks[i].args);
        }
        deferredTasks = [];
    }

    function subscribeCallbackFn(self, eventName){
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
    }

Thing.dataUtils = dataUtils;

module.exports = Thing;