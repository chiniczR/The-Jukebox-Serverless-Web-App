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

    console.log("Going to look for username=", username, "'s cart")
    ddb.deleteItem({
        Key: {
            "Username": { S: username }
        },
        TableName: "JukeboxUserCarts"
    },
    (err, data) => {
        if (err) errorResponse(err.message, context.awsRequestId, callback)
        else {
            console.log("User=", username, "'s cart has been cleared")
            callback(null, {
                statusCode: 201,
                body: JSON.stringify({ }),
                headers: {
                    'Access-Control-Allow-Origin': '*',
                },
            });
        }
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