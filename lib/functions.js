
function getObjectValueByString(obj, keyStr, debug){
    if(!obj){
        return null;
    }

    if(!keyStr || keyStr===""){
        return obj;
    }

    var attrParts, attr, subObj, returnArray, i, itemValue;
    if(Array.isArray(obj)){
        

        if(keyStr.indexOf('/')>-1){

            attrParts = keyStr.split('/');
            attr = attrParts.shift();

            var nextAttr = attrParts.join('/');
            if(obj){
                returnArray = [];

                for(i=0;i<obj.length;i++){
                    itemValue = getObjectValueByString(obj[i], attr);
                    returnArray.push(returnArray);
                }

                return getObjectValueByString(returnArray, nextAttr);
            }else{
                return null;
            }
        }else{
            returnArray = [];

            for(i=0;i<obj.length;i++){
                itemValue = getObjectValueByString(obj[i], keyStr);
                returnArray.push(itemValue);
            }
            return returnArray;
        }
    }else{
        if(keyStr.indexOf('/')>-1){
            attrParts = keyStr.split('/');
            attr = attrParts.shift();

            subObj = obj[attr];
            return getObjectValueByString(subObj, attrParts.join('/'), debug);
        }else{
            return obj[keyStr];
        }
    }
}

function setObjectValueByString(obj, keyStr, value){
    if(keyStr.indexOf('/')>-1){
        var attrParts = keyStr.split('/');
        var attr = attrParts.shift();
        if(obj[attr]===undefined){
            obj[attr] = {};
        }
        var subObj = obj[attr];

        setObjectValueByString(subObj, attrParts.join('/'), value);
    }else{
        obj[keyStr] = value;
    }
}

function guid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

module.exports = {
    getObjectValueByString: getObjectValueByString,
    setObjectValueByString: setObjectValueByString,
    uuid: guid
};