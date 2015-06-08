var Thing = require(__dirname+"/../../lib/Thing.js");
var WebSocketThing = require(__dirname+"/../../lib/proxies/WebSocketThing.js");

var hubBaseUrl = "127.0.0.1:8081";
var Hub = WebSocketThing("ws://"+hubBaseUrl+"/");

var retrievedThings = {};

//Things retrieved via the hub are automatically started
Hub.getThing = function(id, cb){
    if(retrievedThings[id]){
        cb(false, retrievedThings[id]);
    }else{
        var retrThing = new WebSocketThing(Hub._connection, "_things/"+id);
        retrThing.subscribe("started", function(){
            console.log("Thing Started: "+this.name);
            cb(false, retrThing);
        });

        retrThing.start();
    }
};

Hub.subscribe("started", function(){
    console.log("HUB STARTED");

    // console.log("GETTING REMOTE THING: test");
    // Hub.getThing("Door", function(err, myDoor){
    //     console.log("Door Thing Retrieved: "+myDoor.name);

    //     myDoor.subscribe("opened", function(){
    //         console.log("The Door was Opened");
    //     });
    // });
    // 
    
    var myDoor = new Thing("Door", "My Door","The door that belongs to me",["Door"]);

    myDoor.addProperty("_isOpen"," Is Open", "Defines the status of the door", "Door");
    myDoor.addEvent("opened", "Door Open", "The door was Opened",{});
    myDoor.addEvent("closed", "Door Open", "The door was Opened",{});

    myDoor.open = function(){
        var self = this;
        console.log("Openeing Door");
        self._isOpen = true;
        self.emit("opened",{});
    };

    myDoor.close = function(){
        var self = this;

        self._isOpen = false;
        self.emit("closed");
    };

    myDoor.subscribe("started", function(){
        Hub.register(myDoor, function(regErr, reply){
            console.log("Door Registered");
            setTimeout(function(){
                myDoor.open();
            }, 6000);
            setTimeout(function(){
                myDoor.close();
            }, 9000);
        });
    });

    myDoor.start();
});

Hub.start();