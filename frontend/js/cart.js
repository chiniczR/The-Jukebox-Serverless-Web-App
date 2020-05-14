var at; // Authorization Token to be received from Cognito if there is a user logged in

var poolData = {    // Cognito user pool data
    UserPoolId: _config.cognito.userPoolId,
    ClientId: _config.cognito.userPoolClientId
};

var userPool, authToken, username, ddb, identityId;

// Retrieve (parse) the items from the inventory file products.js and display them
var products = JSON.parse(data)

// Cognito must be configured for the site to work properly
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

    // Go check with Cognito if there is a user currently logged in here
    authToken = new Promise(function fetchCurrentAuthToken(resolve, reject) {
        var cognitoUser = userPool.getCurrentUser();
        if (cognitoUser) {
            if (cognitoUser.username) {
                username = cognitoUser.username
            }
            cognitoUser.getSession(function sessionCallback(err, session) {
                if (err) {  
                    reject(err);
                } 
                else if (!session.isValid()) {
                    resolve(null);
                } 
                else {
                    resolve(session.getIdToken().getJwtToken());
                }
            });
        } 
        else {    // If there is no user logged in here
            resolve(null);
        }
    });
    // Run the above check and then:
    authToken.then(function setAuthToken(token) {
        if (token) {    // If we got a token => there is a user logged in
            at = token
            setTimeout(() => {  // Give the document time to load
                changeLoginBtn()
                
                document.getElementById('greeting').textContent = 'Logged in as ' + username
                
                const headers = {
                    Authorization: at // The received authentication token
                }
                const url = _config.api.invokeUrl + '/getcart'
                $.ajax({
                    method: 'GET',
                    url: url,
                    headers: headers,
                    error: function ajaxError(jqXHR, textStatus, errorThrown) {
                        alert('An error occured when retrieving the cart:\n' + JSON.stringify(jqXHR));
                    },
                    success: function success(response) {
                        clearLoadingDisplay()
                        var cart = response.CartItems
                        setDisplay(cart, false) // false => Not a guest
                    }
                });
            }, 100);
        }
        else {
            setTimeout(() => {  // Give the document time to load
                // Initialize the Amazon Cognito credentials provider
                AWS.config.region = 'us-east-2'; // Region
                AWS.config.credentials = new AWS.CognitoIdentityCredentials({
                    IdentityPoolId: 'us-east-2:be4d13f7-7fc3-4b9d-b0b1-ab448dd7271b',
                });

                // Getting the current guest's IdentityID
                identityId = AWS.config.credentials.identityId;

                // Create the DynamoDB service object
                ddb = new AWS.DynamoDB({ apiVersion: '2012-08-10' });

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
                    clearLoadingDisplay()
                    if (err) alert(err + '\n' + err.getMessage()); // An error occurred
                    else if (data["Item"]) {    // If the guest has items in their cart
                        // Get the list of items in the cart
                        var cart = data["Item"]["CartItems"]["NS"]
                        cart = cart.toString().split(',')
                        setDisplay(cart, true)
                    }
                    else {
                        var cont = document.getElementById('cont')
                        var h3 = document.createElement('h3')
                        h3.classList.add('dark-shadow')
                        h3.textContent = "Your cart is empty!"
                        cont.appendChild(h3)
                    }
                });
            }, 100);
        }
    }).catch(function handleTokenError(error) {
        alert(error);
        window.location.assign('./login.html');
    });
}

function clearLoadingDisplay() {
    document.getElementById('loading-icon').remove()
    document.getElementById('loading-text').remove()
}

function setDisplay(cart, guest) {
    var cont = document.getElementById('cont')
    if (cart.length < 1) {
        var cont = document.getElementById('cont')
        var h3 = document.createElement('h3')
        h3.classList.add('dark-shadow')
        h3.textContent = "Your cart is empty!"
        cont.appendChild(h3)
    }
    var total = 0.0 // Store the purchase's total
    cart.forEach(i => {
        // Find the item in the inventory, by its ID
        var item = products.filter(x => x.ItemID.toString() == i)[0]
        // Create the container for the product's display
        var prod = document.createElement('div')
        prod.classList.add('product', 'container-fluid')
        var row = document.createElement('div') // Row to split into cover, details & cancel-button columns
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
        var restCol = document.createElement('div') // Column for the product's details
        restCol.classList.add('col-10')
        var h4 = document.createElement('h4')   // Album name
        h4.classList.add('dark-shadow')
        h4.textContent = item.Album
        restCol.appendChild(h4)
        var h5 = document.createElement('h5')   // Artist
        h5.textContent = item.Artist
        restCol.appendChild(h5)
        var h6 = document.createElement('h6')   // Track-list tooltip hint
        h6.textContent = "Hover over the album cover to check its track list"
        restCol.appendChild(h6)
        var price = document.createElement('h3')    // Price
        price.classList.add('text-right', 'dark-shadow')
        price.textContent = item.Price + '$'
        restCol.appendChild(price)
        row.appendChild(restCol)
        var btnCol = document.createElement('div')  // Column for the "remove from cart" button
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
            if (guest) {
                removeFromGuestCart(item)
            }
            else {
                removeFromUserCart(item)
            }
        }
        btnCol.appendChild(btn)
        row.appendChild(btnCol)
        cont.appendChild(row)
        total += item.Price
    });
    var tot = document.createElement('h2')  // Display for the total
    tot.id = 'total'
    tot.classList.add('text-right', 'x-dark-shadow')
    tot.textContent = 'Total: ' + total.toFixed(2) + '$'
    document.getElementById('end').appendChild(tot)
    var purchase = document.createElement('button') // Button to make purchase
    purchase.classList.add('btn', 'btn-outline-warning', 'btn-round', 'alt', 'disabled')
    if (!guest) {
        purchase.classList.remove('disabled')
        purchase.onclick = () => {
            if (confirm("Are you sure you want to make this purchase?")) {
                const headers = {
                    Authorization: at // The received authentication token
                }
                var url = _config.api.invokeUrl + '/addpurchase'
                $.ajax({
                    method: 'POST',
                    url: url,
                    headers: headers,
                    data: JSON.stringify({
                        Items: cart,
                        Total: total
                    }),
                    error: function ajaxError(jqXHR, textStatus, errorThrown) {
                        alert('An error occured when making the purchase:\n' + JSON.stringify(jqXHR));
                    },
                    success: function success(response) {
                        url = _config.api.invokeUrl + '/clearcart'
                        $.ajax({
                            method: 'GET',
                            url: url,
                            headers: headers,
                            error: function ajaxErr(jqXHR, textStatus, errorThrown) {
                                alert('An error occured when clearing cart:\n' + JSON.stringify(jqXHR));
                            },
                            success: function succ(res) {
                                alert("Purchase made successfully! You should be getting a confirmation email anytime now.")
                                window.location.href = 'index.html'
                            }
                        });
                    }
                });
            }
        }
    }
    else {
        purchase.setAttribute("data-toggle", "tooltip")
        purchase.setAttribute("title", "You must be logged in to make a purchase")
    }
    purchase.textContent = 'Buy'
    document.getElementById('end').appendChild(purchase)
}

function removeFromGuestCart(item) {
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
        else if (data["Item"]) {
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
                // else {
                //     alert('Successfully updated item:\n' + JSON.stringify(doot));
                // }
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
            alert('An error occured when removing item from cart:\n' + JSON.stringify(jqXHR));
        }
    });
}

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