const randomBytes = require('crypto').randomBytes;
const AWS = require('aws-sdk');

const ddb = new AWS.DynamoDB();
const ses = new AWS.SES({region: 'us-west-2'});

let sourceEmail = process.env.SRC_EMAIL

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

    const requestBody = JSON.parse(event.body);

    const items = requestBody.Items.map(i => { return i.toString() })
    const total = requestBody.Total.toString()
    var d = new Date()
    const date = d.toISOString()

    const purchaseId = toUrlString(randomBytes(16));

    ddb.putItem({
        TableName: "JukeboxPurchases",
        Item: {
            PurchaseId: { S: purchaseId },
            Username: { S: username },
            CartItems: { NS: items },
            Total: { N: total },
            PurchaseDate: { S: date }
        }
    },
    (err, data) => {
        if (err) errorResponse(err.message, context.awsRequestId, callback)
        else {
            console.log("Successfully bought ", items, " for user=", username)
            var params = {
                Destination: {
                    ToAddresses: [username]
                },
                Message: {
                    Body: {
                        Text: { Data: "Hey there!\n\nCongratulations on your Jukebox purchase!\n\nHere are it's details:\n\n"
                                + "PurchaseID: " + purchaseId + "\nPurchased Items IDs: " + items + "\nTotal: " + total + "$\nDate:" + date                        
                        }
                    },                
                    Subject: { Data: "Your Jukebox Purchase" }
                },
                Source: sourceEmail
            };
            ses.sendEmail(params, function (err1, data1) {
                if (err1) {
                    errorResponse(err1.message, context.awsRequestId, callback)
                } else {
                    console.log(data1);
                    // context.succeed(event);
                    callback(null, {
                        statusCode: 201,
                        body: JSON.stringify({}),
                        headers: {
                            'Access-Control-Allow-Origin': '*',
                        },
                    });
                }
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

function toUrlString(buffer) {
    return buffer.toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=/g, '');
}