var ThingHttpProxy = require(__dirname+"/lib/proxyHttp.js");

var hub = new ThingHttpProxy("http://locahost:3000");

new ThingHttpProxy("http://localhost:3000", function(err, hub){
    console.log(hub);
});