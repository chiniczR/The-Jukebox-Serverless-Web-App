const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB();

exports.handler = (event) => {
    var params = {
        TableName: "JukeboxGuestCarts"
    };
    ddb.deleteTable(params, function (err, data) {
        if (err) console.log(err, err.stack);   // an error occurred
        else console.log(data);                 // successful response
    });
    setTimeout(function() {
        params = {
            AttributeDefinitions: [
                {
                    AttributeName: "IdentityID",
                    AttributeType: "S"
                }
            ],
            KeySchema: [
                {
                    AttributeName: "IdentityID",
                    KeyType: "HASH"
                }
            ],
            ProvisionedThroughput: {
                ReadCapacityUnits: 5,
                WriteCapacityUnits: 5
            },
            TableName: "JukeboxGuestCarts"
        };
        ddb.createTable(params, function(err, data) {
            if (err) console.log(err, err.stack); // an error occurred
            else     console.log(data);           // successful response
        })
    }, 4000);
}