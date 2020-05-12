var poolData = {
    UserPoolId: _config.cognito.userPoolId,
    ClientId: _config.cognito.userPoolClientId
};

var userPool;

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

    var authToken = new Promise(function fetchCurrentAuthToken(resolve, reject) {
        var cognitoUser = userPool.getCurrentUser();

        if (cognitoUser) {
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
            alert('You are already logged in! You must logout before accessing this page.')
            window.location.assign('./index.html')
        }
    }).catch(function handleTokenError(error) {
        alert(error);
        window.location.assign('./index.html');
    });

    /*
        * Cognito User Pool functions
    */

    function register(email, password, onSuccess, onFailure) {
        var dataEmail = {
            Name: 'email',
            Value: email
        };
        var attributeEmail = new AmazonCognitoIdentity.CognitoUserAttribute(dataEmail);

        userPool.signUp(email, password, [attributeEmail], null,
            function signUpCallback(err, result) {
                if (!err) {
                    onSuccess(result);
                } else {
                    onFailure(err);
                }
            }
        );
    }

    function createCognitoUser(email) {
        return new AmazonCognitoIdentity.CognitoUser({
            Username: email,
            Pool: userPool
        });
    }
}

/*
 *  Event Handlers
*/

function handleRegister(event) {
    event.preventDefault();

    var email = document.getElementById('exampleInputEmail1').value;
    var password = document.getElementById('exampleInputPassword1').value;
    var password2 = document.getElementById('exampleConfirmPassword1').value;

    var onSuccess = function registerSuccess(result) {
        var cognitoUser = result.user;
        console.log('user name is ' + cognitoUser.getUsername());
        var confirmation = ('Registration successful. Please check your email inbox or spam folder for your verification code.');
        if (confirmation) {
            window.location.href = 'verify.html';
        }
    };
    var onFailure = function registerFailure(err) {
        alert(err);
    };
    
    if (password === password2) {
        register(email, password, onSuccess, onFailure);
    } else {
        alert('Passwords do not match');
    }
}
