var at;

var poolData = {
    UserPoolId: _config.cognito.userPoolId,
    ClientId: _config.cognito.userPoolClientId
};

// Retrieve (parse) the items from the inventory file products.js and display them
var products = JSON.parse(data)

var userPool, authToken, username, identityId, ddb;

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
        window.location.reload()
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
                
                setDisplay(false)   // false => Not a guest user

                const headers = {
                    Authorization: at // The received authentication token
                }
                const url = _config.api.invokeUrl + '/getcart'
                $.ajax({
                    method: 'GET',
                    url: url,
                    headers: headers,
                    error: function ajaxError(jqXHR, textStatus, errorThrown) {
                        console.error('Error requesting ride: ', textStatus, ', Details: ', errorThrown);
                        console.error('Response: ', jqXHR.responseText);
                        alert('An error occured when adding item to cart:\n' + JSON.stringify(jqXHR));
                    },
                    success: function(response) {
                        var cart = response.CartItems
                        products.forEach(item => {
                            // If the product is in the user's cart ...
                            if (cart.includes(item.ItemID)) {
                                // ... Change the display to indicate so
                                var button = document.getElementById('btnFor' + item.ItemID)
                                var plus = button.children.item(0)
                                button.classList.remove('bg-medium-danger')
                                button.classList.remove('text-right')
                                button.classList.add('btn-danger')
                                button.classList.add('text-left')
                                plus.classList.remove('fa-plus')
                                plus.classList.add('fa-check')
                                button.setAttribute("title", "Remove from cart")
                            }
                        })
                    }
                });
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
                identityId = AWS.config.credentials.identityId;

                // Create the DynamoDB service object
                ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

                setDisplay(true)    // true => Guest user

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
                        // Get the list of items already in the guest's cart
                        var cart = data["Item"]["CartItems"]["NS"]
                        products.forEach(item => {
                            // If the product is in the cart ...
                            if (cart.includes(item.ItemID.toString())) {
                                // ... Change the display to indicate so
                                var button = document.getElementById('btnFor' + item.ItemID)
                                var plus = button.children.item(0)
                                button.classList.remove('bg-medium-danger')
                                button.classList.remove('text-right')
                                button.classList.add('btn-danger')
                                button.classList.add('text-left')
                                plus.classList.remove('fa-plus')
                                plus.classList.add('fa-check')
                                button.setAttribute("title", "Remove from cart")
                            }
                        })
                    }
                });
            }, 100);
        }
    }).catch(function handleTokenError(error) {
        alert(error);
        window.location.assign('./login.html');
    });
}

function addToGuestCart(item) {
    var currCart;
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
        // If a cart is found, add the product ID to it and send an update request 
        else if (data["Item"]) {
            currCart = data["Item"]["CartItems"]["NS"]
            var newCart = currCart.toString().split(',')
            newCart.push(item.ItemID.toString())
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
        // If this is the first product the user's selected, create a cart for them
        else {
            currCart = [item.ItemID.toString()]
            var toWrite = {
                TableName: "JukeboxGuestCarts",
                Item: {
                    IdentityID: { S: identityId },
                    CartItems: { NS: currCart }
                }
            }
            ddb.putItem(toWrite, function (err, doot) {
                if (err) alert(err + '\n' + err.getMessage());
                else {
                    // alert('Successfully wrote item to cart:\n' + JSON.stringify(doot));
                }
            })
        }
    })
}

function addToUserCart(item) {
    const headers = {
        Authorization: at // The received authentication token
    }
    const url = _config.api.invokeUrl + '/addcartitem'
    $.ajax({
        method: 'POST',
        url: url,
        headers: headers,
        data: JSON.stringify({
            ItemID: item.ItemID
        }),
        error: function ajaxError(jqXHR, textStatus, errorThrown) {
            console.error('Error requesting ride: ', textStatus, ', Details: ', errorThrown);
            console.error('Response: ', jqXHR.responseText);
            alert('An error occured when adding item to cart:\n' + JSON.stringify(jqXHR));
        }
    });
}

function removeFromGuestCart(item) {
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
            // 2.2 Update the user's cart to remove the selected product
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
function removeFromUserCart(item) {
    const headers = {
        Authorization: at // The received authentication token
    }
    const url = _config.api.invokeUrl + '/removecartitem'
    $.ajax({
        method: 'POST',
        url: url,
        headers: headers,
        data: JSON.stringify({
            ItemID: item.ItemID
        }),
        error: function ajaxError(jqXHR, textStatus, errorThrown) {
            console.error('Error requesting ride: ', textStatus, ', Details: ', errorThrown);
            console.error('Response: ', jqXHR.responseText);
            alert('An error occured when removing item from cart:\n' + JSON.stringify(jqXHR));
        }
    });
}

function setDisplayAddedItem(button, plus) {
    button.classList.remove('bg-medium-danger')
    button.classList.remove('text-right')
    button.classList.add('btn-danger')
    button.classList.add('text-left')
    plus.classList.remove('fa-plus')
    plus.classList.add('fa-check')
    button.setAttribute("title", "Remove from cart")
}

function setDisplayRemovedItem(button, plus) {
    button.classList.add('bg-medium-danger')
    button.classList.add('text-right')
    button.classList.remove('btn-danger')
    button.classList.remove('text-left')
    plus.classList.add('fa-plus')
    plus.classList.remove('fa-check')
    button.setAttribute("title", "Add to cart")
}

function setDisplay(guest) {
    // Set the basic display for each product in the catalog.
    products.forEach(item => {
        var card = document.createElement('div')    // The container-card
        card.classList.add('card')
        var img = document.createElement('img') // The album's cover image
        img.classList.add('cover-img')
        img.src = "./inventory/covers/" + item.Cover
        img.setAttribute("data-toggle", "tooltip")  // Setting a tooltip with the album's track
        var trackList = item.Album + " - Track List:\n"
        var count = 1
        item.Tracks.forEach(track => {
            trackList += count + '. ' + track + '\n'
            count++
        });
        img.setAttribute("title", trackList)
        card.appendChild(img)
        var body = document.createElement('div')    // Card body
        body.classList.add('card-body', 'd-flex', 'flex-column', 'text-dark')
        var title = document.createElement('h4')    // Card primary title -> album name
        title.classList.add('card-title')
        title.style.fontWeight = 'bold'
        title.textContent = item.Album
        body.appendChild(title)
        var artist = document.createElement('h5')   // Card secondary title -> artist
        artist.textContent = item.Artist
        body.appendChild(artist)
        var row = document.createElement('div') // Row for the price label and the button to add/remove it from the cart
        row.classList.add('row', 'mt-auto', 'tab-top')
        var priceCol = document.createElement('div')    // Column for the price label
        priceCol.classList.add('col-6')
        var price = document.createElement('h4')    // Price label
        price.classList.add('x-bold-text', 'mt-auto', 'text-dark')
        price.textContent = item.Price + '$'
        priceCol.appendChild(price)
        row.appendChild(priceCol)
        var btnCol = document.createElement('div')  // Row for the "add/remove to/from cart" button
        btnCol.classList.add('col-6')
        var button = document.createElement('button')   // The "add/remove to/from cart" button
        button.setAttribute("data-toggle", "tooltip")
        button.setAttribute("title", "Add to cart")
        button.type = 'button'
        button.id = 'btnFor' + item.ItemID
        button.style.width = '100%'
        button.classList.add('bg-medium-danger', 'btn-round', 'btn-sm', 'text-right')
        var plus = document.createElement('i')
        plus.classList.add('fas', 'fa-plus', 'btn-toggle')
        button.appendChild(plus)
        button.onclick = () => {
            // If the item wasn't in the cart (and should now be)
            if (button.classList.contains('bg-medium-danger')) {
                // 1. Set the display to indicate that the item has been added
                setDisplayAddedItem(button, plus)
                // 2. Request to set the user's cart with this item
                // 2.1 Attempt to find the user's cart
                if (guest) {
                    addToGuestCart(item)
                }
                else {
                    addToUserCart(item)
                }
            }
            // Else, if it was in the cart (and shouldn't be anymore)
            else {
                // 1. Set the display to indicate the item is no longer in the cart
                setDisplayRemovedItem(button, plus)
                // 2. Send the request to update the user's cart removing the item from it
                // 2.1. Find the user's cart
                if (guest) {
                    removeFromGuestCart(item)
                }
                else {
                    removeFromUserCart(item)
                }
            }
        }
        btnCol.appendChild(button)
        row.appendChild(btnCol)
        body.appendChild(row)
        card.appendChild(body)
        document.getElementById('content').appendChild(card)
    });
}