const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB();

exports.handler = (event, context, callback) => {
    if (!event.requestContext.authorizer) {
        errorResponse('Authorization not configured', context.awsRequestId, callback);
        return;
    }
    console.log('Received event: ', event);

    // Because we're using a Cognito User Pools authorizer, all of the claims
    // included in the authentication token are provided in the request context.
    // This includes the username as well as other attributes.
    const username = event.requestContext.authorizer.claims['cognito:username'];

    // The body field of the event in a proxy integration is a raw string.
    // In order to extract meaningful values, we need to first parse this string
    // into an object. A more robust implementation might inspect the Content-Type
    // header first and use a different parsing strategy based on that value.
    const requestBody = JSON.parse(event.body);

    const itemId = requestBody.ItemID

    var cart = [ itemId.toString() ]
    console.log("Going to look for username: ", username)
    ddb.getItem({
        Key: {
            "Username": { S: username}
        },
        TableName: "JukeboxUserCarts",
        AttributesToGet: [
            "CartItems"
        ]
    },
    (err, data) => {
        if (err) errorResponse(err.message, context.awsRequestId, callback)
        else if (data['Item']) {
            var currCart = data["Item"]["CartItems"]["NS"]
            cart = currCart.toString().split(',');
            if (cart.includes(itemId.toString())) { 
                console.log('Item with ID=', itemId, ' to be removed from cart of user=', username)
                var newCart = currCart.toString().split(',').filter(i => i.toString() != itemId.toString())
                var toUpdate = {
                    TableName: "JukeboxUserCarts",
                    Key: { Username: { S: username } },
                    UpdateExpression: "SET CartItems = :c",
                    ExpressionAttributeValues: {
                        ":c": { NS: newCart }
                    },
                    ReturnValues: "UPDATED_NEW"
                }
                ddb.updateItem(toUpdate, function (err1, doot) {
                    if (err1) errorResponse(err1.message, context.awsRequestId, callback);
                })
            }
        }
        callback(null, {
            statusCode: 201,
            body: JSON.stringify({}),
            headers: {
                'Access-Control-Allow-Origin': '*',
            },
        });
    })
}

function errorResponse(errorMessage, awsRequestId, callback) {
    callback(null, {
        statusCode: 500,
        body: JSON.stringify({
            Error: errorMessage,
            Reference: awsRequestId,
        }),
        headers: {
            'Access-Control-Allow-Origin': '*',
        },
    });
}