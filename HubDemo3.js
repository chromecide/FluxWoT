var ThingHub = require(__dirname+"/index.js");
/*ThingHub.subscribe("added", function(addedThing){
    console.log(addedThing);
});*/
ThingHub.subscribe("started", function(ThingHub){
    /*ThingHub.get("things", function(err, val){
        console.log(val);
    });*/
    
    ThingHub.getThing("MainSwitch", function(err, mySwitch){
        console.log("MainSwitch Ready");

        ThingHub.getThing("MainLight", function(err, myLight){
            mySwitch.subscribe("toggled", function(status){
                console.log("Switch was Toggled to "+(status==true?"On":"Off"));
                if(status===true){
                    myLight.turn_on();
                }else{
                    myLight.turn_off();
                }
            });
        });
    });
});