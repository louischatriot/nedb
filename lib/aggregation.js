/**
 * Created by mitsos on 1/11/16.
 */

var model = require('./model')
    , async = require('async')
    , aggregationOperators = {}
    , groupAggregators = {}
    , Cursor = require('./cursor')
    ;

/**
 * Supported Aggregators for $group functionality
 */
groupAggregators.$sum = function(sumObj, previousValue,doc){
    if (!previousValue) previousValue = 0;//initialize it if not initialized yet
    //check operator value
    if (typeof sumObj ==='string' && sumObj.charAt(0) === '$'){//expression
        var docProp = sumObj.substr(1);
        previousValue += doc[docProp];
    }
    else{//simple value
        previousValue += parseInt(sumObj);
    }
    return previousValue;
};

/**
 * Aggegation Operators that will be supported in aggregation pipeline
 */

aggregationOperators.$match = function (docs,matchObj,callback) {
    var i = docs.length;
    while(i--){
        if (!model.match(docs[i],matchObj)){//does not match
            docs.splice(i,1);//remove from set
        }
    }//end of match loop
    callback(null,docs);//return the filtered set
};

aggregationOperators.$unwind = function (docs,unwindElement,callback) {
    if (unwindElement.charAt(0) === '$') unwindElement = unwindElement.substr(1);// remove first dollar character if there
    //browse results and unwind them
    var newDataSet = [];
    var doc, docUnwindEl, newUnwindDoc;
    for (var i = 0, docLen = docs.length;i<docLen;i++){
        doc = docs[i];
        docUnwindEl = doc[unwindElement];
        if (typeof doc[unwindElement] === 'undefined'){
            continue;//does not exist, continue
        }
        else if (Array.isArray(docUnwindEl)){//manually unwind
            var unwindElemLen = docUnwindEl.length;
            if (unwindElemLen === 0) continue;//array element without any content, skip
            delete doc[unwindElement];//remove array from parent object
            for (var j = 0; j<unwindElemLen;j++){//loop array field element from original doc
                newUnwindDoc = model.deepCopy(doc);//copy original doc
                newUnwindDoc[unwindElement] = docUnwindEl[j];//the current doc of the array element that's unwinded
                newDataSet.push(newUnwindDoc);
            }//end loop of doc field
        }
        else{//not an array element, error
            return callback(new Error('$unwind operator used on non-array field: '+unwindElement));
        }
    }//end loop for docs, new Dataset created
    callback(null,newDataSet);
};

aggregationOperators.$sort = function (docs,sortObj,callback) {
    var tmpDb = {
        getCandidates:function(){return docs}
    };
    var tmpCursor = new Cursor(tmpDb);//construct cursor to use already built in functionality for sorting in cursor prototype
    tmpCursor.sort(sortObj);//apply sort object
    tmpCursor._exec(callback);//call internal functionality of cursor to provide results
};

aggregationOperators.$skip = function (docs,skip,callback) {
    if (skip > docs.length){
        return callback(new Error('Skip option provided '+skip+' greater than actual length of provided dataset'));
    }
    callback(null,docs.slice(skip));
};

aggregationOperators.$limit = function (docs,limit,callback) {
    return callback(null,docs.slice(0,limit));
};

aggregationOperators.$group = function (docs,groupObj,callback) {
    if (typeof groupObj._id === 'undefined'){
        return callback(new Error('Group Object in operator does not contain an _id field'));
    }
    //group object ok.. continue
    var newDataSet = [];
    var i = docs.length;
    var idElem = groupObj._id;
    var currentDoc, docId, j,aggregator, docToModify = null;
    while (i--){
        currentDoc = docs[i];
        docId = getDocGroupId(idElem,currentDoc);//get doc's _id expression
        //find existing or create new doc
        j = newDataSet.length;
        while (j--){
            if (newDataSet[j]._id !== docId) continue;
            //doc found
            docToModify = newDataSet[j];
            break;///found no need to iterate
        }
        //check if docToModify was not found in order to create it
        if (!docToModify){
            docToModify = {_id:docId};//add the group match _id
            newDataSet.push(docToModify);
        }
        //apply aggregators
        for (var property in groupObj){
            if (property === '_id') continue;//skip these properties
            if (!groupAggregators[property]) return callback(new Error('Unsupported aggregator '+property+' used in $group'));
            aggregator = groupObj[property];//get aggregator object
            docToModify[property] = groupAggregators[property](aggregator, docToModify[property],currentDoc);
        }
        //appliance of operators finished
    }//end of iteration of result set
    callback(null,newDataSet);
};

aggregationOperators.$project = function (docs,projectObj,callback) {
    var newDataSet = [];
    var doc,j,projectKey, newDoc,projectValue, dotArray, k, dotArrayLen, dotArrayElem;
    var projectKeys = Object.keys(projectObj);//get project object keys
    for (var i = 0,docsLen = docs.length;i<docsLen;i++){
        doc = docs[i];
        newDoc = {};//initialize new doc
        j = projectKeys.length;
        while (j--){
            projectKey = projectKeys[j];//current projection key
            projectValue = projectObj[projectKey];
            if (projectValue === 1 || projectValue === true){//simple inclusion of field
                newDoc[projectKey] = doc[projectKey];
            }
            else if(typeof projectValue === 'string' && projectValue.charAt(0) === '$'){//expressions
                projectValue = projectValue.substr(1);
                dotArray = projectValue.split('.');
                k = 0;
                dotArrayLen = dotArray.length;
                projectValue = dotArray[0];
                while (++k < dotArrayLen){
                    dotArrayElem = dotArray[k];
                    projectValue = projectValue[dotArrayElem];
                    if (typeof projectValue === 'undefined') break;//exit loop, non existing property selected
                }
                if (typeof projectValue !== 'undefined') newDoc[projectKey] = projectValue;
            }
        }
        //newDoc constructed
        newDataSet.push(newDoc);
    }
    callback(null,newDataSet);
};

/**
 * Run the Aggregation pipeline of operators upon the provided dataset
 * @param {Array} dataset The array of objects that will have the aggregation operations applied on
 * @param {Array} pipeline The array that will hold the aggregation operators that should be applied on the provided dataset
 * @param {Function} cb The callback function that will accept the result with signature (err,resultDocsArray)
 */
function exec(dataset, pipeline, cb){
    async.reduce(pipeline,dataset,function(docs,operator,callback){
        //check to find which operator to use
        var operation = Object.keys(operator)[0];//get the key of the operator in pipeline to determine operation
        if (!aggregationOperators[operation]){
            return callback(new Error('Unknown aggregation operator '+operation+' used.'));
        }
        else{//operation exists, call it
            aggregationOperators[operation](docs,operator[operation],callback);
        }
    },cb);
}

/**
 * Helper Functions
 */

/**
 * This function will accept the _id element of a $group match operator and a
 * doc and will return the computed value depending on _id content
 * @param {string} groupId the string that will set the field to return
 * @param {object} doc The object from which we want the id extracted
 * @returns {*} the id field from the doc
 */
function getDocGroupId(groupId,doc){
    if (!groupId || (typeof groupId === 'string' && groupId.charAt(0) !== '$')){//either null or not expression
        return groupId;
    }
    //expression
    groupId = groupId.substr(1);//remove first dollar character
    return doc[groupId] || null;
}

exports.exec = exec;