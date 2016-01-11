/**
 * Created by mitsos on 1/11/16.
 */

var model = require('./model')
    , async = require('async')
    , aggregationOperators = {}
    , cursor = require('./cursor')
    ;

aggregationOperators.$match = function(docs,matchObj,callback){
    var i = docs.length;
    while(i--){
        if (!model.match(docs[i],matchObj)){//does not match
            docs.splice(i,1);//remove from set
        }
    }//end of match loop
    callback(null,docs);//return the filtered set
};

aggregationOperators.$unwind = function(docs,unwindElement,callback){
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



exports.exec = exec;