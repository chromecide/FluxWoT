var ThingHub = require(__dirname+"/index.js");

ThingHub.subscribe("started", function(){
    console.log("HUB STARTED");
    var MainSwitch = new ThingHub.Thing("MainSwitch", "Main Switch", "The Main Room Switch", ["Switch", "Main"]);

    MainSwitch.actions = {};

    MainSwitch.properties = {
        status: {
            name: "Status"
        }
    };

    MainSwitch._status = false;
    MainSwitch.events = ["turned_on", "turned_off"];

    MainSwitch.toggle = function(cb){
        console.log("Toggled");
        MainSwitch._status = !MainSwitch._status;
        MainSwitch.emit("toggled", MainSwitch._status);
    };

    ThingHub.register(MainSwitch, function(){
        MainSwitch.start();
        //simulate the light being toggled
        setInterval(function(){
            MainSwitch.toggle();
        }, 5000);
    });
});