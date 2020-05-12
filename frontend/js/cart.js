var at;

var poolData = {
    UserPoolId: _config.cognito.userPoolId,
    ClientId: _config.cognito.userPoolClientId
};

var userPool, authToken, username;

function changeLoginBtn() {
    var loginBtn = document.getElementById('loginBtn')
    loginBtn.textContent = 'Logout  '
    var icon = document.createElement('i')
    icon.classList.add('fas', 'fa-sign-out-alt')
    loginBtn.appendChild(icon)
    loginBtn.onclick = (event) => {
        event.preventDefault();
        loginBtn.outerHTML = '<a class="nav-link text-dark" id="loginBtn" href="./login.html">Login <i class="fas fa-sign-in-alt"></i></a>'
        signOut();
    }
}

if (!(_config.cognito.userPoolId &&
    _config.cognito.userPoolClientId &&
    _config.cognito.region)) {
    alert("Amazon Cognito is not configured!")
}
else {
    userPool = new AmazonCognitoIdentity.CognitoUserPool(poolData);

    if (typeof AWSCognito !== 'undefined') {
        AWSCognito.config.region = _config.cognito.region;
    }

    function signOut() {
        userPool.getCurrentUser().signOut();
    };

    authToken = new Promise(function fetchCurrentAuthToken(resolve, reject) {
        var cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            if (cognitoUser.username) {
                // alert('Found user: ' + cognitoUser.username)
                username = cognitoUser.username
            }
            cognitoUser.getSession(function sessionCallback(err, session) {
                if (err) {
                    reject(err);
                } else if (!session.isValid()) {
                    resolve(null);
                } else {
                    resolve(session.getIdToken().getJwtToken());
                }
            });
        } else {
            resolve(null);
        }
    });
    
    authToken.then(function setAuthToken(token) {
        if (token) {
            at = token
            setTimeout(() => {
                changeLoginBtn()
                document.getElementById('greeting').textContent = 'Logged in as ' + username
            }, 100);
        }
        else {
            setTimeout(() => {
                // Initialize the Amazon Cognito credentials provider
                AWS.config.region = 'us-east-2'; // Region
                AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                    IdentityPoolId: 'us-east-2:be4d13f7-7fc3-4b9d-b0b1-ab448dd7271b',
                });

                // Getting the current user's guest IdentityID (whether logged in or not)
                var identityId = AWS.config.credentials.identityId;

                // Create the DynamoDB service object
                var ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

                // Retrieve (parse) the items from the inventory file products.js and display them
                var products = JSON.parse(data)

                // Here we contact the DynamoDB table for session (i.e. cart) management
                // Set the params to request the user's current stored cart
                var params = {
                    Key: {
                        "IdentityID": {
                            S: identityId
                        }
                    },
                    TableName: "JukeboxGuestCarts",
                    AttributesToGet: [
                        'CartItems'
                    ]
                };
                // Make the request
                ddb.getItem(params, function (err, data) {
                    if (err) alert(err + '\n' + err.getMessage()); // An error occurred
                    else {
                        // Get the list of items in the cart
                        var cart = data["Item"]["CartItems"]["NS"]
                        var cont = document.getElementById('cont')
                        document.getElementById('loading-icon').remove()
                        document.getElementById('loading-text').remove()
                        cart = cart.toString().split(',')
                        var total = 0.0
                        cart.forEach(i => {
                            var item = products.filter(x => x.ItemID.toString() == i)[0]
                            var prod = document.createElement('div')
                            prod.classList.add('product', 'container-fluid')
                            var row = document.createElement('div')
                            row.classList.add('cont-prod', 'row', 'product')
                            var coverCol = document.createElement('div')
                            coverCol.classList.add('col-1')
                            var coverImg = document.createElement('img')
                            coverImg.classList.add('cover-img-alt')
                            coverImg.src = "./inventory/covers/" + item.Cover
                            coverImg.setAttribute("data-toggle", "tooltip")  // Setting a tooltip with the album's track
                            var trackList = item.Album + " - Track List:\n"
                            var count = 1
                            item.Tracks.forEach(track => {
                                trackList += count + '. ' + track + '\n'
                                count++
                            });
                            coverImg.setAttribute("title", trackList)
                            coverCol.appendChild(coverImg)
                            row.appendChild(coverCol)
                            var restCol = document.createElement('div')
                            restCol.classList.add('col-10')
                            var h4 = document.createElement('h4')
                            h4.classList.add('dark-shadow')
                            h4.textContent = item.Album
                            restCol.appendChild(h4)
                            var h5 = document.createElement('h5')
                            h5.textContent = item.Artist
                            restCol.appendChild(h5)
                            var h6 = document.createElement('h6')
                            h6.textContent = "Hover over the album cover to check its track list"
                            restCol.appendChild(h6)
                            var price = document.createElement('h3')
                            price.classList.add('text-right', 'dark-shadow')
                            price.textContent = item.Price + '$'
                            restCol.appendChild(price)
                            row.appendChild(restCol)
                            var btnCol = document.createElement('div')
                            btnCol.classList.add('col-1')
                            var btn = document.createElement('button')
                            btn.classList.add('x-dark-shadow', 'btn-transparent')
                            btn.setAttribute("data-toggle", "tooltip")
                            btn.setAttribute("title", "Remove from cart")
                            var icon = document.createElement('i')
                            icon.classList.add('fas', 'fa-times')
                            btn.appendChild(icon)
                            btn.onclick = () => {
                                // Set the display to remove this item and discount it from the total
                                row.remove()
                                var t = document.getElementById('total').textContent.split(' ')[1]
                                t = Number.parseFloat(t)
                                t = t - item.Price
                                document.getElementById('total').textContent = 'Total: ' + t.toFixed(2) + '$'
                                // Request to update the user's cart, removing this item
                                var findCart = {
                                    Key: {
                                        "IdentityID": {
                                            S: identityId
                                        }
                                    },
                                    TableName: "JukeboxGuestCarts",
                                    AttributesToGet: [
                                        'CartItems'
                                    ]
                                }
                                ddb.getItem(findCart, function (err, data) {
                                    if (err) alert(err + '\n' + err.getMessage()); // An error occurred
                                    else {
                                        var currCart = data["Item"]["CartItems"]["NS"]
                                        var newCart = currCart.toString().split(',').filter(i => i.toString() != item.ItemID.toString())
                                        var toUpdate = {
                                            TableName: "JukeboxGuestCarts",
                                            Key: { IdentityID: { S: identityId } },
                                            UpdateExpression: "SET CartItems = :c",
                                            ExpressionAttributeValues: {
                                                ":c": { NS: newCart }
                                            },
                                            ReturnValues: "UPDATED_NEW"
                                        }
                                        ddb.updateItem(toUpdate, function (err, doot) {
                                            if (err) alert(err + '\n' + err.getMessage());
                                            else {
                                                // alert('Successfully updated item:\n' + JSON.stringify(doot));
                                            }
                                        })
                                    }
                                })
                            }
                            btnCol.appendChild(btn)
                            row.appendChild(btnCol)
                            cont.appendChild(row)
                            total += item.Price
                        });
                        var tot = document.createElement('h2')
                        tot.id = 'total'
                        tot.classList.add('text-right', 'x-dark-shadow')
                        tot.textContent = 'Total: ' + total.toFixed(2) + '$'
                        document.getElementById('end').appendChild(tot)
                        var purchase = document.createElement('button')
                        purchase.classList.add('btn', 'btn-outline-warning', 'btn-round', 'alt', 'disabled')
                        purchase.textContent = 'Buy'
                        purchase.setAttribute("data-toggle", "tooltip")
                        purchase.setAttribute("title", "You must be logged in to make a purchase")
                        document.getElementById('end').appendChild(purchase)
                    }
                });
            }, 100);
        }
    }).catch(function handleTokenError(error) {
        alert(error);
        window.location.assign('./login.html');
    });
}

