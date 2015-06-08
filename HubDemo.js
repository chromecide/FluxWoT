var ThingHub = require(__dirname+"/index.js");

ThingHub.subscribe("started", function(){
    console.log("started");
    var MainLight = new ThingHub.Thing("MainLight", "Main Light", "The Main Room Light", ["Light", "Main"]);

    MainLight.actions = {
            turn_on: {
            name: "Turn On",
            description:" Turns the Light on"
        },
        turn_off: {
            name: "Turn Off",
            description:" Turns the Light off"
        }
    };

    MainLight.properties = {
        status: {
            name: "Status"
        }
    };

    MainLight.events = ["turned_on", "turned_off"];

    MainLight.turn_on = function(args, cb){
        var reply = {};
        if(MainLight._status!=1){
            console.log("The Light is now: ON");
            MainLight.emit("turned_on", MainLight);
            MainLight._status = 1;
            reply.status = 200;
            reply.payload = {};
        }else{
            reply.status = 500;
            reply.payload = {
                message: "The light is already on!"
            };
        }

        if(cb){
            cb(reply);
        }
    };

    MainLight.turn_off = function(cb){
        console.log("The Light is now: Off");
        MainLight.emit("turned_off", this);
    };

    MainLight.subscribe("turned_off", function(){
        console.log("WHO TURNED OUT THE LIGHTS?!?!?!?");
    });

    ThingHub.register(MainLight, function(){
        console.log("Main Light Registered");
        MainLight.start();
        ThingHub.getThing("MainLight", function(err, testLight){
            testLight.turn_off();
        });
    });
});