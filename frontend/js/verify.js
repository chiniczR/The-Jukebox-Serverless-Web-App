var signinUrl = 'login.html';

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
    function verify(email, code, onSuccess, onFailure) {
        createCognitoUser(email).confirmRegistration(code, true, function confirmCallback(err, result) {
            if (!err) {
                onSuccess(result);
            } else {
                onFailure(err);
            }
        });
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

function handleVerify(event) {
    var email = document.getElementById('emailInputVerify').value;
    var code = document.getElementById('codeInputVerify').value;
    event.preventDefault();
    verify(email, code,
        function verifySuccess(result) {
            console.log('call result: ' + result);
            console.log('Successfully verified');
            alert('Verification successful. You will now be redirected to the login page.');
            window.location.href = signinUrl;
        },
        function verifyError(err) {
            alert(err);
        }
    );
}
